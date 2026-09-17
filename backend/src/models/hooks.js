const { randomUUID } = require('crypto');
const { Op } = require('sequelize');

const DOC_FIELDS = {
  voterIdImage: 'VOTER_ID',
  aadhaarImage: 'AADHAAR',
  panCardImage: 'PAN',
};

function parseIds(value) {
  if (Array.isArray(value)) return [...new Set(value.filter(Boolean).map(String))];
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? [...new Set(parsed.filter(Boolean).map(String))] : [];
    } catch (_) {
      return [];
    }
  }
  return [];
}

function registerNormalizedHooks(models) {
  const {
    Person,
    PersonDocument,
    Employee,
    EmployeeAreaAssignment,
    Complaint,
    ComplaintAttachment,
    Family,
    House,
    DeathRecord,
  } = models;

  Person.addHook('beforeSave', (person) => {
    const pending = {};
    for (const [field, docType] of Object.entries(DOC_FIELDS)) {
      if ((typeof person.changed === 'function' && person.changed(field)) || (person.isNewRecord && person.getDataValue(field))) {
        const value = person.getDataValue(field);
        pending[docType] = value === '' || value == null ? null : value;
      }
    }
    person._pendingDocs = pending;
  });

  Person.addHook('afterSave', async (person, options) => {
    const pending = person._pendingDocs || {};
    const types = Object.keys(pending);
    if (!types.length) {
      const { syncPersonBirthday } = require('../services/wardDay.service');
      await syncPersonBirthday(person, options?.transaction);
      return;
    }
    for (const [docType, content] of Object.entries(pending)) {
      const existing = await PersonDocument.findOne({
        where: { personId: person.id, docType },
        transaction: options?.transaction,
      });
      if (content) {
        if (existing) await existing.update({ content }, { transaction: options?.transaction });
        else {
          await PersonDocument.create({
            id: randomUUID(),
            personId: person.id,
            docType,
            content,
          }, { transaction: options?.transaction });
        }
      } else if (existing) {
        await existing.destroy({ transaction: options?.transaction });
      }
    }
    const { syncPersonBirthday } = require('../services/wardDay.service');
    await syncPersonBirthday(person, options?.transaction);
  });

  Person.addHook('afterFind', (found) => {
    const rows = !found ? [] : Array.isArray(found) ? found : found.rows || [found];
    for (const person of rows) {
      if (!person || typeof person.get !== 'function') continue;
      const docs = person.documents || person.get?.('documents') || [];
      for (const doc of docs) {
        const field = Object.keys(DOC_FIELDS).find((key) => DOC_FIELDS[key] === doc.docType);
        if (field) person.setDataValue(field, doc.content || null);
      }
    }
  });

  Person.addHook('afterDestroy', async (person, options) => {
    const { syncPersonBirthday } = require('../services/wardDay.service');
    await syncPersonBirthday(person, options?.transaction);
  });

  Family.addHook('afterUpdate', async (family, options) => {
    if (!family.changed('houseId')) return;
    const { refreshBirthdaysForFamily } = require('../services/wardDay.service');
    await refreshBirthdaysForFamily(family.id, options?.transaction);
  });

  House.addHook('afterUpdate', async (house, options) => {
    if (!house.changed('areaId')) return;
    const { refreshBirthdaysForHouse } = require('../services/wardDay.service');
    await refreshBirthdaysForHouse(house.id, options?.transaction);
  });

  DeathRecord.addHook('afterSave', async (record, options) => {
    const { syncDeathObservance } = require('../services/wardDay.service');
    await syncDeathObservance(record, options?.transaction);
  });

  Employee.addHook('afterSave', async (employee, options) => {
    const ids = parseIds(employee.get('assignedAreaIds'));
    const existing = await EmployeeAreaAssignment.findAll({
      where: { employeeId: employee.id },
      transaction: options?.transaction,
    });
    const have = new Set(existing.map((row) => String(row.areaId)));
    const next = new Set(ids);
    const remove = existing.filter((row) => !next.has(String(row.areaId)));
    if (remove.length) {
      await EmployeeAreaAssignment.destroy({
        where: { id: { [Op.in]: remove.map((row) => row.id) } },
        transaction: options?.transaction,
      });
    }
    const add = ids.filter((id) => !have.has(String(id)));
    if (add.length) {
      await EmployeeAreaAssignment.bulkCreate(
        add.map((areaId) => ({ id: randomUUID(), employeeId: employee.id, areaId })),
        { transaction: options?.transaction, ignoreDuplicates: true }
      );
    }
  });

  Complaint.addHook('afterSave', async (complaint, options) => {
    const pairs = [
      ['REPORTED', complaint.reportedImage],
      ['RESOLUTION', complaint.resolutionImage],
    ];
    for (const [kind, content] of pairs) {
      const existing = await ComplaintAttachment.findOne({
        where: { complaintId: complaint.id, kind },
        transaction: options?.transaction,
      });
      if (content) {
        if (existing) await existing.update({ content }, { transaction: options?.transaction });
        else {
          await ComplaintAttachment.create({
            id: randomUUID(),
            complaintId: complaint.id,
            kind,
            content,
          }, { transaction: options?.transaction });
        }
      } else if (existing) {
        await existing.destroy({ transaction: options?.transaction });
      }
    }
  });
}

module.exports = { registerNormalizedHooks, DOC_FIELDS, parseIds };
