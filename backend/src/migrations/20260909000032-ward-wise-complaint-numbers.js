'use strict';

module.exports = {
  async up(queryInterface) {
    // Prefix historical complaint numbers with their resident ward.
    // This keeps the original identifier visible while making every complaint
    // immediately traceable to a ward. New complaints use the same format.
    await queryInterface.sequelize.query(`
      UPDATE complaints c
      INNER JOIN wards w ON c.ward_id = w.id
      SET c.complaint_number = CONCAT(
        'CMP-',
        UPPER(REPLACE(REPLACE(REPLACE(TRIM(w.ward_number), '-', ''), ' ', ''), '.', '')),
        '-',
        c.complaint_number
      )
      WHERE c.complaint_number NOT LIKE CONCAT(
        'CMP-',
        UPPER(REPLACE(REPLACE(REPLACE(TRIM(w.ward_number), '-', ''), ' ', ''), '.', '')),
        '-%'
      )
    `);

    // Legacy complaints can have only house -> area -> ward linkage.
    await queryInterface.sequelize.query(`
      UPDATE complaints c
      INNER JOIN houses h ON c.house_id = h.id
      INNER JOIN areas a ON h.area_id = a.id
      INNER JOIN wards w ON a.ward_id = w.id
      SET c.complaint_number = CONCAT(
        'CMP-',
        UPPER(REPLACE(REPLACE(REPLACE(TRIM(w.ward_number), '-', ''), ' ', ''), '.', '')),
        '-',
        c.complaint_number
      )
      WHERE c.ward_id IS NULL
        AND c.complaint_number NOT LIKE CONCAT(
          'CMP-',
          UPPER(REPLACE(REPLACE(REPLACE(TRIM(w.ward_number), '-', ''), ' ', ''), '.', '')),
          '-%'
        )
    `);
  },

  async down() {
    // Do not destructively rewrite complaint identifiers on rollback.
    // The migration is intentionally forward-only for audit-safe identifiers.
  },
};
