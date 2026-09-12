'use strict';

module.exports = {
  async up(queryInterface) {
    const chatColumns = await queryInterface.describeTable('ward_chat_messages');
    if (chatColumns.message_type) {
      await queryInterface.sequelize.query(
        "ALTER TABLE ward_chat_messages MODIFY COLUMN message_type ENUM('TEXT','IMAGE','PDF','VIDEO') NOT NULL DEFAULT 'TEXT'"
      );
    }
  },

  async down(queryInterface) {
    const chatColumns = await queryInterface.describeTable('ward_chat_messages');
    if (chatColumns.message_type) {
      await queryInterface.sequelize.query(
        "UPDATE ward_chat_messages SET message_type = 'PDF' WHERE message_type = 'VIDEO'"
      );
      await queryInterface.sequelize.query(
        "ALTER TABLE ward_chat_messages MODIFY COLUMN message_type ENUM('TEXT','IMAGE','PDF') NOT NULL DEFAULT 'TEXT'"
      );
    }
  },
};
