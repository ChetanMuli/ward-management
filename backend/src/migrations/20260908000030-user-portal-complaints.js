'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const users = await queryInterface.describeTable('users');
    const complaints = await queryInterface.describeTable('complaints');

    if (users.status) {
      await queryInterface.changeColumn('users', 'status', {
        type: Sequelize.ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED', 'DELETED'),
        allowNull: false,
        defaultValue: 'ACTIVE',
      });
    }

    if (complaints.citizen_person_id) {
      await queryInterface.changeColumn('complaints', 'citizen_person_id', {
        type: Sequelize.UUID,
        allowNull: true,
      });
    }
    if (complaints.house_id) {
      await queryInterface.changeColumn('complaints', 'house_id', {
        type: Sequelize.UUID,
        allowNull: true,
      });
    }

    const add = async (table, name, definition) => {
      const desc = await queryInterface.describeTable(table);
      if (!desc[name]) await queryInterface.addColumn(table, name, definition);
    };

    await add('complaints', 'submitted_by_user_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    });
    await add('complaints', 'ward_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'wards', key: 'id' },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    });
    await add('complaints', 'assigned_nagarsevak_user_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    });
    await add('complaints', 'location', {
      type: Sequelize.STRING(500),
      allowNull: true,
    });

    const indexes = await queryInterface.showIndex('complaints');
    const names = new Set(indexes.map(i => i.name));
    if (!names.has('idx_complaints_submitted_by_user')) {
      await queryInterface.addIndex('complaints', ['submitted_by_user_id'], { name: 'idx_complaints_submitted_by_user' });
    }
    if (!names.has('idx_complaints_ward_id')) {
      await queryInterface.addIndex('complaints', ['ward_id'], { name: 'idx_complaints_ward_id' });
    }
    if (!names.has('idx_complaints_assigned_nagarsevak')) {
      await queryInterface.addIndex('complaints', ['assigned_nagarsevak_user_id'], { name: 'idx_complaints_assigned_nagarsevak' });
    }
  },

  async down(queryInterface, Sequelize) {
    const complaints = await queryInterface.describeTable('complaints');
    const users = await queryInterface.describeTable('users');
    for (const name of ['idx_complaints_assigned_nagarsevak','idx_complaints_ward_id','idx_complaints_submitted_by_user']) {
      try { await queryInterface.removeIndex('complaints', name); } catch (_) {}
    }
    for (const name of ['submitted_by_user_id','ward_id','assigned_nagarsevak_user_id','location']) {
      if (complaints[name]) await queryInterface.removeColumn('complaints', name);
    }
    if (complaints.citizen_person_id) await queryInterface.changeColumn('complaints', 'citizen_person_id', { type: Sequelize.UUID, allowNull: false });
    if (complaints.house_id) await queryInterface.changeColumn('complaints', 'house_id', { type: Sequelize.UUID, allowNull: false });
    if (users.status) await queryInterface.changeColumn('users', 'status', { type: Sequelize.ENUM('ACTIVE','INACTIVE','SUSPENDED'), allowNull:false, defaultValue:'ACTIVE' });
  }
};
