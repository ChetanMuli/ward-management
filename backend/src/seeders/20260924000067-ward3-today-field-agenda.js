'use strict';

const { Op } = require('sequelize');
const { todayStamp, addDays } = require('../utils/calendarDates');

module.exports = {
  async up() {
    const {
      Ward, Area, House, Family, Person, DeathRecord, User, Role, sequelize,
    } = require('../models');
    const { syncPersonBirthday } = require('../services/wardDay.service');

    const ward = await Ward.findOne({ where: { wardNumber: 'W-03' } });
    if (!ward) return;

    const today = todayStamp();
    const [y, m, d] = today.split('-');
    const dahavaDeath = addDays(today, -10);
    const varshaDeath = `${Number(y) - 1}-${m}-${d}`;

    const already = await DeathRecord.findOne({ where: { notes: 'W3_TODAY_DAHAVA_SEED' } });
    const alreadyBday = await Person.findOne({ where: { notes: { [Op.like]: '%W3_TODAY_BIRTHDAY_SEED%' } } });
    if (already && alreadyBday) return;

    let reporter = await User.findOne({
      include: [{ model: Role, where: { name: 'SUPER_ADMIN' }, required: true }],
    });
    if (!reporter) {
      reporter = await User.findOne({
        where: { name: { [Op.like]: '%Borkar%' } },
      });
    }
    if (!reporter) return;

    const people = await Person.findAll({
      where: { status: 'ACTIVE' },
      include: [{
        model: Family,
        as: 'family',
        required: true,
        include: [{
          model: House,
          as: 'house',
          required: true,
          include: [{
            model: Area,
            as: 'area',
            required: true,
            where: { wardId: ward.id },
          }],
        }],
      }],
      order: [['createdAt', 'ASC']],
      limit: 40,
    });

    const withoutDeath = [];
    for (const person of people) {
      const death = await DeathRecord.findOne({ where: { personId: person.id } });
      if (!death) withoutDeath.push(person);
    }

    let pool = withoutDeath;
    if (pool.length < 4) {
      const family = people[0]?.family || await Family.findOne({
        include: [{
          model: House,
          as: 'house',
          required: true,
          include: [{ model: Area, as: 'area', required: true, where: { wardId: ward.id } }],
        }],
      });
      if (!family) return;
      const extras = [
        { fullName: 'Patil Ramesh Govind', gender: 'MALE', notes: 'W3_TODAY_AGENDA_SEED' },
        { fullName: 'Shinde Meena Anil', gender: 'FEMALE', notes: 'W3_TODAY_AGENDA_SEED' },
        { fullName: 'Jadhav Suresh Kisan', gender: 'MALE', notes: 'W3_TODAY_AGENDA_SEED' },
        { fullName: 'More Lata Vasant', gender: 'FEMALE', notes: 'W3_TODAY_AGENDA_SEED' },
      ];
      for (const extra of extras) {
        if (pool.length >= 4) break;
        const created = await Person.create({
          familyId: family.id,
          fullName: extra.fullName,
          gender: extra.gender,
          dob: `${Number(y) - 42}-${m}-${d}`,
          status: 'ACTIVE',
          verificationStatus: 'VERIFIED',
          notes: extra.notes,
          createdBy: reporter.id,
        });
        pool.push(created);
      }
    }

    const birthdayPeople = pool.slice(0, 2);
    const dahavaPerson = pool[2];
    const varshaPerson = pool[3];

    await sequelize.transaction(async (transaction) => {
      for (const person of birthdayPeople) {
        const year = String(person.dob || `${Number(y) - 35}-01-01`).slice(0, 4);
        await person.update({
          dob: `${year}-${m}-${d}`,
          notes: [person.notes, 'W3_TODAY_BIRTHDAY_SEED'].filter(Boolean).join(' | ').slice(0, 240),
        }, { transaction });
        await syncPersonBirthday(person, transaction);
      }

      if (dahavaPerson) {
        await dahavaPerson.update({ status: 'DECEASED', notes: 'W3_TODAY_DAHAVA_SEED' }, { transaction });
        await DeathRecord.create({
          personId: dahavaPerson.id,
          dateOfDeath: dahavaDeath,
          reportedBy: reporter.id,
          verificationStatus: 'VERIFIED',
          recordStatus: 'ACTIVE',
          notes: 'W3_TODAY_DAHAVA_SEED',
        }, { transaction });
      }

      if (varshaPerson) {
        await varshaPerson.update({ status: 'DECEASED', notes: 'W3_TODAY_VARSHA_SEED' }, { transaction });
        await DeathRecord.create({
          personId: varshaPerson.id,
          dateOfDeath: varshaDeath,
          reportedBy: reporter.id,
          verificationStatus: 'VERIFIED',
          recordStatus: 'ACTIVE',
          notes: 'W3_TODAY_VARSHA_SEED',
        }, { transaction });
      }
    });
  },

  async down() {
    const { Person, DeathRecord } = require('../models');
    const deaths = await DeathRecord.findAll({
      where: { notes: { [Op.in]: ['W3_TODAY_DAHAVA_SEED', 'W3_TODAY_VARSHA_SEED'] } },
    });
    for (const row of deaths) await row.destroy();
    const people = await Person.findAll({
      where: { notes: { [Op.like]: '%W3_TODAY_%' } },
      paranoid: false,
    });
    for (const person of people) {
      if (String(person.notes || '').includes('W3_TODAY_AGENDA_SEED')) {
        await person.destroy({ force: true });
      }
    }
  },
};
