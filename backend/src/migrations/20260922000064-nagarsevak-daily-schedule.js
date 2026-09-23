'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    const names = tables
      .map((t) => (typeof t === 'string' ? t : t.tableName || t.name || ''))
      .map((n) => String(n).toLowerCase());

    if (!names.includes('nagarsevak_schedules')) {
      await queryInterface.createTable('nagarsevak_schedules', {
        id: {
          type: Sequelize.UUID,
          primaryKey: true,
          allowNull: false,
          defaultValue: Sequelize.UUIDV4,
        },
        nagarsevak_user_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        created_by_user_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        ward_id: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'wards', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        title: {
          type: Sequelize.STRING(255),
          allowNull: false,
        },
        description: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        scheduled_date: {
          type: Sequelize.DATEONLY,
          allowNull: false,
        },
        scheduled_time: {
          type: Sequelize.STRING(50),
          allowNull: true,
        },
        location: {
          type: Sequelize.STRING(255),
          allowNull: true,
        },
        category: {
          type: Sequelize.ENUM('VISIT', 'MEETING', 'INSPECTION', 'EVENT', 'CITIZEN_HEARING', 'OTHER'),
          allowNull: false,
          defaultValue: 'VISIT',
        },
        priority: {
          type: Sequelize.ENUM('URGENT', 'HIGH', 'MEDIUM', 'LOW'),
          allowNull: false,
          defaultValue: 'MEDIUM',
        },
        status: {
          type: Sequelize.ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'),
          allowNull: false,
          defaultValue: 'PENDING',
        },
        completed_at: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        completed_by_user_id: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        completion_note: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
        },
        deleted_at: {
          type: Sequelize.DATE,
          allowNull: true,
        },
      });

      await queryInterface.addIndex('nagarsevak_schedules', ['nagarsevak_user_id']);
      await queryInterface.addIndex('nagarsevak_schedules', ['scheduled_date']);
      await queryInterface.addIndex('nagarsevak_schedules', ['status']);
      await queryInterface.addIndex('nagarsevak_schedules', ['ward_id']);
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('nagarsevak_schedules');
  },
};
