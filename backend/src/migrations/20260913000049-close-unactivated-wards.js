'use strict';

/** Close wards that were never opened by Master Admin (seeded activated_at does not count). */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE wards
      SET status = 'INACTIVE', deactivated_at = NOW(), updated_at = NOW()
      WHERE deleted_at IS NULL
        AND status = 'ACTIVE'
        AND activated_by IS NULL
    `);
  },

  async down() {},
};
