/**
 * Comprehensive End-to-End Test Suite for Electronic-Arena
 * Tests All REST APIs, Convex Cloud DB, Bidding Engine, Admin Controls, Team Management, and Edge Cases.
 */

const http = require('http');

const BASE_HOST = 'localhost';
const BASE_PORT = 3000;
const ADMIN_PASS = 'aiml';

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    testsPassed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    testsFailed++;
    throw new Error(`Assertion failed: ${message}`);
  }
}

function request(path, method = 'GET', body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    let postData = null;
    const reqHeaders = { ...headers };

    if (body && typeof body === 'object' && !headers['Content-Type']) {
      postData = JSON.stringify(body);
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(postData);
    } else if (body && Buffer.isBuffer(body)) {
      postData = body;
      reqHeaders['Content-Length'] = postData.length;
    }

    const req = http.request({
      hostname: BASE_HOST,
      port: BASE_PORT,
      path,
      method,
      headers: reqHeaders,
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (e) {
          json = data;
        }
        resolve({ status: res.statusCode, data: json, raw: data });
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runAllTests() {
  console.log('\n======================================================');
  console.log('🧪 RUNNING ELECTRONIC-ARENA COMPREHENSIVE TEST SUITE');
  console.log('======================================================\n');

  try {
    // ─── 1. DATABASE HEALTH & CONVEX CONNECTION ───
    console.log('🔹 TEST 1: Database Health & Convex Connection');
    const dbRes = await request('/api/db/health');
    assert(dbRes.status === 200, 'GET /api/db/health returned 200');
    assert(dbRes.data.connected === true, 'Convex Cloud DB is connected');
    assert(dbRes.data.url.includes('dapper-akita-326.convex.cloud'), 'Convex URL matches dapper-akita-326');

    // ─── 2. COMPONENT CATALOG VERIFICATION ───
    console.log('\n🔹 TEST 2: Component Catalog Verification');
    const playersRes = await request('/api/players');
    assert(playersRes.status === 200, 'GET /api/players returned 200');
    assert(Array.isArray(playersRes.data), 'Players response is an array');
    assert(playersRes.data.length === 53, `Catalog contains exactly 53 components (found ${playersRes.data.length})`);
    
    const sample = playersRes.data[0];
    assert(sample.id === 1 && sample.name === 'Input' && sample.basePrice === 4, 'Component #1 is Input with 4 pts base price');

    // ─── 3. LOGO UPLOAD (BASE64 MEMORY STORAGE) ───
    console.log('\n🔹 TEST 3: Logo Upload (Base64 Memory Storage - Zero Disk Dependency)');
    const boundary = '----WebKitFormBoundaryE2ETest';
    const fakeImg = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    const head = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="logo"; filename="team.png"\r\nContent-Type: image/png\r\n\r\n`, 'utf8');
    const foot = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');
    const uploadPayload = Buffer.concat([head, fakeImg, foot]);

    const uploadRes = await request('/api/teams/upload-logo', 'POST', uploadPayload, {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    });
    assert(uploadRes.status === 200, 'POST /api/teams/upload-logo returned 200');
    assert(uploadRes.data.success === true, 'Upload returned success: true');
    assert(uploadRes.data.url && uploadRes.data.url.startsWith('data:image/png;base64,'), 'Returned valid Base64 data URL');

    const logoUrl = uploadRes.data.url;

    // ─── 4. RESET GAME STATE TO CLEAN SLATE ───
    console.log('\n🔹 TEST 4: Clean State Reset');
    const resetRes = await request('/api/reset', 'POST', {}, { 'x-admin-pass': ADMIN_PASS });
    assert(resetRes.status === 200, 'POST /api/reset returned 200');

    // ─── 5. DYNAMIC TEAM REGISTRATION (UP TO 5 MEMBERS) ───
    console.log('\n🔹 TEST 5: Dynamic Team Registration');
    const team1Payload = {
      name: 'Alpha Logic ' + Date.now(),
      leader: 'Alice (Leader)',
      members: ['Alice (Leader)', 'Bob', 'Charlie', 'David', 'Eva'],
      logo: logoUrl,
      password: 'alpha_pass',
    };
    const reg1Res = await request('/api/teams/register', 'POST', team1Payload);
    assert(reg1Res.status === 200, 'Team 1 registered successfully');
    assert(reg1Res.data.team.members.length === 5, 'Team 1 has exactly 5 members');
    assert(reg1Res.data.team.budget === 500, 'Team 1 starting budget is 500 pts');
    assert(reg1Res.data.team.verified === false, 'Team 1 starts as pending verification (verified: false)');

    const team1Id = reg1Res.data.teamId;

    // Register Team 2
    const team2Payload = {
      name: 'Beta Circuit ' + Date.now(),
      leader: 'Frank (Leader)',
      members: ['Frank (Leader)', 'Grace', 'Heidi'],
      password: 'beta_pass',
    };
    const reg2Res = await request('/api/teams/register', 'POST', team2Payload);
    assert(reg2Res.status === 200, 'Team 2 registered successfully');
    const team2Id = reg2Res.data.teamId;

    // ─── 6. DUPLICATE REGISTRATION PREVENTION ───
    console.log('\n🔹 TEST 6: Duplicate Team Name Prevention');
    const dupRes = await request('/api/teams/register', 'POST', team1Payload);
    assert(dupRes.status === 409, 'Duplicate team registration rejected with 409 Conflict');

    // ─── 7. TEAM AUTHENTICATION & LOGIN ───
    console.log('\n🔹 TEST 7: Team Login & Passcode Authentication');
    const loginRes = await request('/api/teams/join', 'POST', { password: 'alpha_pass' });
    assert(loginRes.status === 200, 'Team 1 login with passcode succeeded');
    assert(loginRes.data.teamId === team1Id, 'Login returned correct teamId');
    assert(Boolean(loginRes.data.reconnectToken), 'Login generated reconnectToken for session recovery');

    const wrongLoginRes = await request('/api/teams/join', 'POST', { password: 'wrong_password_123' });
    assert(wrongLoginRes.status === 404 || wrongLoginRes.status === 401, 'Incorrect passcode rejected');

    // ─── 8. ADMIN APPROVAL WORKFLOW ───
    console.log('\n🔹 TEST 8: Admin Team Verification Workflow');
    // Verify Team 1
    const verify1Res = await request('/api/admin/teams/verify', 'POST', { id: team1Id, verified: true }, { 'x-admin-pass': ADMIN_PASS });
    assert(verify1Res.status === 200, 'Admin verified Team 1');
    assert(verify1Res.data.verified === true, 'Team 1 status updated to verified: true');

    // Verify all teams
    const verifyAllRes = await request('/api/admin/teams/verify-all', 'POST', { verified: true }, { 'x-admin-pass': ADMIN_PASS });
    assert(verifyAllRes.status === 200, 'Admin verified all teams');

    // ─── 9. REAL-TIME STATE SYNC ENDPOINT (/api/sync) ───
    console.log('\n🔹 TEST 9: Real-time State Synchronization');
    const syncRes = await request('/api/sync', 'GET', null, { 'x-admin-pass': ADMIN_PASS });
    assert(syncRes.status === 200, 'GET /api/sync returned 200');
    assert(syncRes.data.gameState.phase === 'lobby', 'Current phase is lobby');
    assert(Object.keys(syncRes.data.teams).length >= 2, 'Sync contains registered teams');
    assert(syncRes.data.teams[team1Id].verified === true, 'Team 1 in sync payload is verified');

    // ─── 10. AUCTION START & QUEUE INITIALIZATION ───
    console.log('\n🔹 TEST 10: Auction Start & Queue Initialization');
    const startRes = await request('/api/auction/start', 'POST', {}, { 'x-admin-pass': ADMIN_PASS });
    assert(startRes.status === 200, 'POST /api/auction/start returned 200');
    assert(startRes.data.gameState.phase === 'auction', 'Game phase transitioned to auction');

    // Wait 900ms for first component to be spotlighted
    await new Promise(r => setTimeout(r, 900));

    const syncAfterStart = await request('/api/sync');
    assert(syncAfterStart.data.gameState.currentPlayer !== null, 'Current component spotlighted on stage');
    const activePlayer = syncAfterStart.data.gameState.currentPlayer;
    console.log(`    Component on auction stage: #${activePlayer.id} - ${activePlayer.name} (${activePlayer.basePrice} pts)`);

    // ─── 11. BIDDING ENGINE (+1, +2, +5 PTS QUICK BIDS) ───
    console.log('\n🔹 TEST 11: Bidding Engine (+1, +2, +5 pts & Validation)');
    const startingBid = syncAfterStart.data.gameState.currentBid;

    // Bid +1 pt by Team 1
    const bid1Res = await request('/api/auction/bid', 'POST', {
      teamId: team1Id,
      password: 'alpha_pass',
      increment: 1,
    });
    assert(bid1Res.status === 200, 'Team 1 placed +1 pt bid');
    assert(bid1Res.data.bid === startingBid + 1, `Bid updated to ${startingBid + 1} pts`);
    assert(bid1Res.data.bidderTeamId === team1Id, 'Team 1 is leading bidder');

    // Bid +5 pts by Team 2
    const bid2Res = await request('/api/auction/bid', 'POST', {
      teamId: team2Id,
      password: 'beta_pass',
      increment: 5,
    });
    assert(bid2Res.status === 200, 'Team 2 placed +5 pts counter-bid');
    assert(bid2Res.data.bid === startingBid + 6, `Bid updated to ${startingBid + 6} pts`);
    assert(bid2Res.data.bidderTeamId === team2Id, 'Team 2 is now leading bidder');

    // Test Underbid rejection
    const underbidRes = await request('/api/auction/bid', 'POST', {
      teamId: team1Id,
      password: 'alpha_pass',
      amount: startingBid,
    });
    assert(underbidRes.status === 400, 'Underbid rejected with 400 Bad Request');

    // ─── 12. AUCTION PAUSE & RESUME ───
    console.log('\n🔹 TEST 12: Auction Pause & Resume');
    const pauseRes = await request('/api/auction/pause', 'POST', {}, { 'x-admin-pass': ADMIN_PASS });
    assert(pauseRes.status === 200, 'Auction paused');
    assert(pauseRes.data.gameState.phase === 'paused', 'Phase is paused');

    const resumeRes = await request('/api/auction/resume', 'POST', {}, { 'x-admin-pass': ADMIN_PASS });
    assert(resumeRes.status === 200, 'Auction resumed');
    assert(resumeRes.data.gameState.phase === 'auction', 'Phase is back to auction');

    // ─── 13. SELL COMPONENT & INVENTORY DEDUCTION ───
    console.log('\n🔹 TEST 13: Sell Component & Deduct Budget');
    const sellPrice = startingBid + 6;
    const sellRes = await request('/api/auction/sell', 'POST', {}, { 'x-admin-pass': ADMIN_PASS });
    assert(sellRes.status === 200, 'Admin confirmed sale');

    const syncAfterSell = await request('/api/sync');
    const team2After = syncAfterSell.data.teams[team2Id];
    assert(team2After.budget === 500 - sellPrice, `Team 2 budget deducted correctly (${team2After.budget} pts left)`);
    assert(team2After.players.length === 1, 'Team 2 inventory has 1 acquired component');
    assert(team2After.players[0].id === activePlayer.id, 'Acquired component matches sold item');

    // ─── 14. END AUCTION & FINAL RESULTS CALCULATION ───
    console.log('\n🔹 TEST 14: End Auction & Results Calculation');
    const endRes = await request('/api/auction/stop', 'POST', {}, { 'x-admin-pass': ADMIN_PASS });
    assert(endRes.status === 200, 'Auction ended');
    assert(endRes.data.gameState.phase === 'finished', 'Phase is finished');

    const finalSync = await request('/api/sync');
    assert(finalSync.data.gameState.soldHistory.length >= 1, 'Sold history contains completed sales');

    // ─── 15. EXPRESS SOCKET.IO ROUTE ───
    console.log('\n🔹 TEST 15: Express /socket.io/ Route Compatibility');
    const socketRes = await request('/socket.io/?EIO=4&transport=polling&t=e2etest');
    assert(socketRes.status === 200, 'GET /socket.io/ returns 200 OK directly in Express');

    console.log('\n======================================================');
    console.log(`🎉 ALL ${testsPassed} TESTS PASSED SUCCESSFULLY! (0 Failures)`);
    console.log('======================================================\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ TEST SUITE FAILED:', error.message);
    console.log(`Tests passed: ${testsPassed}, Tests failed: ${testsFailed}`);
    process.exit(1);
  }
}

runAllTests();
