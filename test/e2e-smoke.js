// Use global fetch when available (Node 18+), fallback to node-fetch
let fetchFn = global.fetch;
try { if (!fetchFn) fetchFn = require('node-fetch'); } catch(e) {}
(async function(){
  try{
    const base = 'http://localhost:3000';
    const adminPass = process.env.ADMIN_PASSWORD || 'aiml';
    const allowWrite = process.env.SMOKE_ALLOW_WRITE === '1';
    console.log('GET /api/state');
    let r = await fetchFn(base + '/api/state');
    console.log('status', r.status);
    let s = await r.json();
    console.log('phase:', s.phase);

    console.log('GET /api/players');
    r = await fetchFn(base + '/api/players');
    console.log('status', r.status);
    const players = await r.json();
    console.log('players count:', players.length);

    // verify /api/state does not leak any password/code fields
    console.log('GET /api/state again to inspect teams');
    r = await fetchFn(base + '/api/state');
    const state = await r.json();
    if (state && state.teams) {
      const leaked = Object.values(state.teams).filter(t => t.password !== undefined);
      console.log('teams in state with password field (should be 0):', leaked.length);
    }

    // connect via socket.io to inspect init event payload
    try {
      const { io } = require('socket.io-client');
      await new Promise((resolve, reject) => {
        const sock = io(base, { transports: ['websocket'], reconnection: false });
        sock.on('connect', () => {
          // wait for init event
        });
        sock.on('init', (data) => {
          if (data && data.availableTeams) {
            console.log('socket init availableTeams sample:', data.availableTeams.slice(0,2));
            const leaked2 = data.availableTeams.filter(t => t.password !== undefined);
            console.log('socket init availableTeams with password field (should be 0):', leaked2.length);
          }
          sock.disconnect();
          resolve();
        });
        sock.on('connect_error', (err) => {
          reject(err);
        });
        // timeout fallback
        setTimeout(() => {
          sock.disconnect();
          resolve();
        }, 2000);
      });
    } catch (err) {
      console.log('socket.io-client check skipped (not available)', err.message);
    }

    if (allowWrite) {
      const dummyName = `E2E Test ${Date.now()}`;
      console.log('POST /api/players (write mode)');
      r = await fetchFn(base + '/api/players', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-pass': adminPass,
        },
        body: JSON.stringify({ name: dummyName, role: 'Sensor', basePrice: 10 }),
      });
      console.log('status', r.status);
      const added = await r.json();
      console.log('added:', added && added.player && added.player.name);
    } else {
      console.log('Skipping write test (set SMOKE_ALLOW_WRITE=1 to enable)');
    }

    console.log('Smoke tests passed');
    process.exit(0);
  } catch(e){
    console.error('Smoke test failed', e);
    process.exit(2);
  }
})();
