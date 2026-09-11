const { io } = require('socket.io-client');

async function testAuctionFlow() {
  console.log('--- STARTING COMPREHENSIVE SOCKET AUCTION & SIMULATOR TEST ---');

  const adminSocket = io('http://localhost:3000', {
    auth: { adminPass: 'aiml' }
  });

  const team1Socket = io('http://localhost:3000');
  const team2Socket = io('http://localhost:3000');

  await new Promise((resolve, reject) => {
    let connected = 0;
    const check = () => {
      connected++;
      if (connected === 3) resolve();
    };
    adminSocket.on('connect', check);
    team1Socket.on('connect', check);
    team2Socket.on('connect', check);
    setTimeout(() => reject(new Error('Socket connection timeout')), 4000);
  });
  console.log('1. Admin and 2 Team sockets connected.');

  // Register Team 1
  let team1Id = null;
  await new Promise((resolve, reject) => {
    team1Socket.emit('registerTeam', {
      name: 'Logic Knights',
      leader: 'Alice',
      members: ['Alice', 'Bob', 'Charlie'],
      password: 'knight_pass_123',
      color: '#00e5ff',
      icon: '⚡'
    }, (res) => {
      if (res && res.success) {
        team1Id = res.teamId;
        console.log('2. Team 1 registered:', res.team && res.team.name, '| Verified:', res.team && res.team.verified);
        resolve();
      } else {
        reject(new Error(res ? res.error : 'Reg 1 failed'));
      }
    });
  });

  // Register Team 2
  let team2Id = null;
  await new Promise((resolve, reject) => {
    team2Socket.emit('registerTeam', {
      name: 'Circuit Breakers',
      leader: 'David',
      members: ['David', 'Emma'],
      password: 'breaker_pass_456',
      color: '#ffb700',
      icon: '🤖'
    }, (res) => {
      if (res && res.success) {
        team2Id = res.teamId;
        console.log('3. Team 2 registered:', res.team && res.team.name, '| Verified:', res.team && res.team.verified);
        resolve();
      } else {
        reject(new Error(res ? res.error : 'Reg 2 failed'));
      }
    });
  });

  // Admin approves all teams
  await new Promise((resolve) => {
    adminSocket.emit('adminVerifyAllTeams');
    adminSocket.on('allTeamsVerified', () => {
      console.log('4. Admin approved all registered teams!');
      resolve();
    });
    setTimeout(resolve, 1000);
  });

  // Team 1 joins game
  await new Promise((resolve, reject) => {
    team1Socket.emit('joinGame', {
      teamId: team1Id,
      passcode: 'knight_pass_123'
    });
    team1Socket.on('joinSuccess', (data) => {
      console.log('5. Team 1 joined session:', data.name, '— Verified to bid:', data.team && data.team.verified);
      resolve();
    });
    team1Socket.on('error', (err) => reject(new Error(err)));
    setTimeout(() => reject(new Error('Team 1 join timeout')), 4000);
  });

  // Team 2 joins game
  await new Promise((resolve, reject) => {
    team2Socket.emit('joinGame', {
      teamId: team2Id,
      passcode: 'breaker_pass_456'
    });
    team2Socket.on('joinSuccess', (data) => {
      console.log('6. Team 2 joined session:', data.name, '— Verified to bid:', data.team && data.team.verified);
      resolve();
    });
    team2Socket.on('error', (err) => reject(new Error(err)));
    setTimeout(() => reject(new Error('Team 2 join timeout')), 4000);
  });

  // Admin starts auction
  let activeComponent = null;
  await new Promise((resolve, reject) => {
    adminSocket.emit('startAuction');
    adminSocket.on('newPlayer', (data) => {
      activeComponent = data.player;
      console.log('7. Live Auction started! Active Component:', `#${data.player.id} ${data.player.name} [${data.player.role}] @ ${data.startingBid} pts`);
      resolve();
    });
    setTimeout(() => reject(new Error('Start auction timeout')), 5000);
  });

  // Team 1 places +1 pt bid
  await new Promise((resolve, reject) => {
    team1Socket.emit('placeBid', { amount: 1 });
    team1Socket.on('bidPlaced', (data) => {
      console.log('8. Team 1 bid +1 pt -> Current High Bid:', data.bid, 'pts by', data.teamName);
      resolve();
    });
    team1Socket.on('bidRejected', (data) => reject(new Error(data.message)));
    setTimeout(() => reject(new Error('Team 1 bid timeout')), 4000);
  });

  // Team 2 places +2 pts bid
  await new Promise((resolve, reject) => {
    team2Socket.emit('placeBid', { amount: 2 });
    team2Socket.on('bidPlaced', (data) => {
      console.log('9. Team 2 bid +2 pts -> Current High Bid:', data.bid, 'pts by', data.teamName);
      resolve();
    });
    team2Socket.on('bidRejected', (data) => reject(new Error(data.message)));
    setTimeout(() => reject(new Error('Team 2 bid timeout')), 4000);
  });

  // Team 1 places +5 pts bid
  await new Promise((resolve, reject) => {
    team1Socket.emit('placeBid', { amount: 5 });
    team1Socket.on('bidPlaced', (data) => {
      console.log('10. Team 1 bid +5 pts -> Current High Bid:', data.bid, 'pts by', data.teamName);
      resolve();
    });
    team1Socket.on('bidRejected', (data) => reject(new Error(data.message)));
    setTimeout(() => reject(new Error('Team 1 second bid timeout')), 4000);
  });

  // Admin confirms sale
  let soldInfo = null;
  await new Promise((resolve, reject) => {
    adminSocket.emit('sellPlayer');
    adminSocket.on('playerSold', (data) => {
      soldInfo = data;
      console.log('11. Component SOLD!', data.player && data.player.name, 'awarded to:', data.teamName, 'for', data.soldPrice, 'pts!');
      resolve();
    });
    setTimeout(() => reject(new Error('Sell timeout')), 4000);
  });

  // Clean disconnect
  await new Promise((resolve) => setTimeout(resolve, 600));
  adminSocket.close();
  team1Socket.close();
  team2Socket.close();

  console.log('--- ALL FULL MULTIPLAYER LOGIC CIRCUIT AUCTION TESTS PASSED PERFECTLY! ---');
  process.exit(0);
}

testAuctionFlow().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
