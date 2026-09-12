'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const [roles] = await queryInterface.sequelize.query(
      "SELECT id FROM roles WHERE name='SUB_MASTER_ADMIN' LIMIT 1"
    );
    if (!roles.length) {
      await queryInterface.sequelize.query(
        "INSERT INTO roles (id, name, description, created_at, updated_at) VALUES (UUID(), 'SUB_MASTER_ADMIN', 'Admin account with permissions granted by the Master Admin', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
      );
    }
  },
  down: async (queryInterface) => {
    await queryInterface.sequelize.query("DELETE FROM roles WHERE name='SUB_MASTER_ADMIN'");
  }
};
