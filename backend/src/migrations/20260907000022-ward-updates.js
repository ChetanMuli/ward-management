'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const { DataTypes } = Sequelize;
    const tables = (await queryInterface.showAllTables()).map(String).map(x => x.toLowerCase());
    if (tables.includes('ward_updates')) return;

    await queryInterface.createTable('ward_updates', {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
      ward_id: {
        type: DataTypes.UUID, allowNull: false,
        references: { model: 'wards', key: 'id' },
        onDelete: 'RESTRICT', onUpdate: 'CASCADE'
      },
      type: {
        type: DataTypes.ENUM('WARD_UPDATE', 'EVENT'),
        allowNull: false, defaultValue: 'WARD_UPDATE'
      },
      title: { type: DataTypes.STRING(180), allowNull: false },
      message: { type: DataTypes.TEXT, allowNull: false },
      event_date: { type: DataTypes.DATE, allowNull: true },
      location: { type: DataTypes.STRING(300), allowNull: true },
      audience: {
        type: DataTypes.ENUM('CITIZEN', 'NAGARSEVAK', 'EMPLOYEE', 'ALL_STAFF'),
        allowNull: false, defaultValue: 'CITIZEN'
      },
      status: {
        type: DataTypes.ENUM('PUBLISHED', 'ARCHIVED'),
        allowNull: false, defaultValue: 'PUBLISHED'
      },
      published_at: { type: DataTypes.DATE, allowNull: true },
      created_by_user_id: {
        type: DataTypes.UUID, allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'RESTRICT', onUpdate: 'CASCADE'
      },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP') }
    });
    await queryInterface.addIndex('ward_updates', ['ward_id']);
    await queryInterface.addIndex('ward_updates', ['status']);
    await queryInterface.addIndex('ward_updates', ['type']);
    await queryInterface.addIndex('ward_updates', ['created_by_user_id']);
  },

  down: async (queryInterface) => {
    const tables = (await queryInterface.showAllTables()).map(String).map(x => x.toLowerCase());
    if (tables.includes('ward_updates')) await queryInterface.dropTable('ward_updates');
  }
};
