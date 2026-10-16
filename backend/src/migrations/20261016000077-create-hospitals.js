'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    const names = tables.map((t) => (typeof t === 'string' ? t : t.tableName || t.name || '')).map((n) => String(n).toLowerCase());
    if (names.includes('hospitals')) return;

    await queryInterface.createTable('hospitals', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
      ward_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'wards', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      area_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'areas', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      name: { type: Sequelize.STRING, allowNull: false },
      type: {
        type: Sequelize.ENUM('GOVERNMENT', 'PRIVATE', 'TRUST', 'CLINIC', 'PHC', 'AYUSH', 'OTHER'),
        allowNull: false,
        defaultValue: 'PRIVATE',
      },
      address: { type: Sequelize.TEXT, allowNull: true },
      landmark: { type: Sequelize.STRING, allowNull: true },
      phone: { type: Sequelize.STRING, allowNull: true },
      emergency_phone: { type: Sequelize.STRING, allowNull: true },
      opening_hours: { type: Sequelize.STRING, allowNull: true },
      facilities: { type: Sequelize.TEXT, allowNull: true },
      latitude: { type: Sequelize.DECIMAL(10, 7), allowNull: true },
      longitude: { type: Sequelize.DECIMAL(10, 7), allowNull: true },
      notes: { type: Sequelize.TEXT, allowNull: true },
      status: {
        type: Sequelize.ENUM('ACTIVE', 'INACTIVE'),
        allowNull: false,
        defaultValue: 'ACTIVE',
      },
      created_by_user_id: { type: Sequelize.UUID, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
      deleted_at: { type: Sequelize.DATE, allowNull: true },
    });
    await queryInterface.addIndex('hospitals', ['ward_id', 'status', 'deleted_at'], { name: 'idx_hospitals_ward_status_del' });
    await queryInterface.addIndex('hospitals', ['ward_id', 'type', 'status', 'deleted_at'], { name: 'idx_hospitals_ward_type_status' });
    await queryInterface.addIndex('hospitals', ['area_id', 'status', 'deleted_at'], { name: 'idx_hospitals_area_status_del' });
    await queryInterface.addIndex('hospitals', ['name'], { name: 'idx_hospitals_name' });
    await queryInterface.addIndex('hospitals', ['phone'], { name: 'idx_hospitals_phone' });
    await queryInterface.addIndex('hospitals', ['deleted_at'], { name: 'idx_hospitals_deleted' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('hospitals');
  },
};
