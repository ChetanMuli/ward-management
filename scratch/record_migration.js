const path = require('path');
const { sequelize } = require(path.resolve(__dirname, '../backend/src/models'));

async function run() {
  await sequelize.query("INSERT INTO sequelizemeta (name) VALUES ('20260929000068-shop-property-owner.js')");
  console.log('Successfully recorded 20260929000068-shop-property-owner.js in sequelizemeta');
  process.exit(0);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
