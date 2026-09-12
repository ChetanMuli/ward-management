const { Op } = require('sequelize');
const { Person } = require('../models');

/**
 * Advisory-only duplicate check. Never auto-merges or auto-deletes -
 * just returns candidates for an authorized user to review (SRS section 12).
 */
async function findPossibleDuplicates({ fullName, dob, mobile, familyId }, excludePersonId = null) {
  const orConditions = [];
  if (mobile) orConditions.push({ mobile });
  if (fullName && dob) orConditions.push({ fullName, dob });
  if (familyId && fullName) orConditions.push({ familyId, fullName });

  if (orConditions.length === 0) return [];

  const where = { [Op.or]: orConditions };
  if (excludePersonId) where.id = { [Op.ne]: excludePersonId };

  return Person.findAll({ where, limit: 10 });
}

module.exports = { findPossibleDuplicates };
