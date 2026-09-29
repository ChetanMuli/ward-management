const http = require('http');

function testEndpoint(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:4000${path}`, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ status: res.statusCode, data: data.slice(0, 150) });
      });
    }).on('error', reject);
  });
}

async function run() {
  console.log('Testing /api/health...');
  const h = await testEndpoint('/api/health');
  console.log('Health:', h);

  console.log('Testing public registration wards...');
  const rw = await testEndpoint('/api/v2/auth/registration-wards');
  console.log('Reg Wards:', rw);

  process.exit(0);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
