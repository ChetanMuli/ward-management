const path = require('path');
const models = require(path.resolve(__dirname, '../backend/src/models'));
const { sequelize } = models;

async function checkFlowAndAssociations() {
  console.log('--- Checking Model Associations ---');
  const modelNames = Object.keys(models).filter(k => k !== 'sequelize' && k !== 'Sequelize');
  for (const name of modelNames) {
    const m = models[name];
    if (m && m.associations) {
      const assocs = Object.keys(m.associations);
      console.log(`${name}: [${assocs.join(', ')}]`);
    }
  }

  console.log('\n--- Checking Record Counts in Core Tables ---');
  for (const name of ['Ward', 'Area', 'Apartment', 'House', 'Shop', 'Family', 'Person', 'VoterProfile', 'NagarsevakUser', 'EmployeeUser', 'Complaint']) {
    if (models[name]) {
      const count = await models[name].count();
      console.log(`${name}: ${count} records`);
    }
  }

  console.log('\n--- Verifying Integrity of Foreign Keys ---');
  // Check for orphan areas
  const [orphanAreas] = await sequelize.query('SELECT count(*) as c FROM areas a LEFT JOIN wards w ON a.ward_id = w.id WHERE w.id IS NULL');
  console.log('Orphan areas (without ward):', orphanAreas[0].c);

  // Check for orphan houses
  const [orphanHouses] = await sequelize.query('SELECT count(*) as c FROM houses h LEFT JOIN areas a ON h.area_id = a.id WHERE a.id IS NULL');
  console.log('Orphan houses (without area):', orphanHouses[0].c);

  // Check for orphan families
  const [orphanFamilies] = await sequelize.query('SELECT count(*) as c FROM families f LEFT JOIN houses h ON f.house_id = h.id WHERE h.id IS NULL');
  console.log('Orphan families (without house):', orphanFamilies[0].c);

  // Check for orphan persons
  const [orphanPersons] = await sequelize.query('SELECT count(*) as c FROM persons p LEFT JOIN families f ON p.family_id = f.id WHERE f.id IS NULL');
  console.log('Orphan persons (without family):', orphanPersons[0].c);

  // Check for orphan shops
  const [orphanShops] = await sequelize.query('SELECT count(*) as c FROM shops_and_offices s LEFT JOIN areas a ON s.area_id = a.id WHERE a.id IS NULL');
  console.log('Orphan shops (without area):', orphanShops[0].c);

  console.log('\nAll foreign key integrity checks complete!');
  process.exit(0);
}

checkFlowAndAssociations().catch(e => {
  console.error(e);
  process.exit(1);
});
