"use strict";

async function hasTable(queryInterface, name) {
  const [rows] = await queryInterface.sequelize.query(
    `SELECT 1 AS ok FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1`,
    { replacements: [name] }
  );
  return rows.length > 0;
}

function memberColumns(desc) {
  const cols = ['id', 'group_id', 'user_id', 'joined_at', 'last_read_at'];
  if (desc.last_cleared_at) cols.push('last_cleared_at');
  return cols;
}

function messageColumns(desc) {
  const cols = ['id', 'group_id', 'sender_user_id', 'message_type', 'content', 'image_mime', 'image_path', 'created_at', 'updated_at'];
  if (desc.recipient_user_id) cols.splice(3, 0, 'recipient_user_id');
  return cols;
}

module.exports = {
  async up(queryInterface, Sequelize) {
    const qi = queryInterface;

    if (!(await hasTable(qi, 'all_chats'))) {
      await qi.createTable('all_chats', {
        id: { type: Sequelize.UUID, primaryKey: true },
        ward_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'wards', key: 'id' }, onDelete: 'CASCADE' },
        name: { type: Sequelize.STRING(160), allowNull: false },
        mode: { type: Sequelize.ENUM('CHAT', 'BROADCAST'), allowNull: false, defaultValue: 'CHAT' },
        created_by_user_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
        is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
      await qi.addIndex('all_chats', ['ward_id'], { unique: true, name: 'all_chats_ward_unique' });
    }

    if (!(await hasTable(qi, 'all_chat_members'))) {
      await qi.createTable('all_chat_members', {
        id: { type: Sequelize.UUID, primaryKey: true },
        group_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'all_chats', key: 'id' }, onDelete: 'CASCADE' },
        user_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
        joined_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        last_read_at: { type: Sequelize.DATE, allowNull: true },
        last_cleared_at: { type: Sequelize.DATE, allowNull: true },
      });
      await qi.addIndex('all_chat_members', ['group_id', 'user_id'], { unique: true, name: 'all_chat_members_unique' });
      await qi.addIndex('all_chat_members', ['user_id'], { name: 'all_chat_members_user_idx' });
    }

    if (!(await hasTable(qi, 'all_chat_messages'))) {
      await qi.createTable('all_chat_messages', {
        id: { type: Sequelize.UUID, primaryKey: true },
        group_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'all_chats', key: 'id' }, onDelete: 'CASCADE' },
        sender_user_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'RESTRICT' },
        recipient_user_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
        message_type: { type: Sequelize.ENUM('TEXT', 'IMAGE', 'PDF', 'VIDEO'), allowNull: false, defaultValue: 'TEXT' },
        content: { type: Sequelize.TEXT, allowNull: true },
        image_mime: { type: Sequelize.STRING(100), allowNull: true },
        image_path: { type: Sequelize.STRING(500), allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
      await qi.addIndex('all_chat_messages', ['group_id', 'created_at'], { name: 'all_chat_messages_group_time_idx' });
    }

    if (!(await hasTable(qi, 'group_chats'))) {
      await qi.createTable('group_chats', {
        id: { type: Sequelize.UUID, primaryKey: true },
        ward_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'wards', key: 'id' }, onDelete: 'CASCADE' },
        name: { type: Sequelize.STRING(160), allowNull: false },
        mode: { type: Sequelize.ENUM('CHAT', 'BROADCAST'), allowNull: false, defaultValue: 'CHAT' },
        type: { type: Sequelize.ENUM('NAGARSEVAK', 'CUSTOM'), allowNull: false },
        nagarsevak_user_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
        created_by_user_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
        is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
      await qi.addIndex('group_chats', ['ward_id', 'type'], { name: 'group_chats_ward_type_idx' });
      await qi.addIndex('group_chats', ['nagarsevak_user_id'], { unique: true, name: 'group_chats_nagarsevak_unique' });
    }

    if (!(await hasTable(qi, 'group_chat_members'))) {
      await qi.createTable('group_chat_members', {
        id: { type: Sequelize.UUID, primaryKey: true },
        group_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'group_chats', key: 'id' }, onDelete: 'CASCADE' },
        user_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
        joined_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        last_read_at: { type: Sequelize.DATE, allowNull: true },
        last_cleared_at: { type: Sequelize.DATE, allowNull: true },
      });
      await qi.addIndex('group_chat_members', ['group_id', 'user_id'], { unique: true, name: 'group_chat_members_unique' });
      await qi.addIndex('group_chat_members', ['user_id'], { name: 'group_chat_members_user_idx' });
    }

    if (!(await hasTable(qi, 'group_chat_messages'))) {
      await qi.createTable('group_chat_messages', {
        id: { type: Sequelize.UUID, primaryKey: true },
        group_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'group_chats', key: 'id' }, onDelete: 'CASCADE' },
        sender_user_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'RESTRICT' },
        recipient_user_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'users', key: 'id' }, onDelete: 'SET NULL' },
        message_type: { type: Sequelize.ENUM('TEXT', 'IMAGE', 'PDF', 'VIDEO'), allowNull: false, defaultValue: 'TEXT' },
        content: { type: Sequelize.TEXT, allowNull: true },
        image_mime: { type: Sequelize.STRING(100), allowNull: true },
        image_path: { type: Sequelize.STRING(500), allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
      await qi.addIndex('group_chat_messages', ['group_id', 'created_at'], { name: 'group_chat_messages_group_time_idx' });
    }

    if (!(await hasTable(qi, 'ward_chat_groups'))) return;

    const groupDesc = await qi.describeTable('ward_chat_groups');
    const memberDesc = await qi.describeTable('ward_chat_group_members');
    const messageDesc = await qi.describeTable('ward_chat_messages');
    const modeExpr = groupDesc.mode ? 'COALESCE(g.mode, \'CHAT\')' : '\'CHAT\'';
    const mCols = memberColumns(memberDesc).join(', ');
    const msgCols = messageColumns(messageDesc).join(', ');

    await qi.sequelize.query(`
      INSERT IGNORE INTO all_chats (id, ward_id, name, mode, created_by_user_id, is_active, created_at, updated_at)
      SELECT g.id, g.ward_id, g.name, ${modeExpr}, g.created_by_user_id, g.is_active, g.created_at, g.updated_at
      FROM ward_chat_groups g
      WHERE g.type = 'WARD'
    `);
    await qi.sequelize.query(`
      INSERT IGNORE INTO group_chats (id, ward_id, name, mode, type, nagarsevak_user_id, created_by_user_id, is_active, created_at, updated_at)
      SELECT g.id, g.ward_id, g.name, ${modeExpr}, g.type, g.nagarsevak_user_id, g.created_by_user_id, g.is_active, g.created_at, g.updated_at
      FROM ward_chat_groups g
      WHERE g.type IN ('NAGARSEVAK', 'CUSTOM')
    `);
    await qi.sequelize.query(`
      INSERT IGNORE INTO all_chat_members (${mCols})
      SELECT ${mCols.replace(/(\w+)/g, 'm.$1')}
      FROM ward_chat_group_members m
      INNER JOIN all_chats c ON c.id = m.group_id
    `);
    await qi.sequelize.query(`
      INSERT IGNORE INTO group_chat_members (${mCols})
      SELECT ${mCols.replace(/(\w+)/g, 'm.$1')}
      FROM ward_chat_group_members m
      INNER JOIN group_chats c ON c.id = m.group_id
    `);
    await qi.sequelize.query(`
      INSERT IGNORE INTO all_chat_messages (${msgCols})
      SELECT ${msgCols.replace(/(\w+)/g, 'm.$1')}
      FROM ward_chat_messages m
      INNER JOIN all_chats c ON c.id = m.group_id
    `);
    await qi.sequelize.query(`
      INSERT IGNORE INTO group_chat_messages (${msgCols})
      SELECT ${msgCols.replace(/(\w+)/g, 'm.$1')}
      FROM ward_chat_messages m
      INNER JOIN group_chats c ON c.id = m.group_id
    `);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('group_chat_messages');
    await queryInterface.dropTable('group_chat_members');
    await queryInterface.dropTable('group_chats');
    await queryInterface.dropTable('all_chat_messages');
    await queryInterface.dropTable('all_chat_members');
    await queryInterface.dropTable('all_chats');
  },
};
