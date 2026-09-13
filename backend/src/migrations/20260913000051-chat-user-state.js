"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const [rows] = await queryInterface.sequelize.query(
      `SELECT 1 AS ok FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'chat_user_state' LIMIT 1`
    );
    if (rows.length) return;
    await queryInterface.createTable('chat_user_state', {
      id: { type: Sequelize.UUID, primaryKey: true },
      group_id: { type: Sequelize.UUID, allowNull: false },
      user_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
      last_read_at: { type: Sequelize.DATE, allowNull: true },
      last_cleared_at: { type: Sequelize.DATE, allowNull: true },
    });
    await queryInterface.addIndex('chat_user_state', ['group_id', 'user_id'], {
      unique: true,
      name: 'chat_user_state_unique',
    });
    await queryInterface.addIndex('chat_user_state', ['user_id'], { name: 'chat_user_state_user_idx' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('chat_user_state');
  },
};
