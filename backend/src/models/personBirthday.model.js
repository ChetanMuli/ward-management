const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PersonBirthday = sequelize.define('PersonBirthday', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  personId: { type: DataTypes.UUID, allowNull: false, unique: true, field: 'person_id' },
  wardId: { type: DataTypes.UUID, allowNull: true, field: 'ward_id' },
  houseId: { type: DataTypes.UUID, allowNull: true, field: 'house_id' },
  familyId: { type: DataTypes.UUID, allowNull: true, field: 'family_id' },
  fullName: { type: DataTypes.STRING(255), allowNull: false, field: 'full_name' },
  dob: { type: DataTypes.DATEONLY, allowNull: false },
  birthMonth: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: 'birth_month' },
  birthDay: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: 'birth_day' },
  notifiedOn: { type: DataTypes.DATEONLY, allowNull: true, field: 'notified_on' },
  status: {
    type: DataTypes.ENUM('ACTIVE', 'INACTIVE'),
    allowNull: false,
    defaultValue: 'ACTIVE',
  },
}, {
  tableName: 'person_birthdays',
  underscored: true,
  indexes: [
    { fields: ['ward_id', 'status', 'birth_month', 'birth_day'] },
    { fields: ['status', 'birth_month', 'birth_day'] },
    { fields: ['house_id'] },
    { fields: ['family_id'] },
  ],
});

module.exports = PersonBirthday;
