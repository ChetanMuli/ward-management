const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

module.exports = sequelize.define('AllChatMember', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  groupId: { type: DataTypes.UUID, allowNull: false, field: 'group_id' },
  userId: { type: DataTypes.UUID, allowNull: false, field: 'user_id' },
  joinedAt: { type: DataTypes.DATE, field: 'joined_at' },
  lastReadAt: { type: DataTypes.DATE, allowNull: true, field: 'last_read_at' },
  lastClearedAt: { type: DataTypes.DATE, allowNull: true, field: 'last_cleared_at' },
}, { tableName: 'all_chat_members', timestamps: false });
