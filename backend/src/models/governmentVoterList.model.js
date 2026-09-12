const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const GovernmentVoterList = sequelize.define('GovernmentVoterList', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },

  originalFileName: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'original_file_name',
  },

  storedFileName: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
    field: 'stored_file_name',
  },

  mimeType: {
    type: DataTypes.STRING(120),
    allowNull: false,
    field: 'mime_type',
  },

  fileType: {
    type: DataTypes.ENUM('PDF', 'XLSX', 'CSV'),
    allowNull: false,
    field: 'file_type',
  },

  fileSize: {
    type: DataTypes.BIGINT,
    allowNull: false,
    defaultValue: 0,
    field: 'file_size',
  },

  extractedCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'extracted_count',
  },

  extractedData: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: [],
    field: 'extracted_data',
  },

  uploadedBy: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'uploaded_by',
  },

  wardIds: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: [],
    field: 'ward_ids',
  },

  assignmentMode: {
    type: DataTypes.ENUM('UPLOADER_ONLY', 'ALL_NAGARSEVAKS', 'SPECIFIC_NAGARSEVAKS'),
    allowNull: false,
    defaultValue: 'UPLOADER_ONLY',
    field: 'assignment_mode',
  },

  assignedNagarsevakIds: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: [],
    field: 'assigned_nagarsevak_ids',
  },

  // IMPORTANT:
  // Sequelize attribute is deletedAt,
  // actual MySQL column is deleted_at.
  deletedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'deleted_at',
  },
}, {
  tableName: 'government_voter_lists',

  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',

  paranoid: true,
  deletedAt: 'deleted_at',

  indexes: [
    {
      fields: ['uploaded_by'],
    },
    {
      fields: ['created_at'],
    },
    {
      fields: ['deleted_at'],
    },
  ],
});

module.exports = GovernmentVoterList;
