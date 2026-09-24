const { Op } = require('sequelize');
const {
  DeathRecord,
  DeathObservance,
  Person,
  PersonBirthday,
  Family,
  House,
  Area,
} = require('../models');
const { notifyWardFieldStaff } = require('./wardActivation.service');
const { addDays, addYears, todayStamp, displayDate, isLeapYear, monthDayFromDob } = require('../utils/calendarDates');

function locationFromPerson(person) {
  return {
    familyId: person?.familyId || person?.family?.id || null,
    houseId: person?.family?.house?.id || null,
    wardId: person?.family?.house?.area?.wardId || null,
    fullName: person?.fullName || 'Citizen',
    dob: person?.dob || null,
    status: person?.status || 'ACTIVE',
    deletedAt: person?.deletedAt || null,
  };
}

async function loadPersonWithLocation(personOrId, transaction) {
  if (personOrId && typeof personOrId === 'object' && personOrId.family?.house?.area) {
    return personOrId;
  }
  const id = typeof personOrId === 'object' ? personOrId.id : personOrId;
  if (!id) return personOrId;
  return Person.findByPk(id, {
    transaction,
    paranoid: false,
    include: [{
      model: Family,
      as: 'family',
      required: false,
      include: [{
        model: House,
        as: 'house',
        required: false,
        include: [{ model: Area, as: 'area', required: false, attributes: ['id', 'name', 'wardId'] }],
      }],
    }],
  });
}

async function syncPersonBirthday(person, transaction) {
  if (!person?.id) return null;
  const full = await loadPersonWithLocation(person, transaction);
  const loc = locationFromPerson(full || person);
  const parts = monthDayFromDob(loc.dob);
  if (!parts) {
    await PersonBirthday.destroy({ where: { personId: person.id }, transaction });
    return null;
  }
  const active = loc.status === 'ACTIVE' && !loc.deletedAt;
  const payload = {
    personId: person.id,
    wardId: loc.wardId,
    houseId: loc.houseId,
    familyId: loc.familyId,
    fullName: loc.fullName || 'Citizen',
    dob: loc.dob,
    birthMonth: parts.month,
    birthDay: parts.day,
    status: active ? 'ACTIVE' : 'INACTIVE',
  };
  const [row] = await PersonBirthday.findOrCreate({
    where: { personId: person.id },
    defaults: payload,
    transaction,
  });
  await row.update(payload, { transaction });
  return row;
}

async function refreshBirthdaysForFamily(familyId, transaction) {
  const people = await Person.findAll({ where: { familyId }, paranoid: false, transaction, attributes: ['id'] });
  for (const person of people) await syncPersonBirthday(person, transaction);
}

async function refreshBirthdaysForHouse(houseId, transaction) {
  const families = await Family.findAll({ where: { houseId }, paranoid: false, transaction, attributes: ['id'] });
  for (const family of families) await refreshBirthdaysForFamily(family.id, transaction);
}

async function syncDeathObservance(record, transaction) {
  if (!record?.id) return null;
  const person = await loadPersonWithLocation(record.Person || record.personId, transaction);
  const loc = locationFromPerson(person);
  const dateOfDeath = record.dateOfDeath;
  const payload = {
    deathRecordId: record.id,
    personId: record.personId,
    wardId: loc.wardId,
    houseId: loc.houseId,
    familyId: loc.familyId,
    dateOfDeath,
    tenthDayOn: addDays(dateOfDeath, 10),
    firstYearOn: addYears(dateOfDeath, 1),
    status: record.recordStatus === 'ACTIVE' ? 'ACTIVE' : 'CANCELLED',
  };
  const [row] = await DeathObservance.findOrCreate({
    where: { deathRecordId: record.id },
    defaults: payload,
    transaction,
  });
  await row.update({
    ...payload,
    recordedNotifiedAt: row.recordedNotifiedAt,
    tenthDayNotifiedAt: row.tenthDayNotifiedAt,
    firstYearNotifiedAt: row.firstYearNotifiedAt,
  }, { transaction });
  if (payload.status === 'CANCELLED') {
    await syncPersonBirthday(person || { id: record.personId }, transaction);
  } else if (person) {
    await PersonBirthday.update({ status: 'INACTIVE' }, { where: { personId: person.id }, transaction });
  }
  return row;
}

function houseInclude() {
  return [{ model: House, as: 'house', required: false, attributes: ['id', 'houseNumber', 'latitude', 'longitude', 'address'] }];
}

function dateOnly(value) {
  if (!value) return '';
  if (typeof value === 'string') return value.slice(0, 10);
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

async function loadTodayWardEvents(wardIds) {
  const today = todayStamp();
  const [year, month, day] = today.split('-').map(Number);
  const allow = Array.isArray(wardIds) ? wardIds.filter(Boolean).map(String) : null;
  const wardFilter = allow ? { wardId: { [Op.in]: allow.length ? allow : ['00000000-0000-0000-0000-000000000000'] } } : {};
  const birthDay = (month === 2 && day === 28 && !isLeapYear(year)) ? { [Op.in]: [28, 29] } : day;
  const [birthdays, observances] = await Promise.all([
    PersonBirthday.findAll({
      where: { status: 'ACTIVE', birthMonth: month, birthDay, ...wardFilter },
      include: [
        ...houseInclude(),
        { model: Person, as: 'person', required: false, attributes: ['id', 'fullName', 'mobile', 'alternateMobile'] },
      ],
      order: [['fullName', 'ASC']],
    }),
    DeathObservance.findAll({
      where: {
        status: 'ACTIVE',
        ...wardFilter,
        [Op.or]: [{ tenthDayOn: today }, { firstYearOn: today }],
      },
      include: [
        ...houseInclude(),
        { model: Person, as: 'person', required: false, attributes: ['id', 'fullName', 'mobile', 'alternateMobile'] },
      ],
      order: [['tenthDayOn', 'ASC']],
    }),
  ]);
  const items = birthdays.map((row) => ({
    id: `bday-${row.personId}`,
    personId: row.personId,
    kind: 'BIRTHDAY',
    label: 'Birthday',
    name: row.fullName,
    mobile: row.person?.mobile || row.person?.alternateMobile || null,
    house: row.house?.houseNumber || null,
    address: row.house?.address || null,
    latitude: row.house?.latitude || null,
    longitude: row.house?.longitude || null,
    date: today,
  }));
  for (const row of observances) {
    const name = row.person?.fullName || row.fullName || 'Citizen';
    const mobile = row.person?.mobile || row.person?.alternateMobile || null;
    const house = row.house?.houseNumber || null;
    const loc = {
      personId: row.personId || row.person?.id || null,
      house,
      mobile,
      address: row.house?.address || null,
      latitude: row.house?.latitude || null,
      longitude: row.house?.longitude || null,
    };
    if (dateOnly(row.tenthDayOn) === today) {
      items.push({
        id: `dahava-${row.deathRecordId}`,
        kind: 'DAHAVA',
        label: 'Dahava (10th day)',
        name,
        ...loc,
        date: row.tenthDayOn,
      });
    }
    if (dateOnly(row.firstYearOn) === today) {
      items.push({
        id: `year-${row.deathRecordId}`,
        kind: 'ANNIVERSARY',
        label: 'Varshashraddha (1st year)',
        name,
        ...loc,
        date: row.firstYearOn,
      });
    }
  }
  return items;
}

async function notifyTodayDeathReminders() {
  const today = todayStamp();
  const rows = await DeathObservance.findAll({
    where: {
      status: 'ACTIVE',
      [Op.or]: [{ tenthDayOn: today }, { firstYearOn: today }],
    },
    include: [{ model: Person, as: 'person', required: false, attributes: ['id', 'fullName'] }],
  });
  let sent = 0;
  for (const row of rows) {
    if (!row.wardId) continue;
    const name = row.person?.fullName || 'Citizen';
    const actionUrl = `/deaths?open=${row.deathRecordId}`;
    if (row.tenthDayOn === today && !row.tenthDayNotifiedAt) {
      sent += await notifyWardFieldStaff(row.wardId, {
        type: 'DEATH_DAHAVA',
        title: 'Today · 10th day (Dahava)',
        message: `Today is the 10th day (Dahava) of ${name}.`,
        actionUrl,
      });
      await row.update({ tenthDayNotifiedAt: new Date() });
    }
    if (row.firstYearOn === today && !row.firstYearNotifiedAt) {
      sent += await notifyWardFieldStaff(row.wardId, {
        type: 'DEATH_ANNIVERSARY',
        title: 'Today · 1st year',
        message: `Today is the 1st year remembrance of ${name}.`,
        actionUrl,
      });
      await row.update({ firstYearNotifiedAt: new Date() });
    }
  }
  return sent;
}

async function notifyTodayBirthdays() {
  const today = todayStamp();
  const [year, month, day] = today.split('-').map(Number);
  const birthDay = (month === 2 && day === 28 && !isLeapYear(year)) ? { [Op.in]: [28, 29] } : day;
  const rows = await PersonBirthday.findAll({
    where: {
      status: 'ACTIVE',
      birthMonth: month,
      birthDay,
      [Op.or]: [{ notifiedOn: null }, { notifiedOn: { [Op.ne]: today } }],
    },
    include: houseInclude(),
  });
  let sent = 0;
  for (const row of rows) {
    if (!row.wardId) continue;
    const house = row.house?.houseNumber ? ` (House ${row.house.houseNumber})` : '';
    sent += await notifyWardFieldStaff(row.wardId, {
      type: 'BIRTHDAY_TODAY',
      title: 'Today · Birthday',
      message: `Today is ${row.fullName}'s birthday${house}.`,
      actionUrl: '/birthdays',
    });
    await row.update({ notifiedOn: today });
  }
  return sent;
}

async function notifyDeathRecordCreated({ wardId, personName, dateOfDeath, deathRecordId }) {
  if (!wardId) return 0;
  const tenth = addDays(dateOfDeath, 10);
  const anniversary = addYears(dateOfDeath, 1);
  const sent = await notifyWardFieldStaff(wardId, {
    type: 'DEATH_RECORDED',
    title: `Death recorded · ${personName}`,
    message: `${personName} was recorded. 10th day (Dahava): ${displayDate(tenth)}. 1st year: ${displayDate(anniversary)}.`,
    actionUrl: '/deaths',
  });
  if (deathRecordId) {
    await DeathObservance.update(
      { recordedNotifiedAt: new Date() },
      { where: { deathRecordId } }
    ).catch(() => {});
  }
  return sent;
}

module.exports = {
  todayStamp,
  addDays,
  addYears,
  displayDate,
  syncPersonBirthday,
  refreshBirthdaysForFamily,
  refreshBirthdaysForHouse,
  syncDeathObservance,
  loadTodayWardEvents,
  notifyTodayDeathReminders,
  notifyTodayBirthdays,
  notifyDeathRecordCreated,
};
