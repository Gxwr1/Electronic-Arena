const socket = io();

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
let myPass = null; // remember password for session save
let selectedTeamId = null;
let isAdmin = false;
let gameState = null;
let availableTeams = [];
let currentTimerMax = 30;
let previewAnimationFrame = null;
let previewWheelHandler = null;
let previewWheelTarget = null;
const PLAYING_XI_SIZE = 11;
const SUBSTITUTE_SIZE = 4;
const MAX_SQUAD_SIZE = PLAYING_XI_SIZE + SUBSTITUTE_SIZE;

const ROLE_EMOJIS = {
  Batter: '🏏',
  'Batter/WK': '🧤',
  'WK-Batter': '🧤',
  'All-Rounder': '⭐',
  'Fast Bowler': '🎯',
  Spinner: '🌀',
};

// ─── SET TEAM DRAG & DROP ───────────────────
let currentPlayingXI = {};

function openSetTeamModal() {
  const modal = document.getElementById('setTeamModal');
  if (!modal) return;

  modal.classList.add('active');
  
  // Load current playing XI from my team data
  const myTeam = gameState.myTeamFull || (myTeamId && gameState.teams ? gameState.teams[myTeamId] : null);
  currentPlayingXI = (myTeam && myTeam.playingXI) ? { ...myTeam.playingXI } : {};
  
  renderSetTeamInterface();
}

function closeSetTeamModal() {
  const modal = document.getElementById('setTeamModal');
  if (modal) modal.classList.remove('active');
}

function renderSetTeamInterface() {
  const poolEl = document.getElementById('playerPool');
  if (!poolEl) return;

  const myTeam = gameState.myTeamFull || (myTeamId && gameState.teams ? gameState.teams[myTeamId] : null);
  const squad = (myTeam && myTeam.players) ? myTeam.players : [];
  
  // Players already in slots
  const usedPlayerIds = Object.values(currentPlayingXI).filter(p => p).map(p => p.id);
  
  // Render Pool
  poolEl.innerHTML = squad
    .filter(p => !usedPlayerIds.includes(p.id))
    .map(p => renderDraggablePlayer(p))
    .join('');

  // Render Slots
  const slots = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10', 'p11'];
  slots.forEach(slotId => {
    const slotBox = document.querySelector(`.slot-box[data-slot="${slotId}"] .slot-drop-zone`);
    if (slotBox) {
      const player = currentPlayingXI[slotId];
      slotBox.innerHTML = player ? renderDraggablePlayer(player) : '';
    }
  });
}

function renderDraggablePlayer(player) {
  const imageData = getReliableImageSource(player);
  const safeName = escapeHtml(player.name || 'Unknown');
  return `
    <div class="draggable-player" draggable="true" ondragstart="handleDragStart(event)" id="drag-${player.id}" data-player-id="${player.id}">
      <img src="${imageData.src}" alt="${safeName}" 
        data-fallback="${imageData.fallback}"
        onerror="if (this.dataset.fallback && this.src !== this.dataset.fallback) { this.src = this.dataset.fallback; }" />
      <div class="draggable-player-info">
        <span class="drag-name">${safeName}</span>
        <span class="drag-role">${escapeHtml(player.role || 'Unknown')}</span>
      </div>
    </div>
  `;
}

function handleDragStart(e) {
  const playerId = e.target.closest('.draggable-player').dataset.playerId;
  e.dataTransfer.setData('playerId', playerId);
  
  // If dragging from a slot, remember which one
  const sourceSlot = e.target.closest('.slot-box');
  if (sourceSlot) {
    e.dataTransfer.setData('sourceSlot', sourceSlot.dataset.slot);
  }
}

function allowDrop(e) {
  e.preventDefault();
  const dropZone = e.target.closest('.slot-drop-zone') || e.target.closest('.player-pool');
  if (dropZone) dropZone.classList.add('drag-over');
}

function handleDrop(e) {
  e.preventDefault();
  const playerId = parseInt(e.dataTransfer.getData('playerId'), 10);
  const sourceSlotId = e.dataTransfer.getData('sourceSlot');
  
  const slotBox = e.target.closest('.slot-box');
  const poolZone = e.target.closest('.player-pool');
  
  // Find player data in my squad
  const myTeam = gameState.myTeamFull || (myTeamId && gameState.teams ? gameState.teams[myTeamId] : null);
  const player = (myTeam && myTeam.players) ? myTeam.players.find(p => p.id === playerId) : null;
  
  if (!player) return;

  if (slotBox) {
    const targetSlotId = slotBox.dataset.slot;
    
    // If there was a player in target slot, move them to pool or source slot
    const existingInTarget = currentPlayingXI[targetSlotId];
    
    if (sourceSlotId) {
      // Swapping slots or moving within slots
      currentPlayingXI[sourceSlotId] = existingInTarget;
    } else {
      // Moving from pool to slot
      // If target had someone, they go back to pool (handled by re-render)
    }
    
    currentPlayingXI[targetSlotId] = player;
  } else if (poolZone) {
    // Moving from slot to pool
    if (sourceSlotId) {
      currentPlayingXI[sourceSlotId] = null;
    }
  }

  // Clear drag-over classes
  document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
  
  renderSetTeamInterface();
}

function savePlayingXI() {
  const slots = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10', 'p11'];
  const count = slots.filter(s => currentPlayingXI[s]).length;
  
  if (count < 11) {
    const myTeam = gameState.myTeamFull || (myTeamId && gameState.teams ? gameState.teams[myTeamId] : null);
    const squadCount = (myTeam && myTeam.players) ? myTeam.players.length : 0;
    
    if (squadCount >= 11) {
       showToast(`Please select all 11 players (You have ${count} selected)`, 'error');
       return;
    } else {
       // Allow saving partial team if squad is not full yet
       showToast(`Saving partial team (${count} players)`, 'info');
    }
  }

  socket.emit('savePlayingXI', { teamId: myTeamId, playingXI: currentPlayingXI });
  // locally remember it so reopening modal shows latest XI immediately
  if (gameState && gameState.myTeamFull && gameState.myTeamFull.id === myTeamId) {
    gameState.myTeamFull.playingXI = { ...currentPlayingXI };
  }
  showToast('Playing XI saved!', 'success');
  closeSetTeamModal();
}

// Add event listeners for dragover removal
document.addEventListener('dragleave', (e) => {
  if (e.target.classList.contains('drag-over')) {
    e.target.classList.remove('drag-over');
  }
});

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
  document.querySelectorAll('.team-btn').forEach((button) => {
    button.style.pointerEvents = 'none';
    button.classList.add('disabled');
  });
}

function unlockLobbyControls() {
  const joinBtnEl = document.getElementById('joinBtn');
  if (joinBtnEl) joinBtnEl.disabled = false;
  document.querySelectorAll('.team-btn').forEach((button) => {
    button.style.pointerEvents = '';
    button.classList.remove('disabled');
  });
}

function setMyTeamBadge() {
  const badge = document.getElementById('myTeamBadge');
  if (!badge) return;
  if (!myTeamId) {
    badge.textContent = '';
    return;
  }
  const team = availableTeams.find((item) => item.id === myTeamId);
  if (!team) return;
  badge.textContent = `${team.short}`;
  badge.style.color = team.color;
  badge.style.borderColor = team.color;
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

function showJoinedScreen() {
  const lobbyContainer = document.querySelector('#lobbyScreen .lobby-container');
  const joinedScreen = document.getElementById('joinedScreen');

  if (lobbyContainer) lobbyContainer.style.display = 'none';
  if (joinedScreen) joinedScreen.style.display = 'flex';

  const joinedTeam = document.getElementById('joinedTeam');
  const team = availableTeams.find((item) => item.id === myTeamId);
  if (joinedTeam) {
    joinedTeam.textContent = team ? `${team.short} | ${team.name}` : (myTeamId ? myTeamId.toUpperCase() : '--');
  }

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
  const hostControlPanel = document.getElementById('hostControlPanel');
  const waitingScreen = document.getElementById('waitingScreen');
  const auctionLayout = document.getElementById('auctionLayout');
  const hostBadge = document.getElementById('hostBadge');
  if (joinedScreen) joinedScreen.style.display = 'none';
  if (lobbyContainer) lobbyContainer.style.display = '';
  if (hostControlPanel) hostControlPanel.style.display = 'none';
  if (waitingScreen) waitingScreen.style.display = 'none';
  clearPreviewCarouselTimer();
  if (auctionLayout) auctionLayout.style.display = '';
  if (hostBadge) hostBadge.textContent = 'ADMIN CONTROLLED';
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
    
    // IF NOT JOINED AND AUCTION IS RUNNING, SHOW RECOVERY OVERLAY
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

// helper to briefly reveal assigned team after code entry
function showTeamReveal(team) {
  const reveal = document.getElementById('revealScreen');
  if (!reveal || !team) return;
  const logo = document.getElementById('revealLogo');
  const nameEl = document.getElementById('revealTeamName');
  if (logo) logo.src = team.logo || '';
  if (nameEl) nameEl.textContent = team.name || team.short || '';
  reveal.style.display = 'flex';
  setTimeout(() => {
    reveal.style.display = 'none';
  }, 2000);
}

socket.on('joinSuccess', ({ teamId, password, reconnectToken, reconnected, team }) => {
  myPass = password;
  myTeamId = teamId;
  selectedTeamId = teamId;

  // store full team info if provided
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
  renderLobby();
  renderMyPlayersDashboard();

  if (reconnected) {
    // normal flow when recovering
    if (gameState && gameState.phase === 'auction') {
      showAuctionScreen();
    } else {
      showJoinedScreen();
      renderPlayersGallery((gameState && gameState.players) ? gameState.players : []);
    }
  } else {
    // new join: reveal team first then move to waiting/auction
    if (team) showTeamReveal(team);
    setTimeout(() => {
      if (gameState && gameState.phase === 'auction') {
        showAuctionScreen();
      } else {
        showJoinedScreen();
        renderPlayersGallery((gameState && gameState.players) ? gameState.players : []);
      }
    }, 2000);
  }

  showToast(reconnected ? `Reconnected` : `Joined`, 'success');
});

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
  myName = null;
  selectedTeamId = null;
  unlockLobbyControls();
  showLobbyJoinScreen();
  renderLobby();
  renderMyPlayersDashboard();
  showToast('You left the lobby', 'info');
});

socket.on('auctionStarted', ({ gameState: gs }) => {
  gameState = gs;
  showAuctionScreen();
  renderTeamsOverview();
  renderMyPlayersDashboard();
  showToast('🏏 Auction started!', 'info');
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
    showToast(`💰 ${teamName} bid ₹${bid}L`, 'info', 2000);
  }

  const bidEl = document.getElementById('currentBidDisplay');
  bidEl.classList.remove('bump');
  void bidEl.offsetWidth;
  bidEl.classList.add('bump');
});

socket.on('timerTick', ({ seconds }) => {
  updateTimer(seconds);
});

socket.on('playerSold', ({ player, soldTo, soldPrice, teamName, teamColor }) => {
  if (!gameState) gameState = {};
  gameState.currentBidder = soldTo;
  const isWinner = soldTo === myTeamId;

  // **immediately update local copy of my team for smooth UX**
  if (isWinner && gameState.myTeamFull) {
    // push a copy with soldPrice
    const copy = { ...player, soldPrice };
    gameState.myTeamFull.players = gameState.myTeamFull.players || [];
    gameState.myTeamFull.players.push(copy);
    // adjust budget locally as well
    if (typeof gameState.myTeamFull.budget === 'number') {
      gameState.myTeamFull.budget -= soldPrice;
    }
  }

  showSoldOverlay(
    player.name,
    isWinner ? 'YOU WON THIS PLAYER' : `${teamName} WON THE BID`,
    soldPrice,
    isWinner ? 'win' : 'lost',
    soldTo // Pass teamId for logo
  );
  addFeedItem(
    isWinner
      ? `✅ WON: ${player.name} for ₹${soldPrice}L`
      : `🔴 SOLD: ${player.name} -> ${teamName} ₹${soldPrice}L`,
    isWinner ? 'won' : 'lost'
  );
  renderTeamsOverview();
  renderMyPlayersDashboard();

  if (isWinner) {
    const squadSize = getMySquadSize();
    if (squadSize >= MAX_SQUAD_SIZE) {
      showToast('🎯 Squad full! Click "SET TEAM" to arrange your playing XI.', 'info', 4000);
      // also send whatever playingXI we have (possibly empty) so server stores a placeholder
      socket.emit('savePlayingXI', { teamId: myTeamId, playingXI: currentPlayingXI });
    }
  }
});

socket.on('playerAdded', ({ player }) => {
  if (!gameState) gameState = {};
  if (!gameState.players) gameState.players = [];
  const idx = gameState.players.findIndex((item) => item.id === player.id);
  if (idx === -1) gameState.players.push(player);
  else gameState.players[idx] = player;
  refreshJoinedGalleryIfVisible();
  showToast(`New player added: ${player.name}`, 'info');
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

// Updates sanitized public teams list (no budget/players visible)
socket.on('teamsUpdate', ({ teams }) => {
  if (!gameState) gameState = {};
  gameState.teams = teams;
  renderTeamsOverview();
});

// Updates my own team's full details (budget, players, etc.) - only sent to my socket
socket.on('myTeam', ({ team }) => {
  if (team && team.id === myTeamId) {
    // Store my team's full details (budget, players)
    if (!gameState) gameState = {};
    if (!gameState.myTeamFull) gameState.myTeamFull = {};
    gameState.myTeamFull = team;
    document.getElementById('myBalance').textContent = `₹${team.budget}L`;
    renderMyPlayersDashboard();
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
  myName = null;
  selectedTeamId = null;
  showToast(message || 'Game reset', 'info');
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
});

function switchScreen(id) {
  document.querySelectorAll('.screen').forEach((screen) => screen.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function renderLobby() {
  renderTeamGrid();
  renderJoinedTeams();
}

function renderTeamGrid() {
  // team selection UI is hidden now; nothing to render if element missing
  const grid = document.getElementById('teamGrid');
  if (!grid) return;
  grid.innerHTML = '';

  availableTeams.forEach((team) => {
    const takenTeam = gameState && gameState.teams ? gameState.teams[team.id] : null;
    const isTaken = Boolean(takenTeam);
    const isMine = myTeamId === team.id;
    const isSelected = selectedTeamId === team.id || isMine;

    const div = document.createElement('div');
    div.className = `team-btn${isTaken && !isMine ? ' taken' : ''}${isSelected ? ' selected' : ''}`;

    if (isSelected || (isTaken && !isMine)) {
      div.style.background = team.color;
      div.style.borderColor = team.color;
    }

    div.innerHTML = `<div class="team-short">${team.short}</div><div class="team-full">${team.name.replace(' ', '\n')}</div>`;

    if (!isTaken && !myTeamId) {
      div.onclick = () => selectTeam(team.id, team.color, div);
    }

    grid.appendChild(div);
  });
}

function selectTeam(teamId, color, element) {
  selectedTeamId = teamId;
  document.querySelectorAll('.team-btn').forEach((button) => {
    button.classList.remove('selected');
    button.style.background = '';
    button.style.borderColor = '';
  });
  element.classList.add('selected');
  element.style.background = color;
  element.style.borderColor = color;
}

function renderJoinedTeams() {
  const list = document.getElementById('joinedTeamsList');
  list.innerHTML = '';
  if (!gameState || !gameState.teams) return;

  Object.values(gameState.teams).forEach((team) => {
    const chip = document.createElement('div');
    chip.className = 'joined-team-chip';
    chip.style.background = team.color;
    chip.textContent = `${team.short} - ${team.ownerName}`;
    list.appendChild(chip);
  });
}

function joinGame() {
  if (myTeamId) {
    showToast('You are already joined', 'info');
    return;
  }

  const code = document.getElementById('teamCode').value.trim();
  if (!code) {
    showToast('Enter your code', 'error');
    return;
  }

  myPass = code;
  socket.emit('joinGame', { password: code });
}

function leaveGame() {
  if (!myTeamId) {
    showToast('You are not in a team', 'error');
    return;
  }
  socket.emit('leaveGame');
}

function startAuction() {
  showToast('Auction can only be started from admin panel', 'info');
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
  const label = String(name || 'Player').trim().slice(0, 18) || 'Player';
  const safeLabel = escapeSvgText(label);
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='320' height='420' viewBox='0 0 320 420'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0%' stop-color='#1d2232'/><stop offset='100%' stop-color='#11131d'/></linearGradient></defs><rect width='320' height='420' fill='url(#g)'/><circle cx='160' cy='152' r='58' fill='#2a3147'/><rect x='86' y='228' width='148' height='106' rx='12' fill='#2a3147'/><text x='160' y='374' text-anchor='middle' fill='#ffd700' font-family='Arial,sans-serif' font-size='22'>${safeLabel}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function getReliableImageSource(player) {
  const fallback = getInlineFallbackImage(player && player.name ? player.name : 'Player');
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
  const emoji = ROLE_EMOJIS[player.role] || '🏏';
  const safeName = escapeHtml(player.name || 'Unknown');
  const safeRole = escapeHtml(player.role || 'Unknown');
  const imageData = getReliableImageSource(player);

  el.innerHTML = `
    <div class="player-card-inner">
      <div class="player-image-section">
        <div class="player-image-wrapper">
          <img src="${imageData.src}" alt="${safeName}" class="player-image" loading="lazy" decoding="async"
            data-fallback="${imageData.fallback}"
            onerror="if (this.dataset.fallback && this.src !== this.dataset.fallback) { this.src = this.dataset.fallback; }" />
        </div>
      </div>
      <div class="player-info-section">
        <div class="player-name-display">${safeName}</div>
        <div class="price-display">₹${startingBid}L</div>
        <div class="role-display">${emoji} ${safeRole}</div>
      </div>
    </div>
  `;
}

function reorderPlayersForGallery(players) {
  if (!players || !players.length) return [];
  const batters = players.filter((p) => ['Batter', 'Batter/WK', 'WK-Batter'].includes(p.role));
  const bowlers = players.filter((p) => ['Fast Bowler', 'Spinner'].includes(p.role));
  const allRounders = players.filter((p) => p.role === 'All-Rounder');
  const others = players.filter((p) => !['Batter', 'Batter/WK', 'WK-Batter', 'Fast Bowler', 'Spinner', 'All-Rounder'].includes(p.role));

  const ordered = [];
  while (batters.length || bowlers.length || allRounders.length || others.length) {
    for (let i = 0; i < 5 && batters.length; i += 1) ordered.push(batters.shift());
    for (let i = 0; i < 5 && bowlers.length; i += 1) ordered.push(bowlers.shift());
    for (let i = 0; i < 5 && allRounders.length; i += 1) ordered.push(allRounders.shift());
    if (others.length) ordered.push(others.shift());
  }
  return ordered;
}

function renderPlayersGallery(players) {
  const wrap = document.getElementById('playersGallery');
  if (!wrap) return;
  clearPreviewCarouselTimer();
  wrap.innerHTML = '';
  const ordered = reorderPlayersForGallery(players || []);

  if (!ordered.length) {
    wrap.innerHTML = '<div style="color:var(--text-dim);padding:10px">No players available</div>';
    return;
  }

  const track = document.createElement('div');
  track.className = 'gallery-sequence-track';

  function getCardMarkup(player) {
    const imageData = getReliableImageSource(player);
    const safeName = escapeHtml(player.name || 'Unknown');
    return `
      <div class="gallery-sequence-card">
        <div class="gallery-sequence-image">
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
  document.getElementById('currentBidDisplay').textContent = `₹${amount}L`;

  const leaderEl = document.getElementById('bidLeaderDisplay');
  if (bidderTeamId && teamName) {
    const isMe = bidderTeamId === myTeamId;
    leaderEl.textContent = isMe ? '🏆 You are leading!' : `${teamName} leads`;
    leaderEl.style.color = isMe ? 'var(--green)' : 'var(--gold)';
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
  if (seconds <= 5) circle.classList.add('urgent');
  else if (seconds <= 10) circle.classList.add('warning');
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
    
    // For admin or my team, show full budget/players; for other teams (non-admin), hide details
    let showDetails = isAdmin || isMyTeam;
    let fullTeam = isMyTeam && gameState.myTeamFull ? gameState.myTeamFull : team;
    
    const budget = showDetails ? (fullTeam.budget || 0) : '?';
    const playerCount = showDetails ? ((fullTeam.players || []).length) : '?';
    const ownerName = team.ownerName || 'Unknown';
    
    div.innerHTML = `
      <div class="team-color-dot" style="background:${team.color}"></div>
      <div class="team-card-info">
        <div class="team-card-name">${team.short} ${isLeading ? '⚡' : ''}</div>
        <div class="team-card-owner">${isMyTeam ? '👤 ' + ownerName : ownerName}</div>
      </div>
      <div>
        <div class="team-card-budget">₹${budget}L</div>
        <div class="team-card-players">${playerCount} players</div>
      </div>
    `;
    el.appendChild(div);
  });
}

function renderMyPlayersDashboard() {
  const list = document.getElementById('myPlayersList');
  if (!list) return;
  
  // Use myTeamFull (full details) if available, else fall back to public teams view
  let myTeamData = null;
  if (myTeamId) {
    if (gameState && gameState.myTeamFull) {
      myTeamData = gameState.myTeamFull;
    } else if (gameState && gameState.teams && gameState.teams[myTeamId]) {
      myTeamData = gameState.teams[myTeamId];
    }
  }
  
  if (!myTeamId || !myTeamData) {
    list.innerHTML = '<div class="my-player-empty">Join a team to track your squad</div>';
    return;
  }

  const players = myTeamData.players || [];
  if (!players.length) {
    list.innerHTML = '<div class="my-player-empty">No players won yet</div>';
    return;
  }

  list.innerHTML = players.map((player) => {
    const imageData = getReliableImageSource(player);
    const safeName = escapeHtml(player.name || 'Unknown');
    const safeRole = escapeHtml(player.role || 'Unknown');
    return `
    <div class="my-player-card won">
      <img src="${imageData.src}" alt="${safeName}" loading="lazy" decoding="async"
        data-fallback="${imageData.fallback}"
        onerror="if (this.dataset.fallback && this.src !== this.dataset.fallback) { this.src = this.dataset.fallback; }" />
      <div class="my-player-meta">
        <div class="my-player-name">${safeName}</div>
        <div class="my-player-role">${safeRole}</div>
        <div class="my-player-price">₹${player.soldPrice}L</div>
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
  while (feed.children.length > 20) feed.removeChild(feed.lastChild);
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
  if (!gameState || !gameState.currentPlayer) {
    showToast('No player is up for bidding', 'error');
    return;
  }
  if (getMySquadSize() >= MAX_SQUAD_SIZE) {
    showToast(`Squad full (${MAX_SQUAD_SIZE}: ${PLAYING_XI_SIZE} + ${SUBSTITUTE_SIZE})`, 'error');
    return;
  }

  const match = increment.match(/\+(\d+)/);
  if (!match) return;

  const addAmount = parseInt(match[1], 10);
  const newBid = gameState.currentBid + addAmount;
  socket.emit('placeBid', { amount: newBid });
}

function placeCustomBid() {
  if (!myTeamId) {
    showToast('Join a team first', 'error');
    return;
  }
  if (!gameState || !gameState.currentPlayer) {
    showToast('No player is up for bidding', 'error');
    return;
  }
  if (getMySquadSize() >= MAX_SQUAD_SIZE) {
    showToast(`Squad full (${MAX_SQUAD_SIZE}: ${PLAYING_XI_SIZE} + ${SUBSTITUTE_SIZE})`, 'error');
    return;
  }

  const val = parseInt(document.getElementById('customBidInput').value, 10);
  if (!val || val <= 0) {
    showToast('Enter a valid amount', 'error');
    return;
  }
  socket.emit('placeBid', { amount: val });
  document.getElementById('customBidInput').value = '';
}

function getTeamLogo(teamId) {
  if (!availableTeams || !teamId) return null;
  const team = availableTeams.find(t => t.id === teamId);
  return team ? team.logo : null;
}

function showSessionRecovery() {
  const overlay = document.getElementById('sessionRecoveryOverlay');
  if (!overlay) return;
  overlay.style.display = 'flex';
  // no team grid, just show code input
}

function recoverSession() {
  const code = document.getElementById('recoveryCode').value.trim();
  if (!code) {
    showToast('Enter your code to recover', 'error');
    return;
  }
  myPass = code;
  socket.emit('joinGame', { password: code });
  document.getElementById('sessionRecoveryOverlay').style.display = 'none';
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
      ${logoUrl ? `<img src="${logoUrl}" style="width:100px; height:100px; object-fit:contain; margin-bottom:15px; animation: bounceIn 0.8s cubic-bezier(0.34, 1.56, 0.64, 1); border-radius:50%; border:3px solid var(--gold);">` : ''}
      <h2>${tone.title}</h2>
      <p style="font-size:24px;margin:8px 0;">${playerName}</p>
      <p style="font-size:20px;font-weight:700;">${subtitle}</p>
      <p style="font-size:28px;margin-top:8px;color:var(--gold);">₹${price} Lakhs</p>
    </div>
  `;
  document.body.appendChild(overlay);
  setTimeout(() => overlay.remove(), 3200);
}

function renderFinishedScreen(teams, soldHistory, unsoldPlayers, resultReview) {
  const grid = document.getElementById('finalTeams');
  if (!grid) return;
  grid.innerHTML = '';

  const reveal = resultReview || {
    validated: false,
    revealedPlaces: { 1: false, 2: false, 3: false },
    revealedStandings: [],
  };

  const revealByPlace = {};
  (reveal.revealedStandings || []).forEach((entry) => {
    revealByPlace[entry.place] = entry;
  });

  const revealSection = document.createElement('div');
  revealSection.className = 'final-reveal-panel';
  revealSection.innerHTML = `
    <h3>RESULT REVIEW</h3>
    <p>${reveal.validated ? 'Validated by Admin 3. Reveals are in progress.' : 'Awaiting Admin 3 validation and winner reveal.'}</p>
    <div class="final-reveal-list">
      <div class="final-reveal-item ${reveal.revealedPlaces && reveal.revealedPlaces[3] ? 'revealed' : ''}">
        <span>3rd Prize</span>
        <strong>${revealByPlace[3] ? `${revealByPlace[3].teamShort} (${revealByPlace[3].score})` : 'Hidden'}</strong>
      </div>
      <div class="final-reveal-item ${reveal.revealedPlaces && reveal.revealedPlaces[2] ? 'revealed' : ''}">
        <span>2nd Runner</span>
        <strong>${revealByPlace[2] ? `${revealByPlace[2].teamShort} (${revealByPlace[2].score})` : 'Hidden'}</strong>
      </div>
      <div class="final-reveal-item ${reveal.revealedPlaces && reveal.revealedPlaces[1] ? 'revealed' : ''}">
        <span>1st Winner</span>
        <strong>${revealByPlace[1] ? `${revealByPlace[1].teamShort} (${revealByPlace[1].score})` : 'Hidden'}</strong>
      </div>
    </div>
  `;
  grid.appendChild(revealSection);

  const finishedSubtitle = document.querySelector('#finishedScreen .finished-header p');
  if (finishedSubtitle) {
    finishedSubtitle.textContent = reveal.validated
      ? 'Standings validated by Admin 3. Winner reveal is in progress.'
      : 'Auction complete. Waiting for Admin 3 to validate and reveal winners.';
  }

  Object.values(teams).forEach((team) => {
    const squad = Array.isArray(team.players) ? team.players : [];
    const xi = team.playingXI ? Object.values(team.playingXI).filter(p => p) : [];
    const subs = squad.filter(p => !xi.some(xip => xip.id === p.id));

    card.className = 'final-team-card';
    card.style.borderColor = `${team.color}44`;

    const renderRows = (players, label) => {
      if (!players.length) return '';
      const rows = players.map((player) => `
        <div class="final-player-row">
          <div>
            <div>${escapeHtml(player.name)}</div>
            <div class="final-player-role">${escapeHtml(player.role)} | ${escapeHtml(player.country)}</div>
          </div>
          <div class="final-player-price">₹${player.soldPrice}L</div>
        </div>
      `).join('');
      return `<div class="final-squad-label">${label}</div>${rows}`;
    };

    const xiContent = renderRows(xi, 'PLAYING XI');
    const subsContent = renderRows(subs, 'SUBSTITUTES');
    const fallbackContent = !xi.length ? renderRows(squad, 'SQUAD') : '';

    card.innerHTML = `
      <div class="final-team-header" style="background:${team.color}20;border-bottom:1px solid ${team.color}33">
        <div class="final-team-name" style="color:${team.color}">${team.short} - ${team.ownerName}</div>
        <div class="final-team-budget">₹${Number(team.budget) || 0}L left</div>
      </div>
      <div class="final-team-players">
        ${xiContent || fallbackContent || subsContent || '<div style="color:var(--text-dim);font-size:13px;padding:10px 0">No players bought</div>'}
        ${xiContent ? subsContent : ''}
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

let toastTimeout;
function showToast(msg, type = 'info', duration = 3000) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = `toast ${type} show`;
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, duration);
}

document.addEventListener('DOMContentLoaded', () => {
  const customBidInput = document.getElementById('customBidInput');
  if (customBidInput) {
    customBidInput.addEventListener('keypress', (event) => {
      if (event.key === 'Enter') placeCustomBid();
    });
  }

  const nameInput = document.getElementById('playerName');
  if (nameInput) {
    nameInput.addEventListener('keypress', (event) => {
      if (event.key === 'Enter') joinGame();
    });
  }
});
