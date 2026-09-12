'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const wardCols = await queryInterface.describeTable('wards');
    if (!wardCols.activated_at) {
      await queryInterface.addColumn('wards', 'activated_at', { type: Sequelize.DATE, allowNull: true });
    }
    if (!wardCols.activated_by) {
      await queryInterface.addColumn('wards', 'activated_by', { type: Sequelize.UUID, allowNull: true });
    }
    if (!wardCols.deactivated_at) {
      await queryInterface.addColumn('wards', 'deactivated_at', { type: Sequelize.DATE, allowNull: true });
    }
    if (!wardCols.deactivated_by) {
      await queryInterface.addColumn('wards', 'deactivated_by', { type: Sequelize.UUID, allowNull: true });
    }

    const tables = await queryInterface.showAllTables();
    const names = tables.map((t) => (typeof t === 'string' ? t : t.tableName || t.name || '')).map((n) => String(n).toLowerCase());
    if (!names.includes('ward_nagarsevak_subscriptions')) {
      await queryInterface.createTable('ward_nagarsevak_subscriptions', {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        ward_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'wards', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        nagarsevak_user_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        status: {
          type: Sequelize.ENUM('PENDING', 'ACTIVE', 'INACTIVE', 'DEACTIVATED'),
          allowNull: false,
          defaultValue: 'PENDING',
        },
        purchased_at: { type: Sequelize.DATE, allowNull: true },
        activated_at: { type: Sequelize.DATE, allowNull: true },
        activated_by: { type: Sequelize.UUID, allowNull: true },
        deactivated_at: { type: Sequelize.DATE, allowNull: true },
        deactivated_by: { type: Sequelize.UUID, allowNull: true },
        notes: { type: Sequelize.TEXT, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false },
        updated_at: { type: Sequelize.DATE, allowNull: false },
      });
      await queryInterface.addIndex('ward_nagarsevak_subscriptions', ['ward_id', 'nagarsevak_user_id'], {
        unique: true,
        name: 'ward_nagar_sub_unique',
      });
      await queryInterface.addIndex('ward_nagarsevak_subscriptions', ['ward_id', 'status'], {
        name: 'ward_nagar_sub_ward_status',
      });
      await queryInterface.addIndex('ward_nagarsevak_subscriptions', ['nagarsevak_user_id'], {
        name: 'ward_nagar_sub_user',
      });
    }

    await queryInterface.sequelize.query(
      "UPDATE wards SET activated_at = COALESCE(activated_at, created_at), status = COALESCE(status, 'ACTIVE') WHERE status = 'ACTIVE' AND activated_at IS NULL"
    );
  },

  async down(queryInterface) {
    const tables = await queryInterface.showAllTables();
    const names = tables.map((t) => (typeof t === 'string' ? t : t.tableName || t.name || '')).map((n) => String(n).toLowerCase());
    if (names.includes('ward_nagarsevak_subscriptions')) {
      await queryInterface.dropTable('ward_nagarsevak_subscriptions');
    }
    const wardCols = await queryInterface.describeTable('wards');
    if (wardCols.deactivated_by) await queryInterface.removeColumn('wards', 'deactivated_by');
    if (wardCols.deactivated_at) await queryInterface.removeColumn('wards', 'deactivated_at');
    if (wardCols.activated_by) await queryInterface.removeColumn('wards', 'activated_by');
    if (wardCols.activated_at) await queryInterface.removeColumn('wards', 'activated_at');
  },
};
