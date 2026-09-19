'use strict';

async function addIfMissing(queryInterface, table, column, spec) {
  const desc = await queryInterface.describeTable(table);
  if (!desc[column]) await queryInterface.addColumn(table, column, spec);
}

module.exports = {
  async up(queryInterface, Sequelize) {
    await addIfMissing(queryInterface, 'shops', 'ownership', {
      type: Sequelize.ENUM('OWN', 'RENT', 'OTHER'),
      allowNull: true,
    });
    await addIfMissing(queryInterface, 'person_birthdays', 'notified_on', {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    const shops = await queryInterface.describeTable('shops').catch(() => ({}));
    if (shops.ownership) await queryInterface.removeColumn('shops', 'ownership');
    const days = await queryInterface.describeTable('person_birthdays').catch(() => ({}));
    if (days.notified_on) await queryInterface.removeColumn('person_birthdays', 'notified_on');
  },
};
