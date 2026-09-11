var toastTimeout = null;
window.showToast = function(msg, type = 'info', duration = 3000) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.className = `toast ${type} show`;
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, duration);
};
var showToast = window.showToast;

var isVercelHost = typeof window !== 'undefined' && (window.location.hostname.includes('vercel.app') || window.location.hostname.includes('now.sh'));
var socket = null;
if (typeof io !== 'undefined') {
  socket = io({
    transports: isVercelHost ? ['polling'] : ['websocket', 'polling'],
    reconnection: !isVercelHost,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    timeout: 5000,
  });
  socket.on('connect_error', () => {
    // Graceful fallback to HTTP sync polling
  });
} else {
  console.warn('Socket.IO library not yet ready, using dummy socket fallback.');
  socket = { on: () => {}, emit: () => {}, close: () => {} };
}
window.socket = socket;

// automatically try to recover saved session when socket reconnects
socket.on('connect', () => {
  const saved = getSavedSession();
  if (!saved) return;
  if (myTeamId) return;
  if (saved.reconnectToken) {
    socket.emit('reconnectGame', { token: saved.reconnectToken });
  } else if (saved.teamId && saved.password) {
    socket.emit('joinGame', { teamId: saved.teamId, password: saved.password });
  }
});

let myTeamId = null;
let myPass = null;
let selectedTeamId = null;
let isAdmin = false;
let gameState = null;
let availableTeams = [];
let currentTimerMax = 15;
let previewAnimationFrame = null;
let previewWheelHandler = null;
let previewWheelTarget = null;
const PLAYING_XI_SIZE = 11;
const SUBSTITUTE_SIZE = 4;
const MAX_SQUAD_SIZE = 53;

const ROLE_EMOJIS = {
  'Input': '🎚️',
  'Output': '💡',
  'Logic Gates': '⚡',
  'Decoders / Data Selectors': '🔀',
  'Sequential Elements': '⏱️',
  'Annotation': '🏷️',
  'Misc Components': '🧮',
  'Microcontroller': '🎛️',
  'Sensor': '📡',
  'Communication': '📶',
  'IC & Logic': '⚡',
  'Display & Actuator': '📟',
  'Power & Passive': '🔋',
};

function getSavedSession() {
  try {
    return JSON.parse(localStorage.getItem('playerJoined') || 'null');
  } catch (error) {
    return null;
  }
}

function saveSession(data) {
  localStorage.setItem('playerJoined', JSON.stringify(data));
}

function clearSession() {
  localStorage.removeItem('playerJoined');
}

function isSavedSessionValid(saved, state) {
  if (!saved || !state || !state.teams) return false;
  const team = state.teams[saved.teamId];
  return Boolean(team && team.password === saved.password);
}

function lockLobbyControls() {
  const joinBtnEl = document.getElementById('joinBtn');
  if (joinBtnEl) joinBtnEl.disabled = true;
}

function unlockLobbyControls() {
  const joinBtnEl = document.getElementById('joinBtn');
  if (joinBtnEl) joinBtnEl.disabled = false;
}

function setMyTeamBadge() {
  const badge = document.getElementById('myTeamBadge');
  if (!badge) return;
  if (!myTeamId) {
    badge.textContent = '';
    return;
  }
  const myTeam = (gameState && gameState.myTeamFull) || (gameState && gameState.teams ? gameState.teams[myTeamId] : null);
  if (!myTeam) return;
  badge.textContent = `${myTeam.short || myTeam.name}`;
  badge.style.color = myTeam.color || '#00e5ff';
  badge.style.borderColor = myTeam.color || '#00e5ff';
}

function clearPreviewCarouselTimer() {
  if (previewAnimationFrame !== null) {
    window.cancelAnimationFrame(previewAnimationFrame);
    previewAnimationFrame = null;
  }
  if (previewWheelTarget && previewWheelHandler) {
    previewWheelTarget.removeEventListener('wheel', previewWheelHandler);
  }
  previewWheelHandler = null;
  previewWheelTarget = null;
}

function updateVerificationBanner() {
  const myTeam = (gameState && gameState.myTeamFull) || (myTeamId && gameState && gameState.teams ? gameState.teams[myTeamId] : null);
  const isVerified = Boolean(myTeam && myTeam.verified);

  const lobbyBanner = document.getElementById('lobbyVerificationBanner');
  if (lobbyBanner) {
    if (isVerified) {
      lobbyBanner.className = 'verification-banner verified';
      lobbyBanner.innerHTML = '<span>✅ Team Verified — You are approved to place bids during auction!</span>';
    } else {
      lobbyBanner.className = 'verification-banner pending';
      lobbyBanner.innerHTML = '<span>⏳ Awaiting Admin Approval — Bidding unlocks once verified by Admin.</span>';
    }
  }

  const auctionBadge = document.getElementById('auctionVerificationStatus');
  if (auctionBadge) {
    if (isVerified) {
      auctionBadge.className = 'team-badge-verified';
      auctionBadge.textContent = '✅ Verified to Bid';
    } else {
      auctionBadge.className = 'team-badge-pending';
      auctionBadge.textContent = '⏳ Pending Approval';
    }
  }

  const btn1 = document.getElementById('bidPlus1Btn');
  const btn2 = document.getElementById('bidPlus2Btn');
  const btn5 = document.getElementById('bidPlus5Btn');
  const customBtn = document.getElementById('customBidBtn');
  const customInput = document.getElementById('customBidInput');

  const disabled = !isVerified;
  if (btn1) btn1.disabled = disabled;
  if (btn2) btn2.disabled = disabled;
  if (btn5) btn5.disabled = disabled;
  if (customBtn) customBtn.disabled = disabled;
  if (customInput) customInput.disabled = disabled;
}

function showJoinedScreen() {
  const lobbyContainer = document.querySelector('#lobbyScreen .lobby-container');
  const joinedScreen = document.getElementById('joinedScreen');

  if (lobbyContainer) lobbyContainer.style.display = 'none';
  if (joinedScreen) joinedScreen.style.display = 'flex';

  const joinedTeam = document.getElementById('joinedTeam');
  const myTeam = (gameState && gameState.myTeamFull) || (myTeamId && gameState && gameState.teams ? gameState.teams[myTeamId] : null);
  if (joinedTeam) {
    joinedTeam.textContent = myTeam ? `${myTeam.short || myTeam.name} | ${myTeam.name}` : (myTeamId ? myTeamId.toUpperCase() : '--');
  }

  updateVerificationBanner();
  switchScreen('lobbyScreen');
}

function showLobbyJoinScreen() {
  const lobbyContainer = document.querySelector('#lobbyScreen .lobby-container');
  const joinedScreen = document.getElementById('joinedScreen');

  if (lobbyContainer) lobbyContainer.style.display = '';
  if (joinedScreen) joinedScreen.style.display = 'none';
  clearPreviewCarouselTimer();

  switchScreen('lobbyScreen');
}

function showAuctionScreen() {
  switchScreen('auctionScreen');
  const joinedScreen = document.getElementById('joinedScreen');
  const lobbyContainer = document.querySelector('#lobbyScreen .lobby-container');
  const waitingScreen = document.getElementById('waitingScreen');
  const auctionLayout = document.getElementById('auctionLayout');
  const hostBadge = document.getElementById('hostBadge');
  if (joinedScreen) joinedScreen.style.display = 'none';
  if (lobbyContainer) lobbyContainer.style.display = '';
  if (waitingScreen) waitingScreen.style.display = 'none';
  clearPreviewCarouselTimer();
  if (auctionLayout) auctionLayout.style.display = '';
  if (hostBadge) hostBadge.textContent = 'ADMIN CONTROLLED';
  updateVerificationBanner();
}

function refreshJoinedGalleryIfVisible() {
  const joinedScreen = document.getElementById('joinedScreen');
  if (!joinedScreen || joinedScreen.style.display !== 'flex') return;
  renderPlayersGallery((gameState && gameState.players) ? gameState.players : []);
}

socket.on('init', ({ gameState: gs, availableTeams: teams, allPlayers, isAdmin: admin }) => {
  isAdmin = admin || false;
  gameState = gs || {};
  availableTeams = Array.isArray(teams) ? teams : [];
  if (Array.isArray(allPlayers)) {
    gameState.players = allPlayers.slice();
  }

  const saved = getSavedSession();
  const hasValidSavedSession = isSavedSessionValid(saved, gameState);

  if (hasValidSavedSession) {
    myPass = saved.password;
    myTeamId = saved.teamId;
    selectedTeamId = saved.teamId;
    lockLobbyControls();
    setMyTeamBadge();

    if (saved.reconnectToken) {
      socket.emit('reconnectGame', { token: saved.reconnectToken });
    }
  } else if (saved && gameState.phase === 'lobby') {
    clearSession();
    myPass = null;
    myTeamId = null;
    selectedTeamId = null;
    unlockLobbyControls();
  }

  renderLobby();

  if (gameState.phase === 'auction') {
    showAuctionScreen();
    renderTeamsOverview();
    renderMyPlayersDashboard();
    
    if (!myTeamId && !isAdmin) {
      showSessionRecovery();
    }

    if (gameState.currentPlayer) {
      renderPlayerSpotlight(gameState.currentPlayer, gameState.currentBid || gameState.currentPlayer.basePrice);
    }
    updateBidDisplay(gameState.currentBid || 0, gameState.currentBidder, null);
    document.getElementById('remainingCount').textContent = gameState.remainingInQueue ?? '--';
    updateTimer(gameState.timerSeconds || currentTimerMax);
  } else if (gameState.phase === 'finished') {
    renderFinishedScreen(
      gameState.teams || {},
      gameState.soldHistory || [],
      gameState.unsoldPlayers || [],
      gameState.resultReview || null
    );
    switchScreen('finishedScreen');
  } else if (hasValidSavedSession) {
    showJoinedScreen();
    renderPlayersGallery((gameState && gameState.players) ? gameState.players : []);
  } else {
    showLobbyJoinScreen();
  }
});

function showTeamReveal(team) {
  const reveal = document.getElementById('revealScreen');
  if (!reveal || !team) return;
  const logo = document.getElementById('revealLogo');
  const icon = document.getElementById('revealLogoIcon');
  const nameEl = document.getElementById('revealTeamName');
  const statusEl = document.getElementById('revealStatus');

  if (team.logo) {
    logo.src = team.logo;
    logo.style.display = 'inline-block';
    icon.style.display = 'none';
  } else {
    logo.style.display = 'none';
    icon.style.display = 'block';
    icon.textContent = team.icon || '⚡';
  }

  if (nameEl) nameEl.textContent = team.name || team.short || '';
  if (statusEl) {
    statusEl.innerHTML = team.verified
      ? '<span class="team-badge-verified">✅ Verified</span>'
      : '<span class="team-badge-pending">⏳ Pending Admin Verification</span>';
  }

  reveal.style.display = 'flex';
  setTimeout(() => {
    reveal.style.display = 'none';
  }, 2200);
}

function handleJoinSuccess({ teamId, password, reconnectToken, reconnected, team }) {
  myPass = password;
  myTeamId = teamId;
  selectedTeamId = teamId;

  if (team) {
    if (!gameState) gameState = {};
    gameState.myTeamFull = team;
  }

  const previous = getSavedSession() || {};
  saveSession({
    password,
    teamId,
    reconnectToken: reconnectToken || previous.reconnectToken || null,
  });

  lockLobbyControls();
  setMyTeamBadge();
  updateVerificationBanner();
  renderLobby();
  renderMyPlayersDashboard();

  if (reconnected) {
    if (gameState && gameState.phase === 'auction') {
      showAuctionScreen();
    } else {
      showJoinedScreen();
      renderPlayersGallery((gameState && gameState.players) ? gameState.players : []);
    }
  } else {
    if (team) showTeamReveal(team);
    setTimeout(() => {
      if (gameState && gameState.phase === 'auction') {
        showAuctionScreen();
      } else {
        showJoinedScreen();
        renderPlayersGallery((gameState && gameState.players) ? gameState.players : []);
      }
    }, 1800);
  }

  showToast(reconnected ? `Reconnected` : `Joined as ${team ? (team.name || team.short) : teamId}`, 'success');
}
window.handleJoinSuccess = handleJoinSuccess;
socket.on('joinSuccess', handleJoinSuccess);

socket.on('reconnectFailed', ({ reason }) => {
  clearSession();
  myTeamId = null;
  myPass = null;
  selectedTeamId = null;
  unlockLobbyControls();
  showLobbyJoinScreen();
  renderLobby();
  showToast(reason || 'Reconnect failed. Join again.', 'error');
});

socket.on('teamJoined', ({ teams }) => {
  if (!gameState) gameState = {};
  gameState.teams = teams;
  renderLobby();
  renderTeamsOverview();
  renderMyPlayersDashboard();
});

socket.on('teamLeft', ({ teams, name }) => {
  if (!gameState) gameState = {};
  gameState.teams = teams;
  renderLobby();
  renderTeamsOverview();
  renderMyPlayersDashboard();
  showToast(`${name} left the lobby`, 'info', 2000);
});

socket.on('teamOwnerDisconnected', ({ name }) => {
  renderTeamsOverview();
  renderMyPlayersDashboard();
  showToast(`${name} disconnected`, 'error', 2500);
});

socket.on('leftGame', () => {
  clearSession();
  myTeamId = null;
  myPass = null;
  selectedTeamId = null;
  unlockLobbyControls();
  showLobbyJoinScreen();
  renderLobby();
  renderMyPlayersDashboard();
  showToast('You left the team', 'info');
});

socket.on('teamVerified', ({ teamId, verified }) => {
  if (gameState && gameState.teams && gameState.teams[teamId]) {
    gameState.teams[teamId].verified = verified;
  }
  if (gameState && gameState.myTeamFull && gameState.myTeamFull.id === teamId) {
    gameState.myTeamFull.verified = verified;
    if (verified) {
      showToast('🎉 Your team has been APPROVED by the Admin! You can now bid.', 'success', 4000);
    } else {
      showToast('⚠️ Your team verification status was updated.', 'info', 3000);
    }
  }
  updateVerificationBanner();
  renderJoinedTeams();
  renderTeamsOverview();
});

socket.on('allTeamsVerified', ({ verified }) => {
  if (gameState && gameState.teams) {
    Object.values(gameState.teams).forEach(t => { t.verified = verified; });
  }
  if (gameState && gameState.myTeamFull) {
    gameState.myTeamFull.verified = verified;
  }
  if (verified) {
    showToast('🎉 All teams have been APPROVED by the Admin!', 'success', 3000);
  }
  updateVerificationBanner();
  renderJoinedTeams();
  renderTeamsOverview();
});

socket.on('auctionStarted', ({ gameState: gs }) => {
  gameState = gs;
  showAuctionScreen();
  renderTeamsOverview();
  renderMyPlayersDashboard();
  showToast('⚡ Logic Circuit Auction started!', 'info');
});

socket.on('newPlayer', ({ player, startingBid, remaining }) => {
  if (!gameState) gameState = {};
  gameState.currentPlayer = player;
  gameState.currentBid = startingBid;
  gameState.currentBidder = null;
  gameState.remainingInQueue = remaining;
  document.getElementById('remainingCount').textContent = remaining;
  renderPlayerSpotlight(player, startingBid);
  updateBidDisplay(startingBid, null, null);
  updateTimer(currentTimerMax);
});

socket.on('bidPlaced', ({ bid, bidderTeamId, teamName }) => {
  if (!gameState) gameState = {};
  gameState.currentBid = bid;
  gameState.currentBidder = bidderTeamId;
  updateBidDisplay(bid, bidderTeamId, teamName);

  const isMe = bidderTeamId === myTeamId;
  if (!isMe) {
    showToast(`💰 ${teamName} bid ${bid} pts`, 'info', 2000);
  }

  const bidEl = document.getElementById('currentBidDisplay');
  if (bidEl) {
    bidEl.classList.remove('bump');
    void bidEl.offsetWidth;
    bidEl.classList.add('bump');
  }
});

socket.on('timerTick', ({ seconds }) => {
  updateTimer(seconds);
});

socket.on('playerSold', ({ player, soldTo, soldPrice, teamName }) => {
  if (!gameState) gameState = {};
  gameState.currentBidder = soldTo;
  const isWinner = soldTo === myTeamId;

  if (isWinner && gameState.myTeamFull) {
    const copy = { ...player, soldPrice };
    gameState.myTeamFull.players = gameState.myTeamFull.players || [];
    gameState.myTeamFull.players.push(copy);
    if (typeof gameState.myTeamFull.budget === 'number') {
      gameState.myTeamFull.budget -= soldPrice;
      const myBal = document.getElementById('myBalance');
      if (myBal) myBal.textContent = `${gameState.myTeamFull.budget} pts`;
    }
  }

  showSoldOverlay(
    player.name,
    isWinner ? 'YOU WON THIS COMPONENT' : `${teamName} WON THE BID`,
    soldPrice,
    isWinner ? 'win' : 'lost',
    soldTo
  );
  addFeedItem(
    isWinner
      ? `✅ WON: ${player.name} for ${soldPrice} pts`
      : `🔴 SOLD: ${player.name} -> ${teamName} (${soldPrice} pts)`,
    isWinner ? 'won' : 'lost'
  );
  renderTeamsOverview();
  renderMyPlayersDashboard();
});

socket.on('playerAdded', ({ player }) => {
  if (!gameState) gameState = {};
  if (!gameState.players) gameState.players = [];
  const idx = gameState.players.findIndex((item) => item.id === player.id);
  if (idx === -1) gameState.players.push(player);
  else gameState.players[idx] = player;
  refreshJoinedGalleryIfVisible();
  showToast(`New component added: ${player.name}`, 'info');
});

socket.on('playerUpdated', ({ player }) => {
  if (!gameState) gameState = {};
  if (!gameState.players) gameState.players = [];
  const idx = gameState.players.findIndex((item) => item.id === player.id);
  if (idx === -1) gameState.players.push(player);
  else gameState.players[idx] = player;

  if (gameState.currentPlayer && gameState.currentPlayer.id === player.id) {
    gameState.currentPlayer = player;
    renderPlayerSpotlight(player, gameState.currentBid || player.basePrice || 0);
  }

  refreshJoinedGalleryIfVisible();
});

socket.on('playerDeleted', ({ playerId }) => {
  if (!gameState || !Array.isArray(gameState.players)) return;
  gameState.players = gameState.players.filter((item) => item.id !== playerId);
  refreshJoinedGalleryIfVisible();
});

socket.on('teamsUpdate', ({ teams }) => {
  if (!gameState) gameState = {};
  gameState.teams = teams;
  renderTeamsOverview();
  renderJoinedTeams();
  updateVerificationBanner();
});

socket.on('myTeam', ({ team }) => {
  if (team && team.id === myTeamId) {
    if (!gameState) gameState = {};
    gameState.myTeamFull = team;
    const balEl = document.getElementById('myBalance');
    if (balEl) balEl.textContent = `${team.budget} pts`;
    renderMyPlayersDashboard();
    updateVerificationBanner();
  }
});

socket.on('playerUnsold', ({ player }) => {
  showSoldOverlay(player.name, 'UNSOLD', player.basePrice || gameState.currentBid || 0, 'unsold');
  addFeedItem(`❌ UNSOLD: ${player.name}`, 'unsold');
  showToast(`${player.name} unsold`, 'error', 2000);
});

socket.on('auctionFinished', ({ teams, soldHistory, unsoldPlayers, resultReview }) => {
  if (!gameState) gameState = {};
  gameState.teams = teams;
  gameState.soldHistory = soldHistory;
  gameState.phase = 'finished';
  gameState.resultReview = resultReview || null;
  clearSession();

  setTimeout(() => {
    renderFinishedScreen(teams, soldHistory, unsoldPlayers, gameState.resultReview || null);
    switchScreen('finishedScreen');
  }, 2500);
});

socket.on('resultUpdate', ({ resultReview }) => {
  if (!gameState) gameState = {};
  gameState.resultReview = resultReview || null;
  if (gameState.phase === 'finished') {
    renderFinishedScreen(
      gameState.teams || {},
      gameState.soldHistory || [],
      gameState.unsoldPlayers || [],
      gameState.resultReview || null
    );
  }
});

socket.on('gameReset', ({ message }) => {
  clearSession();
  myTeamId = null;
  myPass = null;
  selectedTeamId = null;
  showToast(message || 'Auction reset', 'info');
  setTimeout(() => window.location.reload(), 1500);
});

socket.on('auctionPaused', ({ gameState: gs }) => {
  gameState = gs;
  showToast('⏸️ Auction paused', 'info');
});

socket.on('auctionResumed', ({ gameState: gs }) => {
  gameState = gs;
  showToast('▶️ Auction resumed', 'info');
});

socket.on('error', (msg) => {
  showToast(`⚠️ ${msg}`, 'error');
});

socket.on('userLeft', ({ name }) => {
  showToast(`${name} disconnected`, 'error', 3000);
});

socket.on('stateUpdate', (gs) => {
  const previousPlayers = (gameState && gameState.players) ? gameState.players : [];
  gameState = gs || {};
  gameState.players = previousPlayers;
  renderTeamsOverview();
  renderMyPlayersDashboard();
  refreshJoinedGalleryIfVisible();
  updateVerificationBanner();
});

function switchScreen(id) {
  document.querySelectorAll('.screen').forEach((screen) => screen.classList.remove('active'));
  const target = document.getElementById(id);
  if (target) target.classList.add('active');
}

function renderLobby() {
  renderJoinedTeams();
}

function renderJoinedTeams() {
  const list = document.getElementById('joinedTeamsList');
  if (!list) return;
  list.innerHTML = '';
  if (!gameState || !gameState.teams) return;

  const teams = Object.values(gameState.teams);
  if (!teams.length) {
    list.innerHTML = '<div style="color:var(--text-dim);font-size:13px;padding:8px 0;">No teams registered yet. Be the first to register above!</div>';
    return;
  }

  teams.forEach((team) => {
    const chip = document.createElement('div');
    chip.className = 'joined-team-chip';
    chip.style.borderLeft = `3px solid ${team.color || '#00e5ff'}`;
    const isVerified = Boolean(team.verified);
    const memberCount = Array.isArray(team.members) && team.members.length ? `${team.members.length} members` : (team.leader ? '1 member' : '0 members');
    chip.innerHTML = `
      <div style="display:flex; align-items:center; gap:8px; justify-content:space-between; width:100%;">
        <div style="display:flex; align-items:center; gap:8px;">
          ${team.logo ? `<img src="${team.logo}" style="width:24px; height:24px; border-radius:50%; object-fit:cover;" />` : `<span style="font-size:16px;">${escapeHtml(team.icon || '⚡')}</span>`}
          <strong>${escapeHtml(team.name || team.short)}</strong>
          <span style="font-size:12px; opacity:0.8;">(${escapeHtml(memberCount)})</span>
        </div>
        ${isVerified ? '<span class="team-badge-verified">✅ Verified</span>' : '<span class="team-badge-pending">⏳ Pending</span>'}
      </div>
    `;
    list.appendChild(chip);
  });
}

async function joinGame() {
  if (myTeamId) {
    showToast('You are already joined', 'info');
    return;
  }

  const code = document.getElementById('teamCode').value.trim();
  if (!code) {
    showToast('Enter your passcode / PIN', 'error');
    return;
  }

  const joinBtn = document.getElementById('joinBtn');
  if (joinBtn) {
    joinBtn.disabled = true;
    joinBtn.textContent = 'ENTERING ROOM...';
  }

  myPass = code;

  // 1. Emit via socket if connected
  if (window.socket && window.socket.connected) {
    socket.emit('joinGame', { password: code });
  }

  // 2. Also authenticate via HTTP REST API for serverless/Vercel guarantee
  try {
    const res = await fetch('/api/teams/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: code }),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      handleJoinSuccess({
        teamId: data.teamId,
        password: code,
        reconnectToken: data.reconnectToken,
        reconnected: false,
        team: data.team,
      });
    } else {
      if (!window.socket || !window.socket.connected) {
        showToast(data.error || 'Invalid team passcode', 'error');
      }
    }
  } catch (err) {
    if (!window.socket || !window.socket.connected) {
      showToast('Network error connecting to team', 'error');
    }
  } finally {
    if (joinBtn) {
      joinBtn.disabled = false;
      joinBtn.textContent = 'ENTER AUCTION ROOM';
    }
  }
}

function leaveGame() {
  if (!myTeamId) {
    showToast('You are not in a team', 'error');
    return;
  }
  socket.emit('leaveGame');
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeSvgText(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function getInlineFallbackImage(name) {
  const label = String(name || 'Component').trim().slice(0, 22) || 'Component';
  const safeLabel = escapeSvgText(label);
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='320' height='420' viewBox='0 0 320 420'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0%' stop-color='#1a233a'/><stop offset='100%' stop-color='#0a0f1d'/></linearGradient></defs><rect width='320' height='420' rx='12' fill='url(#g)'/><rect x='8' y='8' width='304' height='404' rx='8' fill='none' stroke='#00d2ff' stroke-width='1.5' stroke-opacity='0.3'/><rect x='90' y='110' width='140' height='140' rx='14' fill='#111927' stroke='#ffd700' stroke-width='2'/><text x='160' y='195' text-anchor='middle' font-size='48'>⚡</text><text x='160' y='320' text-anchor='middle' fill='#ffd700' font-family='Arial,sans-serif' font-size='16' font-weight='bold'>${safeLabel}</text><text x='160' y='350' text-anchor='middle' fill='#747d8c' font-family='Arial,sans-serif' font-size='12'>LOGIC COMPONENT</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function getReliableImageSource(player) {
  const fallback = getInlineFallbackImage(player && player.name ? player.name : 'Component');
  const raw = String((player && player.image) || '').trim();

  if (!raw) {
    return { src: fallback, fallback };
  }

  const normalized = raw.replace(/\\/g, '/');
  if (/^data:image\//i.test(normalized)) {
    return { src: normalized, fallback };
  }
  if (/^https?:\/\//i.test(normalized)) {
    return { src: encodeURI(normalized), fallback };
  }
  if (normalized.startsWith('/')) {
    return { src: normalized, fallback };
  }
  if (/^[a-zA-Z]:\//.test(normalized) || normalized.startsWith('file://')) {
    return { src: fallback, fallback };
  }

  return { src: `/${normalized.replace(/^\/+/, '')}`, fallback };
}

function renderPlayerSpotlight(player, startingBid) {
  const el = document.getElementById('playerSpotlight');
  if (!el || !player) return;
  const emoji = ROLE_EMOJIS[player.role] || '⚡';
  const safeName = escapeHtml(player.name || 'Unknown');
  const safeRole = escapeHtml(player.role || 'Component');
  const safeSymbolName = escapeHtml(player.symbolName || player.name || '');
  const safeSymbol = escapeHtml(player.symbol || '');
  const safeDesc = escapeHtml(player.description || '');
  const imageData = getReliableImageSource(player);

  el.innerHTML = `
    <div class="player-card-inner">
      <div class="player-image-section">
        <div class="player-image-wrapper" style="background: rgba(0,0,0,0.45); padding: 16px; border-radius: 12px; border: 1px solid rgba(0,229,255,0.25); text-align:center;">
          <img src="${imageData.src}" alt="${safeName}" class="player-image" loading="lazy" decoding="async"
            style="object-fit: contain; max-height: 220px; width: 100%;"
            data-fallback="${imageData.fallback}"
            onerror="if (this.dataset.fallback && this.src !== this.dataset.fallback) { this.src = this.dataset.fallback; }" />
        </div>
      </div>
      <div class="player-info-section">
        <div class="player-name-display" style="color:var(--gold); font-size: 30px; font-family:'Bebas Neue',sans-serif; letter-spacing: 1.5px;">${safeName}</div>
        
        ${safeSymbol ? `
          <div class="spotlight-symbol-badge">
            <span>Symbol: <strong>${safeSymbolName}</strong> [ ${safeSymbol} ]</span>
          </div>
        ` : ''}

        <div class="price-display" style="color:var(--neon-green); font-size: 28px; font-weight: bold; margin: 8px 0;">${startingBid} pts</div>
        <div class="role-display" style="font-size: 15px; color: var(--neon-cyan); margin-bottom: 10px;">${emoji} ${safeRole}</div>
        
        ${safeDesc ? `
          <div style="font-size: 13px; color: #cbd5e1; line-height: 1.5; background: rgba(255,255,255,0.04); padding: 10px 14px; border-radius: 8px; border-left: 3px solid var(--neon-cyan);">
            ${safeDesc}
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

function renderPlayersGallery(players) {
  const wrap = document.getElementById('playersGallery');
  if (!wrap) return;
  clearPreviewCarouselTimer();
  wrap.innerHTML = '';
  const ordered = players || [];

  if (!ordered.length) {
    wrap.innerHTML = '<div style="color:var(--text-dim);padding:10px">No components available</div>';
    return;
  }

  const track = document.createElement('div');
  track.className = 'gallery-sequence-track';

  function getCardMarkup(player) {
    const imageData = getReliableImageSource(player);
    const safeName = escapeHtml(player.name || 'Unknown');
    return `
      <div class="gallery-sequence-card">
        <div class="gallery-sequence-image" style="background:rgba(0,0,0,0.4);">
          <img src="${imageData.src}" alt="${safeName}" loading="lazy" decoding="async"
            data-fallback="${imageData.fallback}"
            onerror="if (this.dataset.fallback && this.src !== this.dataset.fallback) { this.src = this.dataset.fallback; }" />
        </div>
        <div class="gallery-sequence-name">${safeName}</div>
      </div>
    `;
  }

  const cardMarkup = ordered.map((player) => getCardMarkup(player)).join('');
  const isSingleCard = ordered.length <= 1;
  if (isSingleCard) {
    track.innerHTML = cardMarkup;
    track.classList.add('single');
    wrap.appendChild(track);
    return;
  }

  track.innerHTML = `${cardMarkup}${cardMarkup}`;
  wrap.appendChild(track);

  const loopWidth = track.scrollWidth / 2;
  if (!Number.isFinite(loopWidth) || loopWidth <= 0) {
    return;
  }

  let offsetX = -loopWidth;
  const baseSpeed = Math.max(0.06, Math.min(0.14, 0.06 + ordered.length * 0.00012));
  track.style.transform = `translate3d(${offsetX}px, 0, 0)`;

  const step = () => {
    offsetX += baseSpeed;

    if (offsetX >= 0) {
      offsetX -= loopWidth;
    } else if (offsetX <= -loopWidth) {
      offsetX += loopWidth;
    }

    track.style.transform = `translate3d(${offsetX}px, 0, 0)`;
    previewAnimationFrame = window.requestAnimationFrame(step);
  };

  previewAnimationFrame = window.requestAnimationFrame(step);
}

function updateBidDisplay(amount, bidderTeamId, teamName) {
  const el = document.getElementById('currentBidDisplay');
  if (el) el.textContent = `${amount} pts`;

  const leaderEl = document.getElementById('bidLeaderDisplay');
  if (!leaderEl) return;
  if (bidderTeamId && teamName) {
    const isMe = bidderTeamId === myTeamId;
    leaderEl.textContent = isMe ? '🏆 You are leading!' : `${teamName} leads`;
    leaderEl.style.color = isMe ? 'var(--neon-green)' : 'var(--gold)';
  } else {
    leaderEl.textContent = 'No bids yet';
    leaderEl.style.color = 'var(--text-dim)';
  }
}

function updateTimer(seconds) {
  const circle = document.getElementById('timerCircle');
  const timerText = document.getElementById('timerText');
  if (!circle || !timerText) return;

  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (seconds / currentTimerMax) * circumference;
  circle.style.strokeDashoffset = offset;
  timerText.textContent = seconds;

  circle.classList.remove('urgent', 'warning');
  if (seconds <= 4) circle.classList.add('urgent');
  else if (seconds <= 8) circle.classList.add('warning');
}

function renderTeamsOverview() {
  const el = document.getElementById('teamsOverview');
  if (!el || !gameState || !gameState.teams) return;
  el.innerHTML = '';

  Object.values(gameState.teams).forEach((team) => {
    const isLeading = gameState.currentBidder === team.id;
    const isMyTeam = team.id === myTeamId;
    const div = document.createElement('div');
    div.className = `team-card${isLeading ? ' leading' : ''}`;
    
    let showDetails = isAdmin || isMyTeam;
    let fullTeam = isMyTeam && gameState.myTeamFull ? gameState.myTeamFull : team;
    
    const budget = showDetails ? (fullTeam.budget || 0) : '?';
    const playerCount = showDetails ? ((fullTeam.players || []).length) : ((team.players || []).length || 0);
    const ownerName = team.ownerName || team.name || 'Unknown';
    const isVerified = Boolean(team.verified);
    
    div.innerHTML = `
      <div class="team-color-dot" style="background:${team.color || '#00e5ff'}"></div>
      <div class="team-card-info">
        <div class="team-card-name">
          ${team.short || team.name} ${isLeading ? '⚡' : ''}
          ${isVerified ? '<span class="team-badge-verified">✅</span>' : '<span class="team-badge-pending">⏳</span>'}
        </div>
        <div class="team-card-owner">${isMyTeam ? '👤 ' + ownerName : ownerName}</div>
      </div>
      <div style="text-align:right;">
        <div class="team-card-budget" style="color:var(--neon-green); font-weight:bold;">${budget} pts</div>
        <div class="team-card-players" style="font-size:11px; opacity:0.8;">${playerCount} components</div>
      </div>
    `;
    el.appendChild(div);
  });
}

function renderMyPlayersDashboard() {
  const list = document.getElementById('myPlayersList');
  if (!list) return;
  
  let myTeamData = null;
  if (myTeamId) {
    if (gameState && gameState.myTeamFull) {
      myTeamData = gameState.myTeamFull;
    } else if (gameState && gameState.teams && gameState.teams[myTeamId]) {
      myTeamData = gameState.teams[myTeamId];
    }
  }
  
  if (!myTeamId || !myTeamData) {
    list.innerHTML = '<div class="my-player-empty">Join a team to track acquired components</div>';
    return;
  }

  const players = myTeamData.players || [];
  if (!players.length) {
    list.innerHTML = '<div class="my-player-empty">No components won yet. Place bids to build your circuit!</div>';
    return;
  }

  list.innerHTML = players.map((player) => {
    const imageData = getReliableImageSource(player);
    const safeName = escapeHtml(player.name || 'Unknown');
    const safeRole = escapeHtml(player.role || 'Component');
    return `
    <div class="my-player-card won" style="display:flex; align-items:center; gap:8px; padding:6px; background:rgba(255,255,255,0.03); border-radius:6px; margin-bottom:6px;">
      <img src="${imageData.src}" alt="${safeName}" loading="lazy" decoding="async"
        style="width:36px; height:36px; object-fit:contain; background:rgba(0,0,0,0.3); border-radius:4px; padding:2px;"
        data-fallback="${imageData.fallback}"
        onerror="if (this.dataset.fallback && this.src !== this.dataset.fallback) { this.src = this.dataset.fallback; }" />
      <div class="my-player-meta" style="flex:1;">
        <div class="my-player-name" style="font-size:13px; font-weight:bold; color:var(--gold);">${safeName}</div>
        <div class="my-player-role" style="font-size:11px; color:var(--neon-cyan);">${safeRole}</div>
        <div class="my-player-price" style="font-size:11px; color:var(--neon-green);">${player.soldPrice || player.basePrice} pts</div>
      </div>
    </div>
    `;
  }).join('');
}

function addFeedItem(text, type = 'sold') {
  const feed = document.getElementById('auctionFeed');
  if (!feed) return;
  const item = document.createElement('div');
  item.className = `feed-item ${type}`;
  item.textContent = text;
  feed.insertBefore(item, feed.firstChild);
  while (feed.children.length > 25) feed.removeChild(feed.lastChild);
}

function getMySquadSize() {
  const players = gameState && gameState.myTeamFull && Array.isArray(gameState.myTeamFull.players)
    ? gameState.myTeamFull.players
    : [];
  return players.length;
}

function placeBid(increment) {
  if (!myTeamId) {
    showToast('Join a team first', 'error');
    return;
  }
  const myTeam = (gameState && gameState.myTeamFull) || (gameState && gameState.teams ? gameState.teams[myTeamId] : null);
  if (myTeam && myTeam.verified === false) {
    showToast('⏳ Your team is awaiting Admin Approval before bidding.', 'error', 3500);
    return;
  }
  if (!gameState || !gameState.currentPlayer) {
    showToast('No component is up for bidding', 'error');
    return;
  }

  const match = String(increment).match(/\+?(\d+)/);
  if (!match) return;

  const addAmount = parseInt(match[1], 10);
  const newBid = (gameState.currentBid || 0) + addAmount;

  // 1. Send via WebSocket if connected
  if (window.socket && window.socket.connected) {
    socket.emit('placeBid', { amount: newBid });
  }

  // 2. Also send via REST API for serverless/Vercel guarantee
  fetch('/api/auction/bid', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      teamId: myTeamId,
      password: myPass,
      amount: newBid,
    }),
  })
    .then(async (res) => {
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Bid rejected', 'error');
      }
    })
    .catch(() => {});
}

function placeCustomBid() {
  if (!myTeamId) {
    showToast('Join a team first', 'error');
    return;
  }
  const myTeam = (gameState && gameState.myTeamFull) || (gameState && gameState.teams ? gameState.teams[myTeamId] : null);
  if (myTeam && myTeam.verified === false) {
    showToast('⏳ Your team is awaiting Admin Approval before bidding.', 'error', 3500);
    return;
  }
  if (!gameState || !gameState.currentPlayer) {
    showToast('No component is up for bidding', 'error');
    return;
  }

  const val = parseInt(document.getElementById('customBidInput').value, 10);
  if (!val || val <= 0) {
    showToast('Enter a valid bid amount (pts)', 'error');
    return;
  }

  // 1. Send via WebSocket if connected
  if (window.socket && window.socket.connected) {
    socket.emit('placeBid', { amount: val });
  }

  // 2. Also send via REST API
  fetch('/api/auction/bid', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      teamId: myTeamId,
      password: myPass,
      amount: val,
    }),
  })
    .then(async (res) => {
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Bid rejected', 'error');
      }
    })
    .catch(() => {});

  document.getElementById('customBidInput').value = '';
}

function getTeamLogo(teamId) {
  if (!gameState || !gameState.teams || !teamId) return null;
  const team = gameState.teams[teamId];
  return team ? team.logo : null;
}

function showSessionRecovery() {
  const overlay = document.getElementById('sessionRecoveryOverlay');
  if (!overlay) return;
  overlay.style.display = 'flex';
}

function recoverSession() {
  const code = document.getElementById('recoveryCode').value.trim();
  if (!code) {
    showToast('Enter your passcode / PIN to recover', 'error');
    return;
  }
  myPass = code;
  socket.emit('joinGame', { password: code });
  const overlay = document.getElementById('sessionRecoveryOverlay');
  if (overlay) overlay.style.display = 'none';
}

function showSoldOverlay(playerName, subtitle, price, status = 'lost', teamId = null) {
  const existing = document.querySelector('.sold-overlay');
  if (existing) existing.remove();

  const styleMap = {
    win: { className: 'result-win', title: 'YOU WON' },
    lost: { className: 'result-lost', title: 'SOLD' },
    unsold: { className: 'result-unsold', title: 'UNSOLD' },
  };
  const tone = styleMap[status] || styleMap.lost;
  const logoUrl = teamId ? getTeamLogo(teamId) : null;

  const overlay = document.createElement('div');
  overlay.className = 'sold-overlay';
  overlay.innerHTML = `
    <div class="sold-banner ${tone.className}">
      ${logoUrl ? `<img src="${logoUrl}" style="width:90px; height:90px; object-fit:contain; margin-bottom:12px; animation: bounceIn 0.8s cubic-bezier(0.34, 1.56, 0.64, 1); border-radius:50%; border:3px solid var(--gold);">` : ''}
      <h2>${tone.title}</h2>
      <p style="font-size:24px;margin:8px 0; font-family:'Bebas Neue',sans-serif; letter-spacing:1px;">${playerName}</p>
      <p style="font-size:18px;font-weight:700;">${subtitle}</p>
      <p style="font-size:26px;margin-top:8px;color:var(--gold); font-weight:bold;">${price} Points</p>
    </div>
  `;
  document.body.appendChild(overlay);
  setTimeout(() => overlay.remove(), 3000);
}

function renderFinishedScreen(teams, soldHistory, unsoldPlayers, resultReview) {
  const grid = document.getElementById('finalTeams');
  if (!grid) return;
  grid.innerHTML = '';

  Object.values(teams).forEach((team) => {
    const card = document.createElement('div');
    const squad = Array.isArray(team.players) ? team.players : [];

    card.className = 'final-team-card';
    card.style.borderColor = `${team.color || '#00e5ff'}44`;

    const rows = squad.length
      ? squad.map((player) => `
        <div class="final-player-row">
          <div>
            <div style="font-weight:bold; color:var(--gold);">${escapeHtml(player.name)}</div>
            <div class="final-player-role">${escapeHtml(player.role)} | ${escapeHtml(player.symbolName || player.symbol || '')}</div>
          </div>
          <div class="final-player-price" style="color:var(--neon-green); font-weight:bold;">${player.soldPrice || player.basePrice} pts</div>
        </div>
      `).join('')
      : '<div style="color:var(--text-dim);font-size:13px;padding:10px 0">No components acquired</div>';

    card.innerHTML = `
      <div class="final-team-header" style="background:${team.color || '#00e5ff'}20; border-bottom:1px solid ${team.color || '#00e5ff'}33; padding:12px; display:flex; justify-content:space-between; align-items:center;">
        <div class="final-team-name" style="color:${team.color || '#00e5ff'}; font-weight:bold; font-size:18px;">
          ${team.short || team.name} - ${escapeHtml(team.name || team.ownerName)}
        </div>
        <div class="final-team-budget" style="color:var(--neon-green); font-weight:bold;">
          ${Number(team.budget) || 0} pts left
        </div>
      </div>
      <div class="final-team-players" style="padding:12px;">
        <div class="final-squad-label" style="font-size:12px; color:var(--neon-cyan); margin-bottom:8px; text-transform:uppercase;">Acquired Circuit Components (${squad.length})</div>
        ${rows}
      </div>
    `;
    grid.appendChild(card);
  });
}

function resetGame() {
  const adminPass = localStorage.getItem('adminPass');
  if (!adminPass) {
    showToast('Only admin can reset from control panel', 'error');
    return;
  }

  fetch('/api/reset', {
    method: 'POST',
    headers: { 'x-admin-pass': adminPass },
  })
    .then((res) => res.json())
    .then((json) => {
      if (json && json.success) {
        location.reload();
      } else {
        showToast(json && json.error ? json.error : 'Reset failed', 'error');
      }
    });
}


// Real-time State Synchronization Polling Loop (ensures sync on serverless / Vercel)
let syncInterval = null;
let lastRenderedPhase = null;

async function syncStateFromApi() {
  try {
    const res = await fetch('/api/sync');
    if (!res.ok) return;
    const data = await res.json();
    if (!data || !data.success) return;

    const gs = data.gameState || {};
    const teams = data.teams || {};

    if (!gameState) gameState = {};

    // Update player spotlight
    if (gs.currentPlayer && (!gameState.currentPlayer || gameState.currentPlayer.id !== gs.currentPlayer.id)) {
      gameState.currentPlayer = gs.currentPlayer;
      renderPlayerSpotlight(gs.currentPlayer, gs.currentBid || gs.currentPlayer.basePrice || 0);
    } else if (!gs.currentPlayer && gameState.currentPlayer) {
      gameState.currentPlayer = null;
    }

    // Update bid display
    if (typeof gs.currentBid === 'number' && (gs.currentBid !== gameState.currentBid || gs.currentBidder !== gameState.currentBidder)) {
      gameState.currentBid = gs.currentBid;
      gameState.currentBidder = gs.currentBidder;
      const bidderTeam = teams[gs.currentBidder];
      updateBidDisplay(gs.currentBid, gs.currentBidder, bidderTeam ? (bidderTeam.short || bidderTeam.name) : '');
    }

    // Update timer
    if (typeof gs.timerSeconds === 'number' && gs.phase === 'auction') {
      updateTimer(gs.timerSeconds);
    }

    // Phase transitions
    if (gs.phase && gs.phase !== gameState.phase) {
      gameState.phase = gs.phase;
      if (gs.phase === 'auction') {
        showAuctionScreen();
      } else if (gs.phase === 'finished' && lastRenderedPhase !== 'finished') {
        lastRenderedPhase = 'finished';
        renderFinishedScreen(teams, gs.soldHistory || [], gs.unsoldPlayers || [], data.resultReview);
        switchScreen('finishedScreen');
      }
    }

    gameState.teams = teams;
    gameState.soldHistory = gs.soldHistory || [];
    gameState.unsoldPlayers = gs.unsoldPlayers || [];
    if (data.allPlayers && Array.isArray(data.allPlayers)) {
      gameState.players = data.allPlayers;
    }

    if (myTeamId && teams[myTeamId]) {
      gameState.myTeamFull = teams[myTeamId];
      const balEl = document.getElementById('myBalance');
      if (balEl) balEl.textContent = `${teams[myTeamId].budget} pts`;
      renderMyPlayersDashboard();
      updateVerificationBanner();
    }

    renderTeamsOverview();
    renderJoinedTeams();
    updateVerificationBanner();
  } catch (err) {
    // silently catch offline/poll errors
  }
}

function startSyncLoop() {
  if (syncInterval) clearInterval(syncInterval);
  syncInterval = setInterval(syncStateFromApi, 1000);
  syncStateFromApi();
}

document.addEventListener('DOMContentLoaded', () => {
  const customBidInput = document.getElementById('customBidInput');
  if (customBidInput) {
    customBidInput.addEventListener('keypress', (event) => {
      if (event.key === 'Enter') placeCustomBid();
    });
  }

  const teamCode = document.getElementById('teamCode');
  if (teamCode) {
    teamCode.addEventListener('keypress', (event) => {
      if (event.key === 'Enter') joinGame();
    });
  }

  // Start real-time sync polling loop
  startSyncLoop();
});

