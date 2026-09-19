'use strict';

async function addIfMissing(queryInterface, table, column, spec) {
  const desc = await queryInterface.describeTable(table);
  if (!desc[column]) await queryInterface.addColumn(table, column, spec);
}

module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    const names = tables.map((t) => (typeof t === 'string' ? t : t.tableName || t.name || '')).map((n) => String(n).toLowerCase());
    if (!names.includes('apartments')) {
      await queryInterface.createTable('apartments', {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        ward_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'wards', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
        area_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'areas', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
        name: { type: Sequelize.STRING, allowNull: false },
        address: { type: Sequelize.TEXT, allowNull: true },
        landmark: { type: Sequelize.STRING, allowNull: true },
        floors: { type: Sequelize.INTEGER, allowNull: true },
        notes: { type: Sequelize.TEXT, allowNull: true },
        latitude: { type: Sequelize.DECIMAL(10, 7), allowNull: true },
        longitude: { type: Sequelize.DECIMAL(10, 7), allowNull: true },
        status: { type: Sequelize.ENUM('ACTIVE', 'INACTIVE'), allowNull: false, defaultValue: 'ACTIVE' },
        created_at: { type: Sequelize.DATE, allowNull: false },
        updated_at: { type: Sequelize.DATE, allowNull: false },
        deleted_at: { type: Sequelize.DATE, allowNull: true },
      });
      await queryInterface.addIndex('apartments', ['ward_id']);
      await queryInterface.addIndex('apartments', ['area_id']);
    }
    await addIfMissing(queryInterface, 'houses', 'apartment_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'apartments', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
  },

  async down(queryInterface) {
    const desc = await queryInterface.describeTable('houses');
    if (desc.apartment_id) await queryInterface.removeColumn('houses', 'apartment_id');
    await queryInterface.dropTable('apartments');
  },
};
