const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

module.exports = sequelize.define('AllChatMessage', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  groupId: { type: DataTypes.UUID, allowNull: false, field: 'group_id' },
  senderUserId: { type: DataTypes.UUID, allowNull: false, field: 'sender_user_id' },
  recipientUserId: { type: DataTypes.UUID, allowNull: true, field: 'recipient_user_id' },
  messageType: { type: DataTypes.ENUM('TEXT', 'IMAGE', 'PDF', 'VIDEO'), defaultValue: 'TEXT', field: 'message_type' },
  content: { type: DataTypes.TEXT, allowNull: true },
  imageMime: { type: DataTypes.STRING, allowNull: true, field: 'image_mime' },
  imagePath: { type: DataTypes.STRING(500), allowNull: true, field: 'image_path' },
}, { tableName: 'all_chat_messages', underscored: true });
