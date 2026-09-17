const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const WardSubscriptionEvent = sequelize.define('WardSubscriptionEvent', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  subscriptionId: { type: DataTypes.UUID, allowNull: false, field: 'subscription_id' },
  wardId: { type: DataTypes.UUID, allowNull: false, field: 'ward_id' },
  nagarsevakUserId: { type: DataTypes.UUID, allowNull: false, field: 'nagarsevak_user_id' },
  action: {
    type: DataTypes.ENUM(
      'CREATED',
      'ACTIVATED',
      'DEACTIVATED',
      'REACTIVATED',
      'YEAR_ENDED_NOTIFIED',
      'NOTES_UPDATED'
    ),
    allowNull: false,
  },
  fromStatus: { type: DataTypes.STRING(32), allowNull: true, field: 'from_status' },
  toStatus: { type: DataTypes.STRING(32), allowNull: true, field: 'to_status' },
  actedBy: { type: DataTypes.UUID, allowNull: true, field: 'acted_by' },
  actedAt: { type: DataTypes.DATE, allowNull: false, field: 'acted_at' },
  notes: { type: DataTypes.TEXT, allowNull: true },
}, {
  tableName: 'ward_subscription_events',
  underscored: true,
  indexes: [
    { fields: ['subscription_id', 'acted_at'] },
    { fields: ['ward_id', 'acted_at'] },
    { fields: ['nagarsevak_user_id'] },
    { fields: ['action'] },
  ],
});

module.exports = WardSubscriptionEvent;
