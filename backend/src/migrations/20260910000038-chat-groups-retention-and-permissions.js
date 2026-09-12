'use strict';
const { QueryTypes } = require('sequelize');

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      "ALTER TABLE ward_chat_groups MODIFY COLUMN type ENUM('WARD','NAGARSEVAK','CUSTOM') NOT NULL"
    );
    const columns = await queryInterface.describeTable('ward_chat_groups');
    if (!columns.mode) {
      await queryInterface.addColumn('ward_chat_groups', 'mode', { type: Sequelize.ENUM('CHAT','BROADCAST'), allowNull: false, defaultValue: 'CHAT' });
    }

    const roleRows = await queryInterface.sequelize.query(
      "SELECT id FROM roles WHERE name='NAGARSEVAK' LIMIT 1",
      { type: QueryTypes.SELECT }
    );
    if (roleRows.length) {
      const users = await queryInterface.sequelize.query(
        "SELECT id, permissions FROM users WHERE role_id=:roleId AND status='ACTIVE' AND deleted_at IS NULL",
        { replacements: { roleId: roleRows[0].id }, type: QueryTypes.SELECT }
      );
      for (const u of users) {
        let permissions = [];
        try { permissions = Array.isArray(u.permissions) ? u.permissions : JSON.parse(u.permissions || '[]'); } catch (_) {}
        permissions = [...new Set([...permissions, 'VIEW_CHAT', 'SEND_CHAT', 'CREATE_CHAT_GROUP', 'MANAGE_CHAT_GROUP'])];
        await queryInterface.sequelize.query(
          'UPDATE users SET permissions=:permissions WHERE id=:id',
          { replacements: { id: u.id, permissions: JSON.stringify(permissions) } }
        );
      }
    }
  },
  async down(queryInterface) {
    const columns = await queryInterface.describeTable('ward_chat_groups');
    if (columns.mode) await queryInterface.removeColumn('ward_chat_groups', 'mode');
    await queryInterface.sequelize.query(
      "ALTER TABLE ward_chat_groups MODIFY COLUMN type ENUM('WARD','NAGARSEVAK') NOT NULL"
    );
  }
};
