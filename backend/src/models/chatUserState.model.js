const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

module.exports = sequelize.define('ChatUserState', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  groupId: { type: DataTypes.UUID, allowNull: false, field: 'group_id' },
  userId: { type: DataTypes.UUID, allowNull: false, field: 'user_id' },
  lastReadAt: { type: DataTypes.DATE, allowNull: true, field: 'last_read_at' },
  lastClearedAt: { type: DataTypes.DATE, allowNull: true, field: 'last_cleared_at' },
}, {
  tableName: 'chat_user_state',
  timestamps: false,
  indexes: [{ unique: true, fields: ['group_id', 'user_id'], name: 'chat_user_state_unique' }],
});
