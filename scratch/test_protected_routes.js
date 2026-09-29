const http = require('http');
const path = require('path');
process.env.JWT_SECRET = 'bb16bc6c7139b240bf34c6b7e0b51f5d6ce9747a8df63374cebb34f5015870316849df59f5d6cc3d947fbc86e45c8b7ee798a46159aa6f07052f9d73c8649497';

const { AdminUser, User } = require(path.resolve(__dirname, '../backend/src/models'));
const jwt = require(path.resolve(__dirname, '../backend/node_modules/jsonwebtoken'));

function get(path, token) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:4000${path}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(data || '{}') }));
    }).on('error', reject);
  });
}

async function testProtected() {
  const admin = await AdminUser.findOne({ include: [{ model: User, as: 'user' }] });
  if (!admin) {
    console.log('No admin user found');
    process.exit(0);
  }

  const userId = admin.user ? admin.user.id : admin.id;
  const token = jwt.sign({
    sub: userId,
    role: 'SUPER_ADMIN'
  }, process.env.JWT_SECRET, { expiresIn: '1h' });

  console.log('\n--- 1. Testing GET /api/v2/shops ---');
  const shopsRes = await get('/api/v2/shops', token);
  console.log('Shops status:', shopsRes.status);
  console.log('Shops count:', shopsRes.body.data?.length);
  if (shopsRes.body.data?.length > 0) {
    const s0 = shopsRes.body.data[0];
    console.log('Sample shop:', {
      name: s0.name,
      ownerName: s0.ownerName,
      ownerMobile: s0.ownerMobile,
      propertyOwnerName: s0.propertyOwnerName,
      propertyOwnerMobile: s0.propertyOwnerMobile
    });
  }

  console.log('\n--- 2. Testing GET /api/v2/persons with filters ---');
  const personsAll = await get('/api/v2/persons', token);
  console.log('Persons total count:', personsAll.body.meta?.total);

  const personsGovt = await get('/api/v2/persons?occupationType=SERVICE&employmentType=GOVERNMENT', token);
  console.log('Persons (Service - Government) count:', personsGovt.body.meta?.total);

  const personsBusiness = await get('/api/v2/persons?occupationType=BUSINESS', token);
  console.log('Persons (Business) count:', personsBusiness.body.meta?.total);

  const personsSenior = await get('/api/v2/persons?ageGroup=SENIOR', token);
  console.log('Persons (Senior 60+) count:', personsSenior.body.meta?.total);

  const personsAdult = await get('/api/v2/persons?ageGroup=ADULT', token);
  console.log('Persons (Adult 18+) count:', personsAdult.body.meta?.total);

  console.log('\nAll tests completed successfully!');
  process.exit(0);
}

testProtected().catch(e => {
  console.error(e);
  process.exit(1);
});
