const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PersonDocument = sequelize.define('PersonDocument', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  personId: { type: DataTypes.UUID, allowNull: false, field: 'person_id' },
  docType: {
    type: DataTypes.ENUM('VOTER_ID', 'AADHAAR', 'PAN'),
    allowNull: false,
    field: 'doc_type',
  },
  content: { type: DataTypes.TEXT('long'), allowNull: true },
  mimeType: { type: DataTypes.STRING(80), allowNull: true, field: 'mime_type' },
  fileName: { type: DataTypes.STRING(255), allowNull: true, field: 'file_name' },
  storageKey: { type: DataTypes.STRING(500), allowNull: true, field: 'storage_key' },
}, {
  tableName: 'person_documents',
  underscored: true,
  indexes: [
    { unique: true, fields: ['person_id', 'doc_type'] },
    { fields: ['person_id'] },
    { fields: ['doc_type'] },
  ],
});

module.exports = PersonDocument;
