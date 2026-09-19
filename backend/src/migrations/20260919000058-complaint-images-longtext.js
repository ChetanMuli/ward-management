'use strict';

const { DataTypes } = require('sequelize');

module.exports = {
  async up(queryInterface) {
    const desc = await queryInterface.describeTable('complaints');
    if (desc.reported_image) {
      await queryInterface.changeColumn('complaints', 'reported_image', { type: DataTypes.TEXT('long'), allowNull: true });
    }
    if (desc.resolution_image) {
      await queryInterface.changeColumn('complaints', 'resolution_image', { type: DataTypes.TEXT('long'), allowNull: true });
    }
  },
  async down() {},
};
