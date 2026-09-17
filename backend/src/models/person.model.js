const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { calculateAge } = require('../services/age.service');

const Person = sequelize.define('Person', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  familyId: { type: DataTypes.UUID, allowNull: false },
  fullName: { type: DataTypes.STRING, allowNull: false },
  gender: { type: DataTypes.ENUM('MALE', 'FEMALE', 'OTHER', 'NOT_SPECIFIED'), allowNull: false, defaultValue: 'NOT_SPECIFIED' },
  dob: { type: DataTypes.DATEONLY, allowNull: true },
  // Age is NEVER a stored column - it's always derived from dob so it can
  // never drift out of sync or be edited by mistake.
  age: {
    type: DataTypes.VIRTUAL,
    get() {
      return calculateAge(this.getDataValue('dob'));
    },
  },
  mobile: DataTypes.STRING,
  alternateMobile: DataTypes.STRING,
  email: { type: DataTypes.STRING, validate: { isEmail: true } },
  occupation: DataTypes.STRING,
  occupationType: {
    type: DataTypes.ENUM('SERVICE', 'BUSINESS', 'OTHER'),
    allowNull: true,
  },
  businessName: DataTypes.STRING,
  businessAddress: DataTypes.TEXT,
  companyName: DataTypes.STRING,
  employmentType: {
    type: DataTypes.ENUM('PRIVATE', 'GOVERNMENT'),
    allowNull: true,
  },
  voterIdImage: { type: DataTypes.VIRTUAL, get() { return this.getDataValue('voterIdImage') || null; }, set(v) { this.setDataValue('voterIdImage', v); } },
  aadhaarImage: { type: DataTypes.VIRTUAL, get() { return this.getDataValue('aadhaarImage') || null; }, set(v) { this.setDataValue('aadhaarImage', v); } },
  panCardImage: { type: DataTypes.VIRTUAL, get() { return this.getDataValue('panCardImage') || null; }, set(v) { this.setDataValue('panCardImage', v); } },
  relationshipToHead: DataTypes.STRING,
  followupStatus: { type: DataTypes.ENUM('NOT_CONTACTED','CONTACTED','DOCUMENTS_PENDING','GUIDANCE_GIVEN','COMPLETED','OTHER'), defaultValue: 'NOT_CONTACTED' },
  followupDate: DataTypes.DATEONLY,
  followupNotes: DataTypes.TEXT,
  followupEmployeeId: DataTypes.UUID,
  residenceStatus: {
    type: DataTypes.ENUM('OWN', 'RENT', 'OTHER'),
    allowNull: true,
  },
  presenceStatus: {
    type: DataTypes.ENUM('AT_HOME', 'OUT_OF_CITY'),
    allowNull: true,
  },
  currentCity: { type: DataTypes.STRING(120), allowNull: true },
  livingWith: {
    type: DataTypes.ENUM('FAMILY', 'SELF'),
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('ACTIVE', 'DECEASED', 'MOVED_OUT', 'DUPLICATE', 'VERIFICATION_PENDING'),
    defaultValue: 'ACTIVE',
  },
  verificationStatus: {
    type: DataTypes.ENUM('PENDING', 'VERIFIED', 'REJECTED'),
    defaultValue: 'PENDING',
  },
  notes: DataTypes.TEXT,
  createdBy: DataTypes.UUID,
  updatedBy: DataTypes.UUID,
}, {
  paranoid: true,
  deletedAt: 'deletedAt',
  tableName: 'persons',
  indexes: [
    { fields: ['family_id'] },
    { fields: ['mobile'] },
    { fields: ['dob'] },
    { fields: ['status'] },
    { fields: ['full_name'] },
  ],
});

module.exports = Person;
