'use strict';

async function tableExists(queryInterface, table) {
  const [rows] = await queryInterface.sequelize.query(
    'SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1',
    { replacements: [table] }
  );
  return Boolean(rows?.length);
}

module.exports = {
  async up(queryInterface) {
    if (await tableExists(queryInterface, 'voter_profiles') && await tableExists(queryInterface, 'persons')) {
      await queryInterface.sequelize.query(`
        UPDATE voter_profiles vp
        INNER JOIN persons p ON p.id = vp.person_id
        SET vp.status = 'DECEASED', vp.updated_at = NOW()
        WHERE p.status = 'DECEASED'
          AND p.deleted_at IS NULL
          AND vp.deleted_at IS NULL
          AND vp.status <> 'DECEASED'
      `);
    }
    if (await tableExists(queryInterface, 'person_birthdays') && await tableExists(queryInterface, 'persons')) {
      await queryInterface.sequelize.query(`
        UPDATE person_birthdays pb
        INNER JOIN persons p ON p.id = pb.person_id
        SET pb.status = 'INACTIVE', pb.updated_at = NOW()
        WHERE p.status = 'DECEASED'
          AND pb.status <> 'INACTIVE'
      `);
    }
    if (await tableExists(queryInterface, 'death_observances') && await tableExists(queryInterface, 'death_records')) {
      await queryInterface.sequelize.query(`
        UPDATE death_observances d
        INNER JOIN death_records r ON r.id = d.death_record_id
        SET d.status = 'CANCELLED', d.updated_at = NOW()
        WHERE r.record_status = 'RESTORED'
          AND d.status <> 'CANCELLED'
      `);
    }
  },

  async down() {},
};
