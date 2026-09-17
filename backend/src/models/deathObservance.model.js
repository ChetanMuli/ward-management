const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const DeathObservance = sequelize.define('DeathObservance', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  deathRecordId: { type: DataTypes.UUID, allowNull: false, unique: true, field: 'death_record_id' },
  personId: { type: DataTypes.UUID, allowNull: false, field: 'person_id' },
  wardId: { type: DataTypes.UUID, allowNull: true, field: 'ward_id' },
  houseId: { type: DataTypes.UUID, allowNull: true, field: 'house_id' },
  familyId: { type: DataTypes.UUID, allowNull: true, field: 'family_id' },
  dateOfDeath: { type: DataTypes.DATEONLY, allowNull: false, field: 'date_of_death' },
  tenthDayOn: { type: DataTypes.DATEONLY, allowNull: false, field: 'tenth_day_on' },
  firstYearOn: { type: DataTypes.DATEONLY, allowNull: false, field: 'first_year_on' },
  status: {
    type: DataTypes.ENUM('ACTIVE', 'CANCELLED'),
    allowNull: false,
    defaultValue: 'ACTIVE',
  },
  recordedNotifiedAt: { type: DataTypes.DATE, allowNull: true, field: 'recorded_notified_at' },
  tenthDayNotifiedAt: { type: DataTypes.DATE, allowNull: true, field: 'tenth_day_notified_at' },
  firstYearNotifiedAt: { type: DataTypes.DATE, allowNull: true, field: 'first_year_notified_at' },
}, {
  tableName: 'death_observances',
  underscored: true,
  indexes: [
    { fields: ['ward_id', 'status', 'tenth_day_on'] },
    { fields: ['ward_id', 'status', 'first_year_on'] },
    { fields: ['tenth_day_on', 'status'] },
    { fields: ['first_year_on', 'status'] },
    { fields: ['person_id'] },
  ],
});

module.exports = DeathObservance;
