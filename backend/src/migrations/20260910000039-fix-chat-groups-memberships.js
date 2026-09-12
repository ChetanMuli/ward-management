'use strict';
const { QueryTypes } = require('sequelize');
const crypto = require('crypto');

module.exports = {
  async up(queryInterface) {
    const qi = queryInterface;
    const groups = await qi.sequelize.query(
      `SELECT id, ward_id, type, nagarsevak_user_id, is_active FROM ward_chat_groups WHERE is_active=1`,
      { type: QueryTypes.SELECT }
    );
    const users = await qi.sequelize.query(
      `SELECT id, ward_id FROM users WHERE status='ACTIVE' AND deleted_at IS NULL AND ward_id IS NOT NULL`,
      { type: QueryTypes.SELECT }
    );

    // Reconcile both ward and Nagarsevak channels. INSERT IGNORE makes this
    // safe for databases that already contain some membership rows.
    for (const group of groups) {
      if (!['WARD','NAGARSEVAK','CUSTOM'].includes(group.type)) continue;
      for (const user of users) {
        if (String(user.ward_id) !== String(group.ward_id)) continue;
        await qi.sequelize.query(
          `INSERT IGNORE INTO ward_chat_group_members
             (id, group_id, user_id, joined_at)
           VALUES (:id, :groupId, :userId, NOW())`,
          { replacements: { id: crypto.randomUUID(), groupId: group.id, userId: user.id } }
        );
      }
    }

    // Repair active Nagarsevak groups whose ward was changed in the staff
    // module, and archive groups whose owner no longer exists/active.
    await qi.sequelize.query(`
      UPDATE ward_chat_groups g
      LEFT JOIN users u ON u.id=g.nagarsevak_user_id
      SET g.is_active=0
      WHERE g.type='NAGARSEVAK'
        AND (u.id IS NULL OR u.status <> 'ACTIVE' OR u.deleted_at IS NOT NULL)
    `);
  },
  async down() {
    // Reconciliation is intentionally non-destructive.
  }
};
