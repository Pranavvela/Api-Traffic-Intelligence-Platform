const http = require('http');

const API_URL = 'http://localhost:4000';
const TEST_USER = {
  email: 'simulator@test.local',
  password: 'simulator123456',
};

function makeRequest(method, path, data) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function main() {
  console.log('[Token Generator] Starting...\n');

  // Try login first
  console.log('[1] Attempting login with existing credentials...');
  let loginRes = await makeRequest('POST', '/api/auth/login', TEST_USER);
  
  if (loginRes.status === 401) {
    console.log('    No existing user. Registering new account...');
    const regRes = await makeRequest('POST', '/api/auth/register', TEST_USER);
    if (regRes.status !== 201) {
      console.error('    ❌ Registration failed:', regRes.data);
      process.exit(1);
    }
    console.log('    ✓ Account created:', regRes.data.data.user.email);
    
    // Now login
    console.log('[2] Logging in...');
    loginRes = await makeRequest('POST', '/api/auth/login', TEST_USER);
  }

  if (loginRes.status !== 200) {
    console.error('❌ Login failed:', loginRes.data);
    process.exit(1);
  }

  const token = loginRes.data.data.token;
  console.log('✓ Login successful\n');
  console.log('[Token]');
  console.log(token);
  console.log('\n[Instructions]');
  console.log('Copy this token and add to traffic-simulator/.env:');
  console.log(`SIM_AUTH_TOKEN=${token}`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
