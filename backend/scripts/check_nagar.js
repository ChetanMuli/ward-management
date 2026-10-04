const { sequelize } = require('../src/models');
const { CORPORATORS } = require('../src/migrations/20260910000036-amc-corporator-directory-and-nagarsevak-permissions');

(async () => {
  try {
    let n = 0;
    for (const [, wardSeat, name, mobile, partyName, officialAddress] of CORPORATORS) {
      if (!mobile || !name) continue;
      await sequelize.query(
        'UPDATE users SET name = :name WHERE mobile = :mobile AND deleted_at IS NULL',
        { replacements: { name, mobile } }
      );
      await sequelize.query(
        `UPDATE nagarsevak_users
         SET name = :name, ward_seat = :wardSeat, party_name = :partyName, official_address = :officialAddress
         WHERE mobile = :mobile AND deleted_at IS NULL`,
        { replacements: { name, mobile, wardSeat: wardSeat || null, partyName: partyName || null, officialAddress: officialAddress || null } }
      );
      n += 1;
    }
    console.log('Restored corporator names by mobile:', n);
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
})();
