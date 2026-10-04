'use strict';

/** Composite indexes for ~4 lakh civic records without slowing ward-scoped lists. */
async function addIndexIfMissing(queryInterface, table, fields, name) {
  const [rows] = await queryInterface.sequelize.query(
    `SELECT 1 FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = :table AND index_name = :name LIMIT 1`,
    { replacements: { table, name } }
  );
  if (rows && rows.length) return;
  const tables = await queryInterface.showAllTables();
  const names = tables.map((t) => (typeof t === 'string' ? t : t.tableName || t.name || '')).map((s) => String(s).toLowerCase());
  if (!names.includes(String(table).toLowerCase())) return;
  await queryInterface.addIndex(table, fields, { name }).catch(() => {});
}

module.exports = {
  async up(queryInterface) {
    await addIndexIfMissing(queryInterface, 'persons', ['status', 'deleted_at'], 'idx_persons_status_deleted');
    await addIndexIfMissing(queryInterface, 'persons', ['family_id', 'status', 'deleted_at'], 'idx_persons_family_status_del');
    await addIndexIfMissing(queryInterface, 'persons', ['status', 'dob', 'deleted_at'], 'idx_persons_status_dob');
    await addIndexIfMissing(queryInterface, 'persons', ['mobile', 'deleted_at'], 'idx_persons_mobile_del');
    await addIndexIfMissing(queryInterface, 'persons', ['full_name', 'status'], 'idx_persons_name_status');
    await addIndexIfMissing(queryInterface, 'persons', ['verification_status', 'status'], 'idx_persons_verify_status');

    await addIndexIfMissing(queryInterface, 'families', ['house_id', 'status', 'deleted_at'], 'idx_families_house_status_del');
    await addIndexIfMissing(queryInterface, 'houses', ['area_id', 'status', 'deleted_at'], 'idx_houses_area_status_del');
    await addIndexIfMissing(queryInterface, 'houses', ['apartment_id', 'status'], 'idx_houses_apt_status');
    await addIndexIfMissing(queryInterface, 'apartments', ['ward_id', 'area_id'], 'idx_apartments_ward_area');
    await addIndexIfMissing(queryInterface, 'areas', ['ward_id', 'status'], 'idx_areas_ward_status');

    await addIndexIfMissing(queryInterface, 'voter_profiles', ['status', 'person_id'], 'idx_voters_status_person');
    await addIndexIfMissing(queryInterface, 'voter_profiles', ['voting_ward', 'status'], 'idx_voters_ward_status');

    await addIndexIfMissing(queryInterface, 'complaints', ['ward_id', 'status', 'created_at'], 'idx_complaints_ward_status_created');
    await addIndexIfMissing(queryInterface, 'complaints', ['submitted_by_user_id', 'status'], 'idx_complaints_submitter_status');
    await addIndexIfMissing(queryInterface, 'complaints', ['assigned_nagarsevak_user_id', 'status', 'created_at'], 'idx_complaints_nagar_status_created');
    await addIndexIfMissing(queryInterface, 'complaints', ['assigned_employee_id', 'status', 'created_at'], 'idx_complaints_emp_status_created');
    await addIndexIfMissing(queryInterface, 'complaints', ['deleted_at', 'ward_id'], 'idx_complaints_deleted_ward');

    await addIndexIfMissing(queryInterface, 'users', ['ward_id', 'role_id', 'status', 'deleted_at'], 'idx_users_ward_role_status_del');
    await addIndexIfMissing(queryInterface, 'users', ['mobile', 'deleted_at'], 'idx_users_mobile_del');
    await addIndexIfMissing(queryInterface, 'users', ['email', 'deleted_at'], 'idx_users_email_del');

    await addIndexIfMissing(queryInterface, 'notifications', ['user_id', 'is_read', 'created_at'], 'idx_notif_user_read_created');
    await addIndexIfMissing(queryInterface, 'audit_logs', ['entity', 'record_id', 'created_at'], 'idx_audit_entity_record_created');
    await addIndexIfMissing(queryInterface, 'person_birthdays', ['ward_id', 'status', 'birth_month', 'birth_day'], 'idx_bday_ward_md');
    await addIndexIfMissing(queryInterface, 'ward_nagarsevak_subscriptions', ['ward_id', 'status'], 'idx_wns_ward_status');
    await addIndexIfMissing(queryInterface, 'ward_gallery_items', ['ward_id', 'status', 'show_on_dashboard'], 'idx_gallery_ward_dash');
  },

  async down() {
    /* keep indexes */
  },
};
