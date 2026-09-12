'use strict';
const { QueryTypes } = require('sequelize');
const crypto = require('crypto');

module.exports = {
  async up(queryInterface) {
    const sequelize = queryInterface.sequelize;
    // Remove stale memberships from inactive/deleted users or users that were
    // moved to another ward. System/custom ward channels are always ward-scoped.
    await sequelize.query(`
      DELETE m FROM ward_chat_group_members m
      INNER JOIN ward_chat_groups g ON g.id=m.group_id
      LEFT JOIN users u ON u.id=m.user_id
      WHERE g.is_active=1
        AND g.type IN ('WARD','CUSTOM','NAGARSEVAK')
        AND (u.id IS NULL OR u.status <> 'ACTIVE' OR u.deleted_at IS NOT NULL OR u.ward_id <> g.ward_id)
    `);

    const wards = await sequelize.query(`SELECT id, ward_number, name FROM wards WHERE status='ACTIVE' AND deleted_at IS NULL`, { type: QueryTypes.SELECT });
    for (const ward of wards) {
      const existing = await sequelize.query(`SELECT id FROM ward_chat_groups WHERE ward_id=:wardId AND type='WARD' LIMIT 1`, { replacements:{wardId:ward.id}, type:QueryTypes.SELECT });
      if (!existing.length) {
        await sequelize.query(`INSERT INTO ward_chat_groups (id,ward_id,name,type,created_by_user_id,is_active,mode,created_at,updated_at) VALUES (:id,:wardId,:name,'WARD',NULL,1,'CHAT',NOW(),NOW())`, { replacements:{id:crypto.randomUUID(),wardId:ward.id,name:`Ward ${ward.ward_number}${ward.name ? ` · ${ward.name}` : ''} Community`} });
      } else {
        await sequelize.query(`UPDATE ward_chat_groups SET name=:name,is_active=1,mode='CHAT' WHERE id=:id`, { replacements:{id:existing[0].id,name:`Ward ${ward.ward_number}${ward.name ? ` · ${ward.name}` : ''} Community`} });
      }
    }

    const groups = await sequelize.query(
      `SELECT id, ward_id FROM ward_chat_groups WHERE is_active=1 AND type IN ('WARD','CUSTOM','NAGARSEVAK')`,
      { type: QueryTypes.SELECT }
    );
    const users = await sequelize.query(
      `SELECT id, ward_id FROM users WHERE status='ACTIVE' AND deleted_at IS NULL AND ward_id IS NOT NULL`,
      { type: QueryTypes.SELECT }
    );
    for (const group of groups) {
      for (const user of users) {
        if (String(group.ward_id) !== String(user.ward_id)) continue;
        await sequelize.query(
          `INSERT IGNORE INTO ward_chat_group_members (id, group_id, user_id, joined_at) VALUES (:id,:groupId,:userId,NOW())`,
          { replacements: { id: crypto.randomUUID(), groupId: group.id, userId: user.id } }
        );
      }
    }
  },
  async down() {}
};
