'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Migration 41 introduced MLA/MP roles and seeded public representative
    // accounts. This migration intentionally removes that feature completely.
    // It is safe for both the current production database and fresh installs
    // where migration 41 has already run.
    await queryInterface.sequelize.query(`
      DELETE u FROM users u
      INNER JOIN roles r ON r.id = u.role_id
      WHERE r.name IN ('MLA', 'MP')
    `);

    await queryInterface.sequelize.query(`
      DELETE FROM roles
      WHERE name IN ('MLA', 'MP')
    `);

    const desc = await queryInterface.describeTable('users');
    if (desc.constituency) {
      await queryInterface.removeColumn('users', 'constituency');
    }

    await queryInterface.sequelize.query(
      "ALTER TABLE roles MODIFY name ENUM('SUPER_ADMIN','SUB_MASTER_ADMIN','NAGARSEVAK','EMPLOYEE','CITIZEN','SOCIAL_WORKER','CANDIDATE') NOT NULL"
    );
  },

  async down(queryInterface) {
    // Intentionally non-restoring. The MLA/MP feature has been removed.
  },
};
