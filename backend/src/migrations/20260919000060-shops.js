'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    const names = tables.map((t) => (typeof t === 'string' ? t : t.tableName || t.name || '')).map((n) => String(n).toLowerCase());
    if (names.includes('shops')) return;
    await queryInterface.createTable('shops', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
      area_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'areas', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      name: { type: Sequelize.STRING, allowNull: false },
      kind: { type: Sequelize.ENUM('SHOP', 'OFFICE'), allowNull: false, defaultValue: 'SHOP' },
      category: { type: Sequelize.STRING, allowNull: true },
      address: { type: Sequelize.TEXT, allowNull: false },
      landmark: { type: Sequelize.STRING, allowNull: true },
      owner_name: { type: Sequelize.STRING, allowNull: true },
      owner_mobile: { type: Sequelize.STRING, allowNull: true },
      gst_number: { type: Sequelize.STRING, allowNull: true },
      license_number: { type: Sequelize.STRING, allowNull: true },
      opening_hours: { type: Sequelize.STRING, allowNull: true },
      latitude: { type: Sequelize.DECIMAL(10, 7), allowNull: true },
      longitude: { type: Sequelize.DECIMAL(10, 7), allowNull: true },
      notes: { type: Sequelize.TEXT, allowNull: true },
      status: { type: Sequelize.ENUM('ACTIVE', 'INACTIVE'), allowNull: false, defaultValue: 'ACTIVE' },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
      deleted_at: { type: Sequelize.DATE, allowNull: true },
    });
    await queryInterface.addIndex('shops', ['area_id']);
    await queryInterface.addIndex('shops', ['kind']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('shops');
  },
};
