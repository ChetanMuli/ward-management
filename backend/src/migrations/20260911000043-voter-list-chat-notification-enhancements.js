'use strict';
const { QueryTypes } = require('sequelize');

module.exports = {
  async up(queryInterface, Sequelize) {
    const hasColumn = async (table, column) => {
      const columns = await queryInterface.describeTable(table);
      return !!columns[column];
    };

    if (!(await hasColumn('government_voter_lists', 'ward_ids'))) {
      await queryInterface.addColumn('government_voter_lists', 'ward_ids', {
        type: Sequelize.JSON, allowNull: false, defaultValue: [],
      });
    }
    if (!(await hasColumn('government_voter_lists', 'assignment_mode'))) {
      await queryInterface.addColumn('government_voter_lists', 'assignment_mode', {
        type: Sequelize.ENUM('UPLOADER_ONLY', 'ALL_NAGARSEVAKS', 'SPECIFIC_NAGARSEVAKS'),
        allowNull: false, defaultValue: 'UPLOADER_ONLY',
      });
    }
    if (!(await hasColumn('government_voter_lists', 'assigned_nagarsevak_ids'))) {
      await queryInterface.addColumn('government_voter_lists', 'assigned_nagarsevak_ids', {
        type: Sequelize.JSON, allowNull: false, defaultValue: [],
      });
    }

    if (!(await hasColumn('notifications', 'action_url'))) {
      await queryInterface.addColumn('notifications', 'action_url', {
        type: Sequelize.STRING(500), allowNull: true,
      });
    }

    // Backfill scope for lists previously uploaded by a Nagarsevak.
    const legacy = await queryInterface.sequelize.query(
      `SELECT g.id, g.uploaded_by, u.ward_id, r.name AS role_name
         FROM government_voter_lists g
         JOIN users u ON u.id = g.uploaded_by
         JOIN roles r ON r.id = u.role_id
        WHERE r.name = 'NAGARSEVAK'`,
      { type: QueryTypes.SELECT }
    );
    for (const row of legacy) {
      if (row.ward_id) {
        await queryInterface.sequelize.query(
          `UPDATE government_voter_lists
              SET ward_ids=:wardIds, assignment_mode='UPLOADER_ONLY', assigned_nagarsevak_ids=:assigned
            WHERE id=:id`,
          {
            replacements: {
              id: row.id,
              wardIds: JSON.stringify([String(row.ward_id)]),
              assigned: JSON.stringify([String(row.uploaded_by)]),
            },
          }
        );
      }
    }

    const chatColumns = await queryInterface.describeTable('ward_chat_messages');
    if (chatColumns.message_type) {
      await queryInterface.sequelize.query(
        "ALTER TABLE ward_chat_messages MODIFY COLUMN message_type ENUM('TEXT','IMAGE','PDF') NOT NULL DEFAULT 'TEXT'"
      );
    }
  },

  async down(queryInterface) {
    const hasColumn = async (table, column) => {
      const columns = await queryInterface.describeTable(table);
      return !!columns[column];
    };
    if (await hasColumn('notifications', 'action_url')) await queryInterface.removeColumn('notifications', 'action_url');
    if (await hasColumn('government_voter_lists', 'assigned_nagarsevak_ids')) await queryInterface.removeColumn('government_voter_lists', 'assigned_nagarsevak_ids');
    if (await hasColumn('government_voter_lists', 'assignment_mode')) await queryInterface.removeColumn('government_voter_lists', 'assignment_mode');
    if (await hasColumn('government_voter_lists', 'ward_ids')) await queryInterface.removeColumn('government_voter_lists', 'ward_ids');
    const chatColumns = await queryInterface.describeTable('ward_chat_messages');
    if (chatColumns.message_type) {
      await queryInterface.sequelize.query(
        "ALTER TABLE ward_chat_messages MODIFY COLUMN message_type ENUM('TEXT','IMAGE') NOT NULL DEFAULT 'TEXT'"
      );
    }
  },
};
