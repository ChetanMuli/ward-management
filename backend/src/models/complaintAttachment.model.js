const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ComplaintAttachment = sequelize.define('ComplaintAttachment', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  complaintId: { type: DataTypes.UUID, allowNull: false, field: 'complaint_id' },
  kind: {
    type: DataTypes.ENUM('REPORTED', 'RESOLUTION'),
    allowNull: false,
  },
  content: { type: DataTypes.TEXT('long'), allowNull: true },
  mimeType: { type: DataTypes.STRING(80), allowNull: true, field: 'mime_type' },
  storageKey: { type: DataTypes.STRING(500), allowNull: true, field: 'storage_key' },
}, {
  tableName: 'complaint_attachments',
  underscored: true,
  indexes: [
    { unique: true, fields: ['complaint_id', 'kind'] },
    { fields: ['complaint_id'] },
  ],
});

module.exports = ComplaintAttachment;
