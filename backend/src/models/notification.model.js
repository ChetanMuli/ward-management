const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Notification = sequelize.define('Notification', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.UUID, allowNull: false },
  senderUserId: { type: DataTypes.UUID, allowNull: true },
  type: { type: DataTypes.STRING, allowNull: false }, // e.g. '18PLUS_REMINDER', 'COMPLAINT_ASSIGNED'
  channel: {
    type: DataTypes.ENUM('IN_APP', 'PUSH', 'SMS', 'WHATSAPP', 'EMAIL'),
    defaultValue: 'IN_APP',
  },
  title: { type: DataTypes.STRING, allowNull: false },
  message: { type: DataTypes.TEXT, allowNull: false },
  isRead: { type: DataTypes.BOOLEAN, defaultValue: false },
  sentAt: DataTypes.DATE,
  actionUrl: { type: DataTypes.STRING(500), allowNull: true, field: 'action_url' },
}, { tableName: 'notifications' });

module.exports = Notification;
