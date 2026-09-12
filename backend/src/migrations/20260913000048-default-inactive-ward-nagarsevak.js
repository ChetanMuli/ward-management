'use strict';

/** Default-closed wards and Nagarsevaks until Master Admin activates them. */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE wards
      SET status = 'INACTIVE', updated_at = NOW()
      WHERE deleted_at IS NULL
        AND activated_at IS NULL
        AND status = 'ACTIVE'
    `);

    await queryInterface.sequelize.query(`
      INSERT INTO ward_nagarsevak_subscriptions
        (id, ward_id, nagarsevak_user_id, status, created_at, updated_at)
      SELECT UUID(), u.ward_id, u.id, 'PENDING', NOW(), NOW()
      FROM users u
      INNER JOIN roles r ON r.id = u.role_id AND r.name = 'NAGARSEVAK'
      WHERE u.ward_id IS NOT NULL
        AND u.deleted_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM ward_nagarsevak_subscriptions s
          WHERE s.nagarsevak_user_id = u.id AND s.ward_id = u.ward_id
        )
    `);

    await queryInterface.sequelize.query(`
      UPDATE users u
      INNER JOIN roles r ON r.id = u.role_id AND r.name = 'NAGARSEVAK'
      LEFT JOIN ward_nagarsevak_subscriptions s
        ON s.nagarsevak_user_id = u.id AND s.ward_id = u.ward_id AND s.status = 'ACTIVE'
      SET u.status = 'INACTIVE', u.updated_at = NOW()
      WHERE u.deleted_at IS NULL
        AND s.id IS NULL
        AND u.status = 'ACTIVE'
    `);

    await queryInterface.sequelize.query(`
      UPDATE nagarsevak_users nu
      LEFT JOIN ward_nagarsevak_subscriptions s
        ON s.nagarsevak_user_id = nu.id AND s.ward_id = nu.ward_id AND s.status = 'ACTIVE'
      SET nu.status = 'INACTIVE', nu.updated_at = NOW()
      WHERE nu.deleted_at IS NULL
        AND s.id IS NULL
        AND nu.status = 'ACTIVE'
    `);
  },

  async down() {
    // Intentionally empty: activation is an operational choice, not a reversible default.
  },
};
