const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AllChat = sequelize.define('AllChat', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  wardId: { type: DataTypes.UUID, allowNull: false, field: 'ward_id' },
  name: { type: DataTypes.STRING, allowNull: false },
  mode: { type: DataTypes.ENUM('CHAT', 'BROADCAST'), allowNull: false, defaultValue: 'CHAT' },
  createdByUserId: { type: DataTypes.UUID, allowNull: true, field: 'created_by_user_id' },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true, field: 'is_active' },
  type: { type: DataTypes.VIRTUAL, get() { return 'WARD'; } },
  channel: { type: DataTypes.VIRTUAL, get() { return 'ALL'; } },
}, { tableName: 'all_chats', underscored: true });

module.exports = AllChat;
