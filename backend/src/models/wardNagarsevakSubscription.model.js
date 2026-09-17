const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const WardNagarsevakSubscription = sequelize.define('WardNagarsevakSubscription', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  wardId: { type: DataTypes.UUID, allowNull: false, field: 'ward_id' },
  nagarsevakUserId: { type: DataTypes.UUID, allowNull: false, field: 'nagarsevak_user_id' },
  status: {
    type: DataTypes.ENUM('PENDING', 'ACTIVE', 'INACTIVE', 'DEACTIVATED'),
    allowNull: false,
    defaultValue: 'PENDING',
  },
  purchasedAt: { type: DataTypes.DATE, allowNull: true, field: 'purchased_at' },
  activatedAt: { type: DataTypes.DATE, allowNull: true, field: 'activated_at' },
  activatedBy: { type: DataTypes.UUID, allowNull: true, field: 'activated_by' },
  deactivatedAt: { type: DataTypes.DATE, allowNull: true, field: 'deactivated_at' },
  deactivatedBy: { type: DataTypes.UUID, allowNull: true, field: 'deactivated_by' },
  notes: { type: DataTypes.TEXT, allowNull: true },
  expiryNotifiedAt: { type: DataTypes.DATE, allowNull: true, field: 'expiry_notified_at' },
}, {
  tableName: 'ward_nagarsevak_subscriptions',
  underscored: true,
  indexes: [
    { unique: true, fields: ['ward_id', 'nagarsevak_user_id'] },
    { fields: ['ward_id', 'status'] },
    { fields: ['nagarsevak_user_id'] },
  ],
});

module.exports = WardNagarsevakSubscription;
