'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    const names = tables.map(String).map(x => x.toLowerCase());
    if (names.includes('government_voter_lists')) return;

    await queryInterface.createTable('government_voter_lists', {
      id: { type: Sequelize.UUID, allowNull: false, primaryKey: true },
      original_file_name: { type: Sequelize.STRING(255), allowNull: false },
      stored_file_name: { type: Sequelize.STRING(255), allowNull: false, unique: true },
      mime_type: { type: Sequelize.STRING(120), allowNull: false },
      file_type: { type: Sequelize.ENUM('PDF','XLSX','CSV'), allowNull: false },
      file_size: { type: Sequelize.BIGINT, allowNull: false, defaultValue: 0 },
      extracted_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      extracted_data: { type: Sequelize.JSON, allowNull: false },
      uploaded_by: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'RESTRICT', onUpdate: 'CASCADE',
      },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('government_voter_lists', ['uploaded_by']);
    await queryInterface.addIndex('government_voter_lists', ['created_at']);
  },

  down: async (queryInterface) => {
    const tables = await queryInterface.showAllTables();
    const names = tables.map(String).map(x => x.toLowerCase());
    if (names.includes('government_voter_lists')) await queryInterface.dropTable('government_voter_lists');
  },
};
