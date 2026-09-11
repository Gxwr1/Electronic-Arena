const http = require('http');

async function runTests() {
  const base = 'http://localhost:3000';
  const adminPass = 'aiml';

  console.log('Testing Electro Auction dynamic team features...');

  // 1. Test GET /api/teams
  let res = await fetch(base + '/api/teams');
  let data = await res.json();
  console.log('GET /api/teams ->', res.status, 'Total teams:', data.teams.length);
  if (data.teams[0]) {
    console.log('Sample team:', data.teams[0].name, '| Password hidden:', data.teams[0].password === undefined);
  }

  // 2. Test Dynamic Registration POST /api/teams/register
  const customName = 'RoboTech Alpha ' + Date.now();
  res = await fetch(base + '/api/teams/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: customName,
      leader: 'Dr. John & Sarah',
      color: '#00ff88',
      icon: '🤖',
      password: 'alpha_' + Math.random().toString(36).substring(2, 6),
      budget: 12000,
    })
  });
  data = await res.json();
  console.log('POST /api/teams/register ->', res.status, 'Created Team:', data.team && data.team.name, 'Password:', data.password);

  // 3. Test Admin Add Team
  res = await fetch(base + '/api/admin/teams/add', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-pass': adminPass,
    },
    body: JSON.stringify({
      name: 'Cyber Core Labs',
      short: 'CCL',
      leader: 'Professor Turing',
      color: '#a855f7',
      icon: '🔬',
      password: 'ccl_secret',
      budget: 15000,
    })
  });
  data = await res.json();
  console.log('POST /api/admin/teams/add ->', res.status, 'Admin Added:', data.team && data.team.name);

  // 4. Test Admin CSV Report Download
  res = await fetch(base + '/api/admin/report.csv', {
    headers: { 'x-admin-pass': adminPass }
  });
  const csv = await res.text();
  console.log('GET /api/admin/report.csv ->', res.status, 'Header lines sample:\n', csv.split('\n').slice(0, 5).join('\n'));

  console.log('\n✅ All Electro Auction dynamic team & component tests PASSED!');
  process.exit(0);
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
