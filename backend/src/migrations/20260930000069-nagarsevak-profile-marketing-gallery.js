'use strict';

async function addIfMissing(queryInterface, table, column, spec) {
  const desc = await queryInterface.describeTable(table);
  if (!desc[column]) await queryInterface.addColumn(table, column, spec);
}

async function dropIfPresent(queryInterface, table, column) {
  const desc = await queryInterface.describeTable(table);
  if (desc[column]) await queryInterface.removeColumn(table, column);
}

module.exports = {
  async up(queryInterface, Sequelize) {
    await addIfMissing(queryInterface, 'nagarsevak_users', 'bio', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await addIfMissing(queryInterface, 'nagarsevak_users', 'office_timings', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
    await addIfMissing(queryInterface, 'nagarsevak_users', 'whatsapp', {
      type: Sequelize.STRING(50),
      allowNull: true,
    });
    await addIfMissing(queryInterface, 'nagarsevak_users', 'gallery', {
      type: Sequelize.TEXT('long'),
      allowNull: true,
    });
    await addIfMissing(queryInterface, 'nagarsevak_users', 'achievements', {
      type: Sequelize.TEXT('long'),
      allowNull: true,
    });
    await addIfMissing(queryInterface, 'nagarsevak_users', 'social_links', {
      type: Sequelize.TEXT('long'),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await dropIfPresent(queryInterface, 'nagarsevak_users', 'social_links');
    await dropIfPresent(queryInterface, 'nagarsevak_users', 'achievements');
    await dropIfPresent(queryInterface, 'nagarsevak_users', 'gallery');
    await dropIfPresent(queryInterface, 'nagarsevak_users', 'whatsapp');
    await dropIfPresent(queryInterface, 'nagarsevak_users', 'office_timings');
    await dropIfPresent(queryInterface, 'nagarsevak_users', 'bio');
  },
};
