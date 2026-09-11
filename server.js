require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { randomUUID } = require('crypto');
const db = require('./db');
const playersData = require('./data/players');
const PLAYERS_DATA_FILE = path.join(__dirname, 'data', 'players.js');
const STATE_FILE = db.FALLBACK_STATE_FILE;

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'aiml';
const INITIAL_BUDGET = 500;
const BID_TIMER_SECONDS = 15;
const REVEAL_PLACES = [3, 2, 1];
const PLAYING_XI_SIZE = 11;
const SUBSTITUTE_SIZE = 4;
const MAX_SQUAD_SIZE = 30;
const ALERT_EMAIL_TO = 'gxwr143@gmail.com';
const ALERT_EMAIL_WEBHOOK_URL = String(process.env.ALERT_EMAIL_WEBHOOK_URL || '').trim();
const ALERT_HISTORY_LIMIT = 600;

const VALID_PLAYER_ROLE_IDS = [
  'Input',
  'Output',
  'Logic Gates',
  'Decoders / Data Selectors',
  'Sequential Elements',
  'Annotation',
  'Misc Components',
];

const DEFAULT_TEAMS = [];

function seedDefaultTeams(teamsObj = {}) {
  return teamsObj;
}

function clonePlayers() {
  return JSON.parse(JSON.stringify(playersData));
}

function readPlayersDataFileMtimeMs() {
  try {
    return fs.statSync(PLAYERS_DATA_FILE).mtimeMs || 0;
  } catch (error) {
    return 0;
  }
}

let playersDataMtimeMs = readPlayersDataFileMtimeMs();

function loadPlayersFromDataFile() {
  const modulePath = require.resolve('./data/players');
  delete require.cache[modulePath];
  const loaded = require('./data/players');
  return Array.isArray(loaded) ? loaded : [];
}

function reloadPlayersFromDiskIfNeeded(force = false) {
  if (!force && gameState.phase !== 'lobby') {
    return false;
  }

  const nextMtime = readPlayersDataFileMtimeMs();
  if (!force && nextMtime <= playersDataMtimeMs) {
    return false;
  }

  let loadedPlayers;
  try {
    loadedPlayers = loadPlayersFromDataFile();
  } catch (error) {
    console.error('Failed to reload players from data file:', error);
    return false;
  }

  const normalized = loadedPlayers.map((player, index) => normalizePlayerForStorage(player, index + 1));

  playersData.length = 0;
  normalized.forEach((player) => playersData.push(player));

  gameState.players = clonePlayers();
  if (gameState.phase === 'lobby') {
    gameState.auctionQueue = [];
    gameState.currentPlayer = null;
    gameState.currentBid = 0;
    gameState.currentBidder = null;
    gameState.timerSeconds = BID_TIMER_SECONDS;
  }

  playersDataMtimeMs = nextMtime;
  return true;
}

function normalizeRevealedPlaces(input) {
  return {
    1: Boolean(input && input[1]),
    2: Boolean(input && input[2]),
    3: Boolean(input && input[3]),
  };
}

function createInitialResultReview() {
  return {
    validated: false,
    validatedAt: null,
    standings: [],
    revealedPlaces: normalizeRevealedPlaces(null),
    revealedAt: {},
    manualOverride: null,
  };
}

function createInitialState() {
  const initialTeams = {};
  seedDefaultTeams(initialTeams);
  return {
    phase: 'lobby',
    hostSocketId: null,
    hostName: null,
    teams: initialTeams,
    players: clonePlayers(),
    currentPlayer: null,
    currentBid: 0,
    currentBidder: null,
    timerSeconds: BID_TIMER_SECONDS,
    auctionQueue: [],
    queueFilter: null,
    soldHistory: [],
    unsoldPlayers: [],
    bidTimerInterval: null,
    duplicateFlags: [],
    alerts: [],
    resultReview: createInitialResultReview(),
  };
}

let gameState = createInitialState();

function saveState() {
  try {
    const dataToSave = {
      phase: gameState.phase,
      teams: gameState.teams,
      soldHistory: gameState.soldHistory,
      unsoldPlayers: gameState.unsoldPlayers,
      auctionQueue: gameState.auctionQueue,
      resultReview: gameState.resultReview,
      reconnectSessions: reconnectSessions,
      currentBid: gameState.currentBid,
      currentPlayer: gameState.currentPlayer,
      currentBidder: gameState.currentBidder,
      timerSeconds: gameState.timerSeconds,
      timestamp: Date.now(),
    };
    db.saveAuctionState(dataToSave);
  } catch (error) {
    console.error('Failed to save state:', error);
  }
}

const connectedUsers = {};
const reconnectSessions = {};

async function loadState() {
  try {
    const saved = await db.loadAuctionState();
    if (saved) {
      gameState.phase = saved.phase || 'lobby';
      gameState.teams = saved.teams || {};
      gameState.soldHistory = saved.soldHistory || [];
      gameState.unsoldPlayers = saved.unsoldPlayers || [];
      gameState.auctionQueue = saved.auctionQueue || [];
      gameState.resultReview = saved.resultReview || createInitialResultReview();
      gameState.currentBid = saved.currentBid || 0;
      gameState.currentPlayer = saved.currentPlayer || null;
      gameState.currentBidder = saved.currentBidder || null;
      gameState.timerSeconds = Number.isFinite(saved.timerSeconds) ? saved.timerSeconds : BID_TIMER_SECONDS;
      
      if (saved.reconnectSessions) {
        Object.assign(reconnectSessions, saved.reconnectSessions);
      }
      
      if (Object.keys(gameState.teams).length === 0) {
        seedDefaultTeams(gameState.teams);
      }

      // Reset socket IDs and transient owner data on load
      Object.values(gameState.teams).forEach(team => {
        team.ownerId = null;
      });
      
      console.log('Auction state loaded from Database / storage');
    }
  } catch (error) {
    console.error('Failed to load state:', error);
  }
}

loadState();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
  },
  transports: ['polling', 'websocket'],
});

// Enable CORS for all incoming API & asset requests
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-admin-pass');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

app.get('/favicon.ico', (req, res) => {
  res.type('image/svg+xml').send('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">⚡</text></svg>');
});

const PUBLIC_DIR = path.join(__dirname, 'public');
const LEGACY_IMAGES_DIR = path.join(PUBLIC_DIR, 'images');
const DEFAULT_UPLOADS_ROOT = process.env.USERPROFILE || process.cwd();
const OLD_PERSISTENT_UPLOADS_DIR = path.join(DEFAULT_UPLOADS_ROOT, 'ipl-auction-uploads');
const OLD_PERSISTENT_IMAGES_DIR = path.join(OLD_PERSISTENT_UPLOADS_DIR, 'images');
const PERSISTENT_UPLOADS_DIR = process.env.AUCTION_UPLOADS_DIR
  ? path.resolve(process.env.AUCTION_UPLOADS_DIR)
  : path.join(__dirname, 'storage');
const PERSISTENT_IMAGES_DIR = path.join(PERSISTENT_UPLOADS_DIR, 'images');

function ensureDirExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function copyImagesIntoStorage(sourceDir, targetDir) {
  const sourceResolved = path.resolve(sourceDir);
  const targetResolved = path.resolve(targetDir);
  if (sourceResolved === targetResolved || !fs.existsSync(sourceResolved)) {
    return 0;
  }
  try {
    const entries = fs.readdirSync(sourceResolved, { withFileTypes: true });
    let migrated = 0;

    entries.forEach((entry) => {
      if (!entry.isFile()) return;
      const srcFile = path.join(sourceResolved, entry.name);
      const dstFile = path.join(targetResolved, entry.name);
      if (!fs.existsSync(dstFile)) {
        fs.copyFileSync(srcFile, dstFile);
        migrated += 1;
      }
    });

    return migrated;
  } catch (error) {
    console.error(`Failed to migrate images from ${sourceResolved}:`, error);
    return 0;
  }
}

function migrateImagesToPersistentStorage() {
  const sources = [LEGACY_IMAGES_DIR, OLD_PERSISTENT_IMAGES_DIR];
  let total = 0;
  sources.forEach((source) => {
    total += copyImagesIntoStorage(source, PERSISTENT_IMAGES_DIR);
  });
  if (total > 0) {
    console.log(`Migrated ${total} image(s) into storage: ${PERSISTENT_IMAGES_DIR}`);
  }
}

ensureDirExists(LEGACY_IMAGES_DIR);
ensureDirExists(PERSISTENT_IMAGES_DIR);
migrateImagesToPersistentStorage();
console.log(`Image storage directory: ${PERSISTENT_IMAGES_DIR}`);

app.use('/images', express.static(PERSISTENT_IMAGES_DIR));
app.use('/logo', express.static(path.join(__dirname, 'storage', 'logo')));
app.use(express.static(PUBLIC_DIR));

function removeFileIfExists(filePath) {
  if (!filePath) return;
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    if (error && error.code !== 'ENOENT') {
      console.error(`Failed to remove file ${filePath}:`, error);
    }
  }
}

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, PERSISTENT_IMAGES_DIR);
  },
  filename(req, file, cb) {
    const playerId = String(req.body.playerId || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_');
    const rawExt = path.extname(file.originalname || '').toLowerCase();
    const ext = /^[.][a-z0-9]{1,10}$/.test(rawExt) ? rawExt : '.jpg';
    cb(null, `${playerId}_${Date.now()}_${randomUUID().slice(0, 8)}${ext}`);
  },
});

const upload = multer({ storage });

function clearObject(obj) {
  Object.keys(obj).forEach((key) => delete obj[key]);
}

function isAdminPass(pass) {
  return typeof pass === 'string' && pass === ADMIN_PASSWORD;
}

function requireAdmin(req, res, next) {
  const pass = req.headers['x-admin-pass'];
  if (!isAdminPass(pass)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  return next();
}

function canControlAuction(socket) {
  return Boolean(socket && socket.isAdmin);
}

function isPlayerCatalogLocked() {
  return gameState.phase === 'auction' || gameState.phase === 'paused';
}

function roleProfile(role) {
  const r = String(role || '').toLowerCase();
  const input = r.includes('input') || r.includes('switch') || r.includes('button') || r.includes('power') || r.includes('ground') || r.includes('vcc') || r.includes('gnd');
  const output = r.includes('output') || r.includes('led') || r.includes('display') || r.includes('buzzer') || r.includes('probe');
  const logicGates = r.includes('gate') || r.includes('and') || r.includes('nand') || r.includes('nor') || r.includes('xor') || r.includes('xnor') || r.includes('buffer') || r.includes('not');
  const decodersSelectors = r.includes('decoder') || r.includes('mux') || r.includes('selector') || r.includes('demux') || r.includes('multiplexer') || r.includes('encoder');
  const sequentialElements = r.includes('sequential') || r.includes('flip') || r.includes('flop') || r.includes('latch') || r.includes('counter') || r.includes('register') || r.includes('clock') || r.includes('timer');
  const annotation = r.includes('annotation') || r.includes('text') || r.includes('label');
  const miscComponents = r.includes('misc') || r.includes('adder') || r.includes('alu') || r.includes('comparator') || r.includes('motor') || r.includes('force');

  return {
    input,
    output,
    logicGates,
    decodersSelectors,
    sequentialElements,
    annotation,
    miscComponents,
    // backwards-compatibility flags
    microcontroller: input || logicGates,
    sensor: input,
    communication: decodersSelectors,
    icLogic: logicGates || sequentialElements,
    displayActuator: output,
    powerPassive: input || miscComponents,
  };
}

function scoreByRange(actual, min, max, maxPoints, perStepPenalty) {
  if (actual >= min && actual <= max) return maxPoints;
  const distance = actual < min ? (min - actual) : (actual - max);
  return Math.max(0, maxPoints - (distance * perStepPenalty));
}

function getTeamSquadSize(team) {
  return Array.isArray(team && team.players) ? team.players.length : 0;
}

function isTeamSquadFull(team) {
  return getTeamSquadSize(team) >= MAX_SQUAD_SIZE;
}

function getQueueRoleGroup(player) {
  const role = normalizeRoleId(player && player.role);
  if (role === 'Input') return 'input';
  if (role === 'Output') return 'output';
  if (role === 'Logic Gates') return 'logic_gates';
  if (role === 'Decoders / Data Selectors') return 'decoders_selectors';
  if (role === 'Sequential Elements') return 'sequential_elements';
  if (role === 'Annotation') return 'annotation';
  if (role === 'Misc Components') return 'misc_components';
  return 'other';
}

function normalizeQueueFilter(input) {
  const filter = input && typeof input === 'object' ? input : {};
  const roleGroupRaw = String(filter.roleGroup || 'all').trim().toLowerCase();
  const validGroups = ['all', 'input', 'output', 'logic_gates', 'decoders_selectors', 'sequential_elements', 'annotation', 'misc_components', 'other'];
  const roleGroup = validGroups.includes(roleGroupRaw) ? roleGroupRaw : 'all';

  let capped = null;
  if (typeof filter.capped === 'boolean') {
    capped = filter.capped;
  } else if (typeof filter.capped === 'string') {
    const c = filter.capped.trim().toLowerCase();
    if (c === 'capped') capped = true;
    else if (c === 'uncapped') capped = false;
  }

  return { roleGroup, capped };
}

function matchesQueueFilter(player, filter) {
  const normalized = normalizeQueueFilter(filter);
  if (normalized.roleGroup !== 'all' && getQueueRoleGroup(player) !== normalized.roleGroup) {
    return false;
  }
  if (typeof normalized.capped === 'boolean' && Boolean(player && player.isCapped) !== normalized.capped) {
    return false;
  }
  return true;
}

function buildQueueCounts(queue) {
  const counts = {
    total: queue.length,
    capped: 0,
    uncapped: 0,
    byRoleGroup: {
      input: 0,
      output: 0,
      logic_gates: 0,
      decoders_selectors: 0,
      sequential_elements: 0,
      annotation: 0,
      misc_components: 0,
      other: 0,
    },
    byBucket: {},
  };

  queue.forEach((player) => {
    const cappedKey = Boolean(player && player.isCapped) ? 'capped' : 'uncapped';
    const roleGroup = getQueueRoleGroup(player);
    const bucketKey = `${cappedKey}_${roleGroup}`;

    counts[cappedKey] += 1;
    counts.byRoleGroup[roleGroup] = (counts.byRoleGroup[roleGroup] || 0) + 1;
    counts.byBucket[bucketKey] = (counts.byBucket[bucketKey] || 0) + 1;
  });

  return counts;
}

function getSoldPlayerIdSet() {
  const soldIds = new Set();

  const soldHistory = Array.isArray(gameState.soldHistory) ? gameState.soldHistory : [];
  soldHistory.forEach((entry) => {
    const id = Number(entry && entry.player && entry.player.id);
    if (Number.isFinite(id) && id > 0) soldIds.add(id);
  });

  const teams = Object.values(gameState.teams || {});
  teams.forEach((team) => {
    const squad = Array.isArray(team && team.players) ? team.players : [];
    squad.forEach((player) => {
      const id = Number(player && player.id);
      if (Number.isFinite(id) && id > 0) soldIds.add(id);
    });
  });

  return soldIds;
}

function buildQueueSearchPool() {
  const queue = Array.isArray(gameState.auctionQueue) ? gameState.auctionQueue : [];
  const unsold = Array.isArray(gameState.unsoldPlayers) ? gameState.unsoldPlayers : [];
  const soldIds = getSoldPlayerIdSet();
  const used = new Set();
  const pool = [];

  function pushPlayer(player, source) {
    const id = Number(player && player.id);
    if (!Number.isFinite(id) || id <= 0) return;
    if (soldIds.has(id)) return;
    if (used.has(id)) return;
    used.add(id);

    pool.push({
      id,
      name: String(player && player.name || '').trim() || `Player ${id}`,
      role: String(player && player.role || 'Unknown'),
      country: String(player && player.country || 'Unknown'),
      basePrice: Number(player && player.basePrice) || 0,
      isCapped: Boolean(player && player.isCapped),
      roleGroup: getQueueRoleGroup(player),
      source,
    });
  }

  queue.forEach((player) => pushPlayer(player, 'remaining'));
  unsold.forEach((player) => pushPlayer(player, 'unsold'));

  return pool;
}

function buildQueuePoolCounts(pool) {
  const sourceCounts = { remaining: 0, unsold: 0 };
  const roleCounts = {
    input: 0,
    output: 0,
    logic_gates: 0,
    decoders_selectors: 0,
    sequential_elements: 0,
    annotation: 0,
    misc_components: 0,
    other: 0,
  };
  let capped = 0;
  let uncapped = 0;

  pool.forEach((player) => {
    if (player && player.source === 'unsold') sourceCounts.unsold += 1;
    else sourceCounts.remaining += 1;

    if (player && player.isCapped) capped += 1;
    else uncapped += 1;

    const roleGroup = String(player && player.roleGroup || 'other');
    roleCounts[roleGroup] = (roleCounts[roleGroup] || 0) + 1;
  });

  return {
    total: pool.length,
    source: sourceCounts,
    capped,
    uncapped,
    byRoleGroup: roleCounts,
  };
}

function shufflePlayers(inputPlayers) {
  const arr = Array.isArray(inputPlayers) ? inputPlayers.slice() : [];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function getQueueStatePayload() {
  const queue = Array.isArray(gameState.auctionQueue) ? gameState.auctionQueue : [];
  const searchPool = buildQueueSearchPool();
  return {
    phase: gameState.phase,
    remaining: queue.length,
    currentPlayer: gameState.currentPlayer || null,
    nextPlayer: queue[0] || null,
    preview: queue.slice(0, 12),
    counts: buildQueueCounts(queue),
    poolCounts: buildQueuePoolCounts(searchPool),
    searchPool: searchPool.slice(0, 1600),
    activeFilter: gameState.queueFilter || normalizeQueueFilter(null),
  };
}

function emitQueueUpdate() {
  io.emit('queueUpdated', { queueState: getQueueStatePayload() });
}

function trimAndLimit(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength);
}

function normalizeAlertSeverity(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'critical' || raw === 'high' || raw === 'danger') return 'critical';
  if (raw === 'info' || raw === 'note' || raw === 'low') return 'info';
  return 'warning';
}

function normalizeAlertStatus(value) {
  return String(value || '').trim().toLowerCase() === 'resolved' ? 'resolved' : 'active';
}

function getAlertsStatePayload() {
  const rawAlerts = Array.isArray(gameState.alerts) ? gameState.alerts : [];
  const alerts = rawAlerts
    .map((alert) => ({
      id: trimAndLimit(alert && alert.id ? alert.id : randomUUID(), 120),
      title: trimAndLimit(alert && alert.title ? alert.title : 'Coordinator Alert', 120),
      message: trimAndLimit(alert && alert.message ? alert.message : '', 600),
      severity: normalizeAlertSeverity(alert && alert.severity),
      source: trimAndLimit(alert && alert.source ? alert.source : 'Coordinator', 80),
      status: normalizeAlertStatus(alert && alert.status),
      createdAt: Number(alert && alert.createdAt) || 0,
      createdBy: trimAndLimit(alert && alert.createdBy ? alert.createdBy : 'Coordinator', 60),
      resolvedAt: alert && alert.resolvedAt ? Number(alert.resolvedAt) : null,
      resolvedBy: trimAndLimit(alert && alert.resolvedBy ? alert.resolvedBy : '', 60) || null,
      email: {
        to: trimAndLimit(alert && alert.email && alert.email.to ? alert.email.to : ALERT_EMAIL_TO, 160),
        attempted: Boolean(alert && alert.email && alert.email.attempted),
        delivered: Boolean(alert && alert.email && alert.email.delivered),
        statusCode: Number(alert && alert.email && alert.email.statusCode) || null,
        reason: trimAndLimit(alert && alert.email && alert.email.reason ? alert.email.reason : '', 200) || null,
      },
    }))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  const activeAlerts = alerts.filter((alert) => alert.status === 'active');
  const resolvedAlerts = alerts.filter((alert) => alert.status === 'resolved');

  return {
    counts: {
      total: alerts.length,
      active: activeAlerts.length,
      resolved: resolvedAlerts.length,
      criticalActive: activeAlerts.filter((alert) => alert.severity === 'critical').length,
      warningActive: activeAlerts.filter((alert) => alert.severity === 'warning').length,
      infoActive: activeAlerts.filter((alert) => alert.severity === 'info').length,
    },
    alerts,
    activeAlerts,
    resolvedAlerts,
  };
}

function emitAlertsUpdate() {
  io.emit('alertsUpdated', { alertsState: getAlertsStatePayload() });
}

function normalizeRoleId(role) {
  const raw = String(role || '').trim();
  if (!raw) return 'Misc Components';
  const r = raw.toLowerCase();
  if (r.includes('input') || r.includes('switch') || r.includes('button') || r.includes('power') || r.includes('ground') || r.includes('vcc') || r.includes('gnd')) return 'Input';
  if (r.includes('output') || r.includes('led') || r.includes('display') || r.includes('buzzer') || r.includes('probe')) return 'Output';
  if (r.includes('gate') || r.includes('and') || r.includes('nand') || r.includes('nor') || r.includes('xor') || r.includes('xnor') || r.includes('buffer') || r.includes('not')) return 'Logic Gates';
  if (r.includes('decoder') || r.includes('mux') || r.includes('selector') || r.includes('demux') || r.includes('multiplexer') || r.includes('encoder')) return 'Decoders / Data Selectors';
  if (r.includes('sequential') || r.includes('flip') || r.includes('flop') || r.includes('latch') || r.includes('counter') || r.includes('register') || r.includes('clock') || r.includes('timer')) return 'Sequential Elements';
  if (r.includes('annotation') || r.includes('text') || r.includes('label')) return 'Annotation';
  if (r.includes('misc') || r.includes('adder') || r.includes('alu') || r.includes('comparator') || r.includes('motor') || r.includes('force')) return 'Misc Components';
  const match = VALID_PLAYER_ROLE_IDS.find(v => v.toLowerCase() === r);
  if (match) return match;
  return 'Misc Components';
}

function createEmptyRoleCounts() {
  const counts = {};
  VALID_PLAYER_ROLE_IDS.forEach((roleId) => {
    counts[roleId] = 0;
  });
  counts.Other = 0;
  return counts;
}

function createEmptyRoleGroupCounts() {
  return {
    inputs: 0,
    outputs: 0,
    logicGates: 0,
    decodersSelectors: 0,
    sequentialElements: 0,
    annotations: 0,
    miscComponents: 0,
    // backwards-compat
    microcontrollers: 0,
    sensors: 0,
    communications: 0,
    icLogics: 0,
    displayActuators: 0,
    powerPassives: 0,
  };
}

function addPlayerToRoleCounters(roleCounts, roleGroupCounts, player) {
  const roleId = normalizeRoleId(player && player.role);
  if (Object.prototype.hasOwnProperty.call(roleCounts, roleId)) roleCounts[roleId] += 1;
  else roleCounts.Other += 1;

  if (roleId === 'Input') { roleGroupCounts.inputs += 1; roleGroupCounts.sensors += 1; }
  if (roleId === 'Output') { roleGroupCounts.outputs += 1; roleGroupCounts.displayActuators += 1; }
  if (roleId === 'Logic Gates') { roleGroupCounts.logicGates += 1; roleGroupCounts.icLogics += 1; }
  if (roleId === 'Decoders / Data Selectors') { roleGroupCounts.decodersSelectors += 1; roleGroupCounts.communications += 1; }
  if (roleId === 'Sequential Elements') { roleGroupCounts.sequentialElements += 1; roleGroupCounts.icLogics += 1; }
  if (roleId === 'Annotation') { roleGroupCounts.annotations += 1; }
  if (roleId === 'Misc Components') { roleGroupCounts.miscComponents += 1; roleGroupCounts.powerPassives += 1; }
}

function getPlayerEffectivePrice(player) {
  const soldPrice = Number(player && player.soldPrice);
  if (Number.isFinite(soldPrice)) return soldPrice;
  return Number(player && player.basePrice) || 0;
}

function buildAdminReport() {
  const teams = Object.values(gameState.teams || {});
  const catalogPlayers = Array.isArray(gameState.players) ? gameState.players : [];
  const queuePlayers = Array.isArray(gameState.auctionQueue) ? gameState.auctionQueue : [];
  const soldHistory = Array.isArray(gameState.soldHistory) ? gameState.soldHistory : [];
  const unsoldPlayers = Array.isArray(gameState.unsoldPlayers) ? gameState.unsoldPlayers : [];
  const alertsState = getAlertsStatePayload();

  const catalogRoleCounts = createEmptyRoleCounts();
  const catalogRoleGroups = createEmptyRoleGroupCounts();
  let catalogBaseAmount = 0;
  let catalogCapped = 0;
  let catalogUncapped = 0;

  catalogPlayers.forEach((player) => {
    catalogBaseAmount += Number(player && player.basePrice) || 0;
    if (player && player.isCapped) catalogCapped += 1;
    else catalogUncapped += 1;
    addPlayerToRoleCounters(catalogRoleCounts, catalogRoleGroups, player);
  });

  const soldRoleCounts = createEmptyRoleCounts();
  const soldRoleGroups = createEmptyRoleGroupCounts();
  const soldByTeam = {};
  let soldAmount = 0;

  soldHistory.forEach((entry) => {
    const player = entry && entry.player ? entry.player : null;
    const soldTo = String(entry && entry.soldTo ? entry.soldTo : '');
    if (soldTo) soldByTeam[soldTo] = (soldByTeam[soldTo] || 0) + 1;
    soldAmount += Number(entry && entry.soldPrice) || getPlayerEffectivePrice(player);
    if (player) {
      addPlayerToRoleCounters(soldRoleCounts, soldRoleGroups, player);
    }
  });

  const unsoldBaseAmount = unsoldPlayers.reduce(
    (sum, player) => sum + (Number(player && player.basePrice) || 0),
    0
  );
  const remainingBaseAmount = queuePlayers.reduce(
    (sum, player) => sum + (Number(player && player.basePrice) || 0),
    0
  );

  const teamsReport = teams.map((team) => {
    const teamPlayers = Array.isArray(team && team.players) ? team.players : [];
    const roleCounts = createEmptyRoleCounts();
    const roleGroups = createEmptyRoleGroupCounts();

    let spent = 0;
    let totalBase = 0;
    let capped = 0;
    let uncapped = 0;

    teamPlayers.forEach((player) => {
      spent += getPlayerEffectivePrice(player);
      totalBase += Number(player && player.basePrice) || 0;
      if (player && player.isCapped) capped += 1;
      else uncapped += 1;
      addPlayerToRoleCounters(roleCounts, roleGroups, player);
    });

    const playersCount = teamPlayers.length;
    const budgetRemaining = Number(team && team.budget) || 0;
    const budgetUsed = Math.max(0, INITIAL_BUDGET - budgetRemaining);

    return {
      id: team && team.id ? team.id : '',
      name: team && team.name ? team.name : 'Unknown Team',
      short: team && team.short ? team.short : 'TEAM',
      logo: team && team.logo ? team.logo : '',
      ownerName: team && team.ownerName ? team.ownerName : 'Unknown',
      isConnected: Boolean(team && team.ownerId),
      playersCount,
      squadComplete: playersCount >= MAX_SQUAD_SIZE,
      cappedPlayers: capped,
      uncappedPlayers: uncapped,
      roleCounts,
      roleGroups,
      totalBaseAmountL: totalBase,
      totalSpentL: spent,
      avgSpendL: playersCount ? Number((spent / playersCount).toFixed(2)) : 0,
      budgetRemainingL: budgetRemaining,
      budgetUsedL: budgetUsed,
      soldEvents: Number(soldByTeam[String(team && team.id ? team.id : '')]) || 0,
    };
  }).sort((a, b) => String(a.short).localeCompare(String(b.short)));

  const teamsWithOwners = teamsReport.filter((team) => team.isConnected).length;
  const teamsDisconnected = teamsReport.length - teamsWithOwners;
  const fullSquads = teamsReport.filter((team) => team.squadComplete).length;
  const totalBudgetRemaining = teamsReport.reduce((sum, team) => sum + (Number(team.budgetRemainingL) || 0), 0);
  const totalBudgetUsed = teamsReport.reduce((sum, team) => sum + (Number(team.budgetUsedL) || 0), 0);
  const averageSoldPrice = soldHistory.length ? Number((soldAmount / soldHistory.length).toFixed(2)) : 0;

  return {
    generatedAt: Date.now(),
    phase: gameState.phase,
    summary: {
      teamsJoined: teamsReport.length,
      teamsWithOwners,
      teamsDisconnected,
      fullSquads,
      incompleteSquads: Math.max(0, teamsReport.length - fullSquads),
    },
    playerCatalog: {
      totalPlayers: catalogPlayers.length,
      cappedPlayers: catalogCapped,
      uncappedPlayers: catalogUncapped,
      roleCounts: catalogRoleCounts,
      roleGroups: catalogRoleGroups,
      totalBaseAmountL: catalogBaseAmount,
    },
    auctionFlow: {
      soldPlayers: soldHistory.length,
      unsoldPlayers: unsoldPlayers.length,
      remainingPlayers: queuePlayers.length,
      soldAmountL: soldAmount,
      averageSoldPriceL: averageSoldPrice,
      unsoldBaseAmountL: unsoldBaseAmount,
      remainingBaseAmountL: remainingBaseAmount,
      currentBidL: Number(gameState.currentBid) || 0,
      currentPlayer: gameState.currentPlayer
        ? {
            id: gameState.currentPlayer.id,
            name: gameState.currentPlayer.name,
            role: gameState.currentPlayer.role,
            basePrice: gameState.currentPlayer.basePrice,
          }
        : null,
      soldRoleCounts,
      soldRoleGroups,
    },
    financials: {
      initialBudgetPerTeamL: INITIAL_BUDGET,
      totalBudgetPoolL: INITIAL_BUDGET * teamsReport.length,
      totalBudgetUsedL: totalBudgetUsed,
      totalBudgetRemainingL: totalBudgetRemaining,
      totalSoldAmountL: soldAmount,
    },
    alerts: alertsState.counts,
    teams: teamsReport,
  };
}

function csvEscape(value) {
  const str = String(value == null ? '' : value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildAdminReportCsv(report) {
  const lines = [];
  const addRow = (cells) => {
    lines.push(cells.map(csvEscape).join(','));
  };

  addRow(['Section', 'Metric', 'Value']);
  addRow(['Summary', 'Generated At', new Date(report.generatedAt).toISOString()]);
  addRow(['Summary', 'Auction Phase', report.phase]);
  addRow(['Summary', 'Teams Joined', report.summary.teamsJoined]);
  addRow(['Summary', 'Teams Connected', report.summary.teamsWithOwners]);
  addRow(['Summary', 'Teams Disconnected', report.summary.teamsDisconnected]);
  addRow(['Summary', 'Full Squads', report.summary.fullSquads]);
  addRow(['Summary', 'Incomplete Squads', report.summary.incompleteSquads]);
  addRow(['Catalog', 'Players', report.playerCatalog.totalPlayers]);
  addRow(['Catalog', 'Capped', report.playerCatalog.cappedPlayers]);
  addRow(['Catalog', 'Uncapped', report.playerCatalog.uncappedPlayers]);
  addRow(['Catalog', 'Catalog Base Amount (L)', report.playerCatalog.totalBaseAmountL]);
  addRow(['Auction', 'Sold Players', report.auctionFlow.soldPlayers]);
  addRow(['Auction', 'Unsold Players', report.auctionFlow.unsoldPlayers]);
  addRow(['Auction', 'Remaining Queue', report.auctionFlow.remainingPlayers]);
  addRow(['Auction', 'Sold Amount (L)', report.auctionFlow.soldAmountL]);
  addRow(['Auction', 'Average Sold Price (L)', report.auctionFlow.averageSoldPriceL]);
  addRow(['Budget', 'Total Budget Pool (L)', report.financials.totalBudgetPoolL]);
  addRow(['Budget', 'Budget Used (L)', report.financials.totalBudgetUsedL]);
  addRow(['Budget', 'Budget Remaining (L)', report.financials.totalBudgetRemainingL]);
  addRow(['Alerts', 'Active', report.alerts.active]);
  addRow(['Alerts', 'Critical Active', report.alerts.criticalActive]);
  addRow(['Alerts', 'Total Alerts', report.alerts.total]);
  addRow([]);

  addRow([
    'Team',
    'Owner',
    'Connected',
    'Players',
    'Squad Complete',
    'Capped',
    'Uncapped',
    'Budget Used (L)',
    'Budget Remaining (L)',
    'Total Spent (L)',
    'Avg Spend (L)',
    'Microcontroller',
    'Sensor',
    'Communication',
    'IC & Logic',
    'Display & Actuator',
    'Power & Passive',
    'Other',
    'Event Sold Count',
  ]);

  (report.teams || []).forEach((team) => {
    addRow([
      `${team.short} - ${team.name}`,
      team.ownerName,
      team.isConnected ? 'Yes' : 'No',
      team.playersCount,
      team.squadComplete ? 'Yes' : 'No',
      team.cappedPlayers,
      team.uncappedPlayers,
      team.budgetUsedL,
      team.budgetRemainingL,
      team.totalSpentL,
      team.avgSpendL,
      team.roleCounts.Microcontroller || team.roleCounts.Batter || 0,
      team.roleCounts.Sensor || team.roleCounts['Fast Bowler'] || 0,
      team.roleCounts.Communication || team.roleCounts.Spinner || 0,
      team.roleCounts['IC & Logic'] || team.roleCounts['All-Rounder'] || 0,
      team.roleCounts['Display & Actuator'] || team.roleCounts['WK-Batter'] || 0,
      team.roleCounts['Power & Passive'] || 0,
      team.roleCounts.Other || 0,
      team.soldEvents,
    ]);
  });

  return lines.join('\n');
}

async function sendAlertEmailWebhook(alert) {
  if (!ALERT_EMAIL_WEBHOOK_URL) {
    return {
      attempted: false,
      delivered: false,
      statusCode: null,
      reason: 'ALERT_EMAIL_WEBHOOK_URL is not configured',
    };
  }

  if (typeof fetch !== 'function') {
    return {
      attempted: false,
      delivered: false,
      statusCode: null,
      reason: 'Fetch API is unavailable in this Node runtime',
    };
  }

  const createdAtIso = alert && alert.createdAt ? new Date(alert.createdAt).toISOString() : new Date().toISOString();
  const title = trimAndLimit(alert && alert.title ? alert.title : 'Coordinator Alert', 120);
  const message = trimAndLimit(alert && alert.message ? alert.message : '', 600);
  const severity = normalizeAlertSeverity(alert && alert.severity);
  const source = trimAndLimit(alert && alert.source ? alert.source : 'Coordinator', 80);
  const subject = `[Electro Auction ${severity.toUpperCase()}] ${title}`;
  const text = [
    `Alert Type: ${severity.toUpperCase()}`,
    `Source: ${source}`,
    `Created At: ${createdAtIso}`,
    '',
    `Title: ${title}`,
    `Message: ${message}`,
  ].join('\n');

  try {
    const response = await fetch(ALERT_EMAIL_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: ALERT_EMAIL_TO,
        subject,
        text,
        alert: {
          id: alert.id,
          title,
          message,
          severity,
          source,
          createdAt: alert.createdAt,
        },
      }),
    });

    const responseBody = await response.text().catch(() => '');
    if (!response.ok) {
      return {
        attempted: true,
        delivered: false,
        statusCode: response.status,
        reason: trimAndLimit(responseBody || `Webhook returned HTTP ${response.status}`, 200),
      };
    }

    return {
      attempted: true,
      delivered: true,
      statusCode: response.status,
      reason: null,
    };
  } catch (error) {
    return {
      attempted: true,
      delivered: false,
      statusCode: null,
      reason: trimAndLimit(error && error.message ? error.message : 'Webhook request failed', 200),
    };
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function derivePlayerSkillValue(player) {
  const explicit = Number(player && player.skillValue);
  if (Number.isFinite(explicit)) {
    return clamp(explicit, 0, 10);
  }

  const basePrice = Number(player && player.basePrice) || 0;
  const role = String(player && player.role || '').toLowerCase();
  const baseFromPrice = clamp(basePrice / 20, 0, 10);
  const cappedBonus = player && player.isCapped ? 1.2 : 0;
  const roleBonus = role.includes('all-rounder')
    ? 0.8
    : ((role.includes('wk') || role.includes('wicket')) ? 0.5 : 0);

  return clamp(baseFromPrice + cappedBonus + roleBonus, 0, 10);
}

function derivePlayerPerformanceValue(player) {
  const explicit = Number(player && player.performanceValue);
  if (Number.isFinite(explicit)) {
    return clamp(explicit, 0, 10);
  }

  const basePrice = Number(player && player.basePrice) || 0;
  const soldPrice = Number(player && player.soldPrice);
  const baseFromPrice = clamp(basePrice / 25, 0, 8);
  const cappedBonus = player && player.isCapped ? 1.5 : 0.5;
  const marketFactor = (
    Number.isFinite(soldPrice) && basePrice > 0
      ? clamp((soldPrice / basePrice) - 1, -0.5, 1.5)
      : 0
  );

  return clamp(baseFromPrice + cappedBonus + marketFactor, 0, 10);
}

function getPlayerSelectionFlags(player) {
  const role = String(player && player.role || '').toLowerCase();
  const profile = roleProfile(role);
  const isMicrocontroller = profile.microcontroller;
  const isSensor = profile.sensor;
  const isCommunication = profile.communication;
  const isIcLogic = profile.icLogic;
  const isDisplayActuator = profile.displayActuator;
  const isPowerPassive = profile.powerPassive;

  return {
    profile,
    isMicrocontroller,
    isSensor,
    isCommunication,
    isIcLogic,
    isDisplayActuator,
    isPowerPassive,
    // backwards-compat
    spinner: isCommunication,
    fastBowler: isSensor,
    openerCandidate: isMicrocontroller || isDisplayActuator,
  };
}

function getPlayerCompositeValue(player) {
  return derivePlayerSkillValue(player) + derivePlayerPerformanceValue(player);
}

function getPlayerKey(player) {
  const numericId = Number(player && player.id);
  if (Number.isFinite(numericId) && numericId > 0) {
    return `id:${numericId}`;
  }
  return `name:${String(player && player.name || '').toLowerCase()}`;
}

function pickPlayersForConstraint(sortedPlayers, selectedPlayers, selectedKeys, count, predicate, onPick = null) {
  let added = 0;
  for (const player of sortedPlayers) {
    if (selectedPlayers.length >= PLAYING_XI_SIZE) break;
    const key = getPlayerKey(player);
    if (selectedKeys.has(key)) continue;
    if (!predicate(player)) continue;

    selectedPlayers.push(player);
    selectedKeys.add(key);
    if (typeof onPick === 'function') onPick(player);
    added += 1;
    if (added >= count) break;
  }
  return added;
}

function buildPlayingXIFromSquad(squadPlayers) {
  const sorted = [...(Array.isArray(squadPlayers) ? squadPlayers : [])]
    .sort((a, b) => getPlayerCompositeValue(b) - getPlayerCompositeValue(a));

  const selectedPlayers = [];
  const selectedKeys = new Set();
  const mcuKeys = new Set();

  // 1. Pick 1 Microcontroller
  pickPlayersForConstraint(
    sorted,
    selectedPlayers,
    selectedKeys,
    1,
    (player) => getPlayerSelectionFlags(player).isMicrocontroller,
    (player) => mcuKeys.add(getPlayerKey(player))
  );

  // 2. Pick 2 Sensors
  pickPlayersForConstraint(
    sorted,
    selectedPlayers,
    selectedKeys,
    2,
    (player) => getPlayerSelectionFlags(player).isSensor
  );

  // 3. Pick 2 Communication Modules
  pickPlayersForConstraint(
    sorted,
    selectedPlayers,
    selectedKeys,
    2,
    (player) => getPlayerSelectionFlags(player).isCommunication
  );

  // 4. Pick 2 IC & Logic / Drivers
  pickPlayersForConstraint(
    sorted,
    selectedPlayers,
    selectedKeys,
    2,
    (player) => getPlayerSelectionFlags(player).isIcLogic
  );

  // 5. Pick 2 Displays & Actuators
  pickPlayersForConstraint(
    sorted,
    selectedPlayers,
    selectedKeys,
    2,
    (player) => getPlayerSelectionFlags(player).isDisplayActuator
  );

  // 6. Pick 2 Power & Passives
  pickPlayersForConstraint(
    sorted,
    selectedPlayers,
    selectedKeys,
    2,
    (player) => getPlayerSelectionFlags(player).isPowerPassive
  );

  // 7. Fill remaining slots up to 11
  if (selectedPlayers.length < PLAYING_XI_SIZE) {
    pickPlayersForConstraint(
      sorted,
      selectedPlayers,
      selectedKeys,
      PLAYING_XI_SIZE - selectedPlayers.length,
      () => true
    );
  }

  const composition = {
    squadPlayers: Array.isArray(squadPlayers) ? squadPlayers.length : 0,
    players: selectedPlayers.length,
    microcontrollers: 0,
    sensors: 0,
    communications: 0,
    icLogics: 0,
    displayActuators: 0,
    powerPassives: 0,
    // backwards-compat
    batters: 0,
    bowlers: 0,
    wicketkeepers: 0,
    allRounders: 0,
    openers: Math.min(1, mcuKeys.size),
    fastBowlers: 0,
    spinners: 0,
  };

  selectedPlayers.forEach((player) => {
    const flags = getPlayerSelectionFlags(player);
    if (flags.isMicrocontroller) { composition.microcontrollers += 1; composition.batters += 1; }
    if (flags.isSensor) { composition.sensors += 1; composition.fastBowlers += 1; composition.bowlers += 1; }
    if (flags.isCommunication) { composition.communications += 1; composition.spinners += 1; composition.bowlers += 1; }
    if (flags.isIcLogic) { composition.icLogics += 1; composition.allRounders += 1; }
    if (flags.isDisplayActuator) { composition.displayActuators += 1; composition.wicketkeepers += 1; }
    if (flags.isPowerPassive) { composition.powerPassives += 1; }
  });

  const substitutes = sorted
    .filter((player) => !selectedKeys.has(getPlayerKey(player)))
    .slice(0, SUBSTITUTE_SIZE);

  return {
    playingXI: selectedPlayers,
    substitutes,
    composition,
  };
}

function evaluateTeamForResults(team) {
  const players = Array.isArray(team && team.players) ? team.players : [];
  
  let xiPlayers = [];
  let selection = null;
  
  // Use manual playingXI if set and contains players
  if (team && team.playingXI && Object.values(team.playingXI).some(p => p)) {
    xiPlayers = Object.values(team.playingXI).filter(p => p);
    
    // Build composition manually from xiPlayers
    const composition = {
      squadPlayers: players.length,
      players: xiPlayers.length,
      microcontrollers: 0,
      sensors: 0,
      communications: 0,
      icLogics: 0,
      displayActuators: 0,
      powerPassives: 0,
      batters: 0,
      bowlers: 0,
      wicketkeepers: 0,
      allRounders: 0,
      openers: 0,
      fastBowlers: 0,
      spinners: 0,
    };

    xiPlayers.forEach((player) => {
      const flags = getPlayerSelectionFlags(player);
      if (flags.isMicrocontroller) { composition.microcontrollers += 1; composition.batters += 1; }
      if (flags.isSensor) { composition.sensors += 1; composition.fastBowlers += 1; composition.bowlers += 1; }
      if (flags.isCommunication) { composition.communications += 1; composition.spinners += 1; composition.bowlers += 1; }
      if (flags.isIcLogic) { composition.icLogics += 1; composition.allRounders += 1; }
      if (flags.isDisplayActuator) { composition.displayActuators += 1; composition.wicketkeepers += 1; }
      if (flags.isPowerPassive) { composition.powerPassives += 1; }
    });

    const substitutes = players.filter(p => !xiPlayers.some(xi => xi.id === p.id)).slice(0, SUBSTITUTE_SIZE);
    selection = { playingXI: xiPlayers, substitutes, composition };
  } else {
    selection = buildPlayingXIFromSquad(players);
    xiPlayers = selection.playingXI;
  }
  
  const composition = selection.composition;

  let totalBasePrice = 0;
  let totalSpent = 0;

  players.forEach((player) => {
    const basePrice = Number(player && player.basePrice) || 0;
    const soldPrice = Number(player && player.soldPrice);
    totalBasePrice += basePrice;
    totalSpent += Number.isFinite(soldPrice) ? soldPrice : basePrice;
  });

  let xiSkillSum = 0;
  let xiPerformanceSum = 0;
  xiPlayers.forEach((player) => {
    xiSkillSum += derivePlayerSkillValue(player);
    xiPerformanceSum += derivePlayerPerformanceValue(player);
  });

  const averageSkill = xiPlayers.length ? (xiSkillSum / xiPlayers.length) : 0;
  const averagePerformance = xiPlayers.length ? (xiPerformanceSum / xiPlayers.length) : 0;

  const squadCompletionScore = scoreByRange(composition.squadPlayers, MAX_SQUAD_SIZE, MAX_SQUAD_SIZE, 10, 5);
  const xiSizeScore = scoreByRange(composition.players, PLAYING_XI_SIZE, PLAYING_XI_SIZE, 8, 8);
  const mcuScore = scoreByRange(composition.microcontrollers, 1, 1, 16, 16);
  const sensorScore = scoreByRange(composition.sensors, 2, 4, 16, 8);
  const commScore = scoreByRange(composition.communications, 2, 4, 14, 6);
  const icScore = scoreByRange(composition.icLogics, 2, 4, 14, 6);
  const displayScore = scoreByRange(composition.displayActuators, 1, 3, 12, 6);
  const roleBalanceScore = (
    squadCompletionScore
    + xiSizeScore
    + mcuScore
    + sensorScore
    + commScore
    + icScore
    + displayScore
  );

  const skillScore = Math.round((averageSkill / 10) * 15);
  const performanceScore = Math.round((averagePerformance / 10) * 15);
  const playerValueScore = skillScore + performanceScore;

  const budgetLeft = Number(team && team.budget) || 0;
  const missing = {
    squadPlayers: Math.max(0, MAX_SQUAD_SIZE - composition.squadPlayers),
    microcontrollers: Math.max(0, 1 - composition.microcontrollers),
    sensors: Math.max(0, 2 - composition.sensors),
    communications: Math.max(0, 2 - composition.communications),
    icLogics: Math.max(0, 2 - composition.icLogics),
    displayActuators: Math.max(0, 1 - composition.displayActuators),
    // backwards-compat
    wicketkeepers: Math.max(0, 1 - (composition.displayActuators || 0)),
    openers: Math.max(0, 1 - (composition.microcontrollers || 0)),
    fastBowlers: Math.max(0, 2 - (composition.sensors || 0)),
    spinners: Math.max(0, 2 - (composition.communications || 0)),
    allRounders: Math.max(0, 1 - (composition.icLogics || 0)),
  };

  const scoreBreakdown = [
    { label: '15-Component Inventory Completion', points: squadCompletionScore },
    { label: '11-Component Project Kit Completion', points: xiSizeScore },
    { label: 'Microcontroller (1 Required)', points: mcuScore },
    { label: 'Sensors (Min 2)', points: sensorScore },
    { label: 'Communication Modules (Min 2)', points: commScore },
    { label: 'IC & Logic / Drivers (Min 2)', points: icScore },
    { label: 'Displays & Actuators (Min 1)', points: displayScore },
    { label: 'Hardware Spec Rating', points: skillScore },
    { label: 'Market Performance Value', points: performanceScore },
  ];

  const score = roleBalanceScore + playerValueScore;

  return {
    teamId: team && team.id ? team.id : null,
    teamName: team && team.name ? team.name : 'Unknown Team',
    teamShort: team && team.short ? team.short : 'TEAM',
    teamColor: team && team.color ? team.color : '#888888',
    ownerName: team && team.ownerName ? team.ownerName : 'Unknown',
    score,
    scoreBreakdown,
    composition,
    efficiency: {
      roleBalanceScore,
      playerValueScore,
      averageSkill: Number(averageSkill.toFixed(2)),
      averagePerformance: Number(averagePerformance.toFixed(2)),
    },
    financials: {
      totalBasePrice,
      totalSpent,
      budgetLeft,
      averageSkill: Number(averageSkill.toFixed(2)),
      averagePerformance: Number(averagePerformance.toFixed(2)),
    },
    selection: {
      playingXI: xiPlayers.map((player) => ({
        id: player.id,
        name: player.name,
        role: player.role,
        country: player.country,
        isCapped: Boolean(player.isCapped),
        soldPrice: Number(player.soldPrice) || Number(player.basePrice) || 0,
      })),
      substitutes: selection.substitutes.map((player) => ({
        id: player.id,
        name: player.name,
        role: player.role,
        country: player.country,
        isCapped: Boolean(player.isCapped),
      })),
      constraints: {
        required: {
          squadPlayers: MAX_SQUAD_SIZE,
          microcontrollers: 1,
          sensors: 2,
          communications: 2,
          icLogics: 2,
          displayActuators: 1,
          wicketkeepers: 1,
          openers: 1,
          fastBowlers: 2,
          spinners: 2,
          allRounders: 1,
        },
        missing,
      },
    },
  };
}

function calculateResultStandings(teamsMap) {
  const teams = Object.values(teamsMap || {});
  const evaluated = teams.map((team) => evaluateTeamForResults(team));

  evaluated.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if ((b.efficiency && b.efficiency.roleBalanceScore) !== (a.efficiency && a.efficiency.roleBalanceScore)) {
      return (b.efficiency && b.efficiency.roleBalanceScore) - (a.efficiency && a.efficiency.roleBalanceScore);
    }
    if ((b.efficiency && b.efficiency.averagePerformance) !== (a.efficiency && a.efficiency.averagePerformance)) {
      return (b.efficiency && b.efficiency.averagePerformance) - (a.efficiency && a.efficiency.averagePerformance);
    }
    if ((b.efficiency && b.efficiency.averageSkill) !== (a.efficiency && a.efficiency.averageSkill)) {
      return (b.efficiency && b.efficiency.averageSkill) - (a.efficiency && a.efficiency.averageSkill);
    }
    return a.teamShort.localeCompare(b.teamShort);
  });

  return evaluated.map((entry, index) => ({
    ...entry,
    place: index + 1,
  }));
}

function hasAnyRevealedPlace(review) {
  const revealed = normalizeRevealedPlaces(review && review.revealedPlaces);
  return Boolean(revealed[1] || revealed[2] || revealed[3]);
}

function reorderStandingsByTopTeams(standings, topTeamIds) {
  const source = Array.isArray(standings) ? standings.slice() : [];
  const ordered = [];
  const used = new Set();

  [1, 2, 3].forEach((place) => {
    const teamId = topTeamIds && topTeamIds[place];
    if (teamId === undefined || teamId === null || String(teamId).trim() === '') {
      return;
    }
    const hit = source.find((entry) => String(entry.teamId) === String(teamId));
    if (!hit) return;
    const key = String(hit.teamId);
    if (used.has(key)) return;
    ordered.push(hit);
    used.add(key);
  });

  const rest = source.filter((entry) => !used.has(String(entry.teamId)));
  return ordered.concat(rest).map((entry, index) => ({
    ...entry,
    place: index + 1,
  }));
}

function getPublicResultReview() {
  const review = gameState && gameState.resultReview ? gameState.resultReview : createInitialResultReview();
  const revealedPlaces = normalizeRevealedPlaces(review.revealedPlaces);
  const standings = Array.isArray(review.standings) ? review.standings : [];

  return {
    validated: Boolean(review.validated),
    validatedAt: review.validatedAt || null,
    revealedPlaces,
    totalTeams: standings.length,
    revealedStandings: standings
      .filter((entry) => Boolean(revealedPlaces[entry.place]))
      .map((entry) => ({
        place: entry.place,
        teamId: entry.teamId,
        teamName: entry.teamName,
        teamShort: entry.teamShort,
        teamColor: entry.teamColor,
        score: entry.score,
      })),
  };
}

function getAdminResultReview() {
  const review = gameState && gameState.resultReview ? gameState.resultReview : createInitialResultReview();
  return {
    validated: Boolean(review.validated),
    validatedAt: review.validatedAt || null,
    revealedPlaces: normalizeRevealedPlaces(review.revealedPlaces),
    revealedAt: review.revealedAt || {},
    manualOverride: review.manualOverride || null,
    standings: Array.isArray(review.standings) ? review.standings : [],
  };
}

function emitResultUpdate() {
  io.emit('resultUpdate', { resultReview: getPublicResultReview() });
}

function getSafeState() {
  const teamsPayload = gameState.phase === 'finished' ? gameState.teams : getSanitizedTeams();
  const alertsState = getAlertsStatePayload();
  return {
    phase: gameState.phase,
    hostSocketId: gameState.hostSocketId,
    hostName: gameState.hostName,
    teams: teamsPayload,
    currentPlayer: gameState.currentPlayer,
    currentBid: gameState.currentBid,
    currentBidder: gameState.currentBidder,
    timerSeconds: gameState.timerSeconds,
    remainingInQueue: gameState.auctionQueue.length,
    soldHistory: gameState.soldHistory,
    unsoldPlayers: gameState.unsoldPlayers,
    duplicateFlags: gameState.duplicateFlags,
    alertsSummary: alertsState.counts,
    resultReview: getPublicResultReview(),
  };
}

function getSanitizedTeams() {
  const out = {};
  Object.keys(gameState.teams).forEach((id) => {
    const t = gameState.teams[id];
    if (!t) return;
    out[id] = {
      id: t.id,
      name: t.name,
      short: t.short,
      leader: t.leader || '',
      members: Array.isArray(t.members) ? t.members : [],
      color: t.color || '#00e5ff',
      icon: t.icon || '⚡',
      logo: t.logo || '',
      budget: Number(t.budget) || 0,
      verified: Boolean(t.verified),
      players: Array.isArray(t.players) ? t.players : [],
      playerCount: Array.isArray(t.players) ? t.players.length : 0,
      ownerId: t.ownerId,
      ownerName: t.ownerName || t.name,
      isConnected: Boolean(t.ownerId),
    };
  });
  return out;
}

function getMyTeamForSocket(socket) {
  const user = connectedUsers[socket.id];
  if (!user) return null;
  const team = gameState.teams[user.teamId];
  if (!team) return null;
  return {
    id: team.id,
    name: team.name,
    short: team.short,
    leader: team.leader || '',
    members: Array.isArray(team.members) ? team.members : [],
    color: team.color || '#00e5ff',
    icon: team.icon || '⚡',
    logo: team.logo || '',
    budget: team.budget,
    verified: Boolean(team.verified),
    players: team.players || [],
    playingXI: team.playingXI || {},
    ownerId: team.ownerId,
    ownerName: team.ownerName || team.name,
  };
}

function broadcastTeamsUpdate() {
  const publicTeams = getSanitizedTeams();
  const exposeFullTeams = gameState.phase === 'finished';
  io.sockets.sockets.forEach((sock) => {
    if (sock && (sock.isAdmin || exposeFullTeams)) {
      sock.emit('teamsUpdate', { teams: gameState.teams });
    } else {
      sock.emit('teamsUpdate', { teams: publicTeams });
    }
  });

  Object.keys(connectedUsers).forEach((sockId) => {
    try {
      const s = io.sockets.sockets.get(sockId);
      if (s) {
        const my = getMyTeamForSocket(s);
        s.emit('myTeam', { team: my });
      }
    } catch (err) {
      // ignore per-socket send errors
    }
  });
}

function clearBidTimer() {
  if (gameState.bidTimerInterval) {
    clearInterval(gameState.bidTimerInterval);
    gameState.bidTimerInterval = null;
  }
}

function startBidTimer() {
  clearBidTimer();

  if (gameState.phase !== 'auction' || !gameState.currentPlayer) {
    return;
  }

  let seconds = Number(gameState.timerSeconds);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    seconds = BID_TIMER_SECONDS;
  }

  gameState.timerSeconds = seconds;
  io.emit('timerTick', { seconds });

  gameState.bidTimerInterval = setInterval(() => {
    if (gameState.phase !== 'auction' || !gameState.currentPlayer) {
      clearBidTimer();
      return;
    }

    seconds -= 1;
    gameState.timerSeconds = Math.max(0, seconds);
    io.emit('timerTick', { seconds: gameState.timerSeconds });

    if (seconds <= 0) {
      clearBidTimer();
      sealBid();
    }
  }, 1000);
}

function resetBidTimer() {
  gameState.timerSeconds = BID_TIMER_SECONDS;
  startBidTimer();
}

function nextPlayer() {
  clearBidTimer();

  if (gameState.auctionQueue.length === 0) {
    endAuction();
    return;
  }

  gameState.currentPlayer = gameState.auctionQueue.shift();
  gameState.currentBid = gameState.currentPlayer.basePrice;
  gameState.currentBidder = null;
  gameState.timerSeconds = BID_TIMER_SECONDS;

  io.emit('newPlayer', {
    player: gameState.currentPlayer,
    startingBid: gameState.currentBid,
    remaining: gameState.auctionQueue.length,
  });
  emitQueueUpdate();
  saveState();

  startBidTimer();
}

function sealBid() {
  const player = gameState.currentPlayer;
  if (!player) {
    return;
  }

  if (!gameState.currentBidder) {
    gameState.unsoldPlayers.push({ ...player });
    io.emit('playerUnsold', { player });
    console.log(`UNSOLD: ${player.name}`);
  } else {
    const team = gameState.teams[gameState.currentBidder];
    let failReason = '';

    if (!team) {
      failReason = 'Selected team unavailable';
    } else if (isTeamSquadFull(team)) {
      failReason = `Squad full (${MAX_SQUAD_SIZE}: ${PLAYING_XI_SIZE} playing + ${SUBSTITUTE_SIZE} subs). Cannot buy more players.`;
    } else if (gameState.currentBid > team.budget) {
      failReason = `Not enough budget. Available: ${team.budget} points`;
    }

    if (failReason) {
      if (team && team.ownerId) {
        io.to(team.ownerId).emit('error', failReason);
      }
      gameState.unsoldPlayers.push({ ...player });
      io.emit('playerUnsold', { player });
      console.log(`UNSOLD: ${player.name} (${failReason})`);
    } else {
      team.budget -= gameState.currentBid;
      team.players.push({
        ...player,
        soldPrice: gameState.currentBid,
      });

      // if squad just reached max size and no playingXI is defined, build a default XI
      if (team.players.length >= MAX_SQUAD_SIZE) {
        const hasXI = team.playingXI && Object.values(team.playingXI).some(p => p);
        if (!hasXI) {
          const sel = buildPlayingXIFromSquad(team.players);
          const arr = Array.isArray(sel.playingXI) ? sel.playingXI : [];
          const mapped = {};
          arr.forEach((p, idx) => {
            mapped[`p${idx + 1}`] = p;
          });
          team.playingXI = mapped;
        }
      }

      gameState.soldHistory.push({
        player: { ...player },
        soldTo: gameState.currentBidder,
        soldPrice: gameState.currentBid,
        teamName: team.name,
      });

      io.emit('playerSold', {
        player,
        soldTo: gameState.currentBidder,
        soldPrice: gameState.currentBid,
        teamName: team.name,
        teamColor: team.color,
      });
      // broadcast sanitized teams and per-player team info
      broadcastTeamsUpdate();

      console.log(`SOLD: ${player.name} -> ${team.name} for ${gameState.currentBid} pts`);
    }
  }

  gameState.currentPlayer = null;
  gameState.currentBid = 0;
  gameState.currentBidder = null;
  gameState.timerSeconds = 0;
  emitQueueUpdate();
  saveState();

  if (gameState.phase !== 'auction') {
    return;
  }

  setTimeout(() => {
    if (gameState.phase === 'auction') {
      nextPlayer();
    }
  }, 3000);
}

function endAuction() {
  gameState.phase = 'finished';
  clearBidTimer();
  gameState.resultReview = {
    validated: false,
    validatedAt: null,
    standings: calculateResultStandings(gameState.teams),
    revealedPlaces: normalizeRevealedPlaces(null),
    revealedAt: {},
    manualOverride: null,
  };

  io.emit('auctionFinished', {
    teams: gameState.teams,
    soldHistory: gameState.soldHistory,
    unsoldPlayers: gameState.unsoldPlayers,
    resultReview: getPublicResultReview(),
  });
  emitResultUpdate();
  broadcastTeamsUpdate();
  emitQueueUpdate();
  saveState();

  console.log('Auction finished');
}

function releaseUserFromGame(socketId, disconnected = false) {
  const user = connectedUsers[socketId];
  if (!user) {
    return;
  }

  delete connectedUsers[socketId];

  const team = gameState.teams[user.teamId];
  if (team && team.ownerId === socketId) {
    if (gameState.phase === 'lobby') {
      delete gameState.teams[user.teamId];
      if (user.reconnectToken) {
        delete reconnectSessions[user.reconnectToken];
      }
      io.emit('teamLeft', {
        teamId: user.teamId,
        name: (team && team.short) ? team.short : user.teamId,
        teams: getSanitizedTeams(),
      });
      broadcastTeamsUpdate();
    } else {
      team.ownerId = null;
      io.emit('teamOwnerDisconnected', {
        teamId: user.teamId,
        name: (team && team.short) ? team.short : user.teamId,
      });
    }
  }

  if (disconnected) {
    io.emit('userLeft', { name: user.name, teamId: user.teamId });
  }
  saveState();
}

function persistPlayersDataFile() {
  const out = `const players = ${JSON.stringify(playersData, null, 2)}\n\nmodule.exports = players;\n`;
  fs.writeFileSync(PLAYERS_DATA_FILE, out, 'utf8');
  playersDataMtimeMs = readPlayersDataFileMtimeMs();
}

function normalizePlayerForStorage(rawPlayer, fallbackId) {
  const parsedId = Number(rawPlayer && rawPlayer.id);
  const id = Number.isFinite(parsedId) && parsedId > 0 ? parsedId : fallbackId;
  const safeName = String((rawPlayer && rawPlayer.name) || `Player ${id}`).trim() || `Player ${id}`;
  const parsedBasePrice = Number.parseInt(rawPlayer && rawPlayer.basePrice, 10);

  return {
    id,
    name: safeName,
    role: String((rawPlayer && rawPlayer.role) || 'Unknown').trim() || 'Unknown',
    country: String((rawPlayer && rawPlayer.country) || 'Unknown').trim() || 'Unknown',
    basePrice: Number.isFinite(parsedBasePrice) ? parsedBasePrice : 0,
    team: null,
    soldPrice: null,
    isCapped: Boolean(rawPlayer && rawPlayer.isCapped),
    image: String((rawPlayer && rawPlayer.image) || '').trim(),
  };
}

function syncPlayersDataFromState() {
  const sourcePlayers = Array.isArray(gameState.players) ? gameState.players : [];
  const normalized = sourcePlayers.map((player, index) => normalizePlayerForStorage(player, index + 1));

  playersData.length = 0;
  normalized.forEach((player) => playersData.push(player));

  persistPlayersDataFile();
}

io.on('connection', (socket) => {
  const adminPass = socket.handshake && socket.handshake.auth && socket.handshake.auth.adminPass;
  socket.isAdmin = isAdminPass(adminPass);

  if (socket.isAdmin) {
    console.log(`Admin socket connected: ${socket.id}`);
  } else {
    console.log(`User connected: ${socket.id}`);
  }

  // send initial state; omit passwords for non-admin sockets
  const teamsForClient = Object.values(gameState.teams).map((t) => {
    const copy = { ...t };
    if (!socket.isAdmin) {
      delete copy.password;
    }
    return copy;
  });

  socket.emit('init', {
    gameState: getSafeState(),
    availableTeams: teamsForClient,
    allPlayers: gameState.players,
    currentJoinedTeams: getSanitizedTeams(),
    isAdmin: socket.isAdmin,
    alertsState: getAlertsStatePayload(),
  });
  // send teams view: full for admin, sanitized for regular users
  if (socket.isAdmin) {
    socket.emit('teamsUpdate', { teams: gameState.teams });
  } else {
    socket.emit('teamsUpdate', { teams: getSanitizedTeams() });
  }
  socket.emit('myTeam', { team: getMyTeamForSocket(socket) });

  socket.on('registerTeam', (payload = {}, callback) => {
    const rawName = String(payload.name || payload.teamName || '').trim();
    if (!rawName) {
      const errMsg = 'Team name is required';
      socket.emit('error', errMsg);
      if (typeof callback === 'function') callback({ success: false, error: errMsg });
      return;
    }

    const existingNames = Object.values(gameState.teams).map(t => (t.name || '').toLowerCase());
    if (existingNames.includes(rawName.toLowerCase())) {
      const errMsg = 'A team with this name already exists';
      socket.emit('error', errMsg);
      if (typeof callback === 'function') callback({ success: false, error: errMsg });
      return;
    }

    const slug = rawName.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 16);
    const teamId = `team_${slug}_${Math.random().toString(36).substring(2, 6)}`;
    
    let short = String(payload.short || '').trim().toUpperCase();
    if (!short) {
      short = rawName.split(/\s+/).map(w => w[0]).join('').slice(0, 4).toUpperCase() || 'TEAM';
    }

    const leader = String(payload.leader || payload.leaderName || '').trim();
    const rawMembers = Array.isArray(payload.members)
      ? payload.members
      : (typeof payload.members === 'string' ? payload.members.split(',').map(s => s.trim()).filter(Boolean) : []);
    const members = rawMembers.map(m => String(m).trim()).filter(Boolean).slice(0, 5);
    const logo = String(payload.logo || payload.image || '').trim();
    const color = String(payload.color || '#00e5ff').trim();
    const icon = String(payload.icon || '⚡').trim();
    const password = String(payload.password || payload.code || Math.random().toString(36).substring(2, 8)).trim();
    const customBudget = Number(payload.budget);
    const budget = Number.isFinite(customBudget) && customBudget > 0 ? customBudget : INITIAL_BUDGET;

    const newTeam = {
      id: teamId,
      name: rawName,
      short,
      leader,
      members,
      color,
      icon,
      logo,
      password,
      budget,
      verified: false,
      players: [],
      playingXI: {},
      ownerId: null,
      ownerName: rawName,
      ownerIp: null,
    };

    gameState.teams[teamId] = newTeam;
    saveState();

    io.emit('teamRegistered', {
      team: {
        id: newTeam.id,
        name: newTeam.name,
        short: newTeam.short,
        leader: newTeam.leader,
        members: newTeam.members,
        color: newTeam.color,
        icon: newTeam.icon,
        logo: newTeam.logo,
        budget: newTeam.budget,
        verified: newTeam.verified,
        players: [],
        playerCount: 0,
      }
    });
    broadcastTeamsUpdate();

    const responsePayload = {
      success: true,
      teamId,
      password,
      team: {
        id: newTeam.id,
        name: newTeam.name,
        short: newTeam.short,
        leader: newTeam.leader,
        members: newTeam.members,
        color: newTeam.color,
        icon: newTeam.icon,
        logo: newTeam.logo,
        password: newTeam.password,
        budget: newTeam.budget,
        verified: newTeam.verified,
      }
    };

    if (typeof callback === 'function') callback(responsePayload);
    socket.emit('teamRegisterSuccess', responsePayload);
  });

  socket.on('joinGame', (payload = {}) => {
    let teamId = String(payload.teamId || payload.name || '').trim();
    const password = String(payload.password || payload.passcode || payload.code || '').trim();

    if (!teamId && !password) {
      socket.emit('error', 'Team code or name is required');
      return;
    }

    let team = null;
    if (teamId && gameState.teams[teamId]) {
      team = gameState.teams[teamId];
    } else {
      // Find matching team in gameState.teams
      const teamsList = Object.values(gameState.teams);
      team = teamsList.find(t => 
        (t.password && t.password.toLowerCase() === password.toLowerCase()) ||
        (t.id && t.id.toLowerCase() === teamId.toLowerCase()) ||
        (t.short && t.short.toLowerCase() === teamId.toLowerCase()) ||
        (t.name && t.name.toLowerCase() === teamId.toLowerCase())
      );
    }

    if (!team) {
      socket.emit('error', 'Invalid team code or name');
      return;
    }

    if (team.password && password && team.password.toLowerCase() !== password.toLowerCase()) {
      socket.emit('error', 'Incorrect team code');
      return;
    }

    teamId = team.id;

    // Disconnect old owner if connected on different socket
    if (team.ownerId && team.ownerId !== socket.id && connectedUsers[team.ownerId]) {
      delete connectedUsers[team.ownerId];
    }

    team.ownerId = socket.id;
    team.ownerIp = socket.handshake.address;

    const reconnectToken = randomUUID();
    reconnectSessions[reconnectToken] = {
      teamId,
      name: team.name,
    };

    connectedUsers[socket.id] = {
      teamId,
      reconnectToken,
    };

    io.emit('teamJoined', {
      teams: getSanitizedTeams(),
      user: { socketId: socket.id, teamId, name: team.name },
    });

    socket.emit('joinSuccess', {
      socketId: socket.id,
      teamId,
      name: team.name,
      isHost: false,
      reconnectToken,
      reconnected: false,
      team: getMyTeamForSocket(socket),
    });
    socket.emit('myTeam', { team: getMyTeamForSocket(socket) });
    broadcastTeamsUpdate();
    saveState();
  });

  socket.on('savePlayingXI', (payload = {}) => {
    const { teamId, playingXI } = payload;
    if (!teamId || !playingXI || !gameState.teams[teamId]) return;

    // Optional: check if the socket is the owner of the team
    const team = gameState.teams[teamId];
    if (team.ownerId !== socket.id) {
       // Allow if admin or if user is the owner
       if (!socket.isAdmin) return;
    }

    team.playingXI = playingXI;
    broadcastTeamsUpdate();
    // send updated full team back to owner so client state stays current
    socket.emit('myTeam', { team: getMyTeamForSocket(socket) });
    saveState();
  });

  socket.on('reconnectGame', (payload = {}) => {
    const token = String(payload.token || '').trim();
    if (!token) {
      socket.emit('reconnectFailed', { reason: 'Reconnect token missing' });
      return;
    }

    const session = reconnectSessions[token];
    if (!session) {
      socket.emit('reconnectFailed', { reason: 'Session expired. Please join again.' });
      return;
    }

    const team = gameState.teams[session.teamId];
    if (!team) {
      delete reconnectSessions[token];
      socket.emit('reconnectFailed', { reason: 'Team no longer exists. Please join again.' });
      return;
    }

    if (team.ownerId && team.ownerId !== socket.id && connectedUsers[team.ownerId]) {
      const existingOwner = connectedUsers[team.ownerId];
      if (existingOwner && existingOwner.reconnectToken === token) {
        delete connectedUsers[team.ownerId];
      } else {
        socket.emit('reconnectFailed', { reason: 'Team is already connected from another device.' });
        return;
      }
    }

    team.ownerId = socket.id;
    team.ownerIp = socket.handshake.address;

    connectedUsers[socket.id] = {
      teamId: session.teamId,
      reconnectToken: token,
    };

    io.emit('teamJoined', {
      teams: getSanitizedTeams(),
      user: { socketId: socket.id, name: session.name, teamId: session.teamId },
    });

    // broadcast per-socket sanitized teams and each player's own team info
    broadcastTeamsUpdate();
    saveState();

    socket.emit('joinSuccess', {
      socketId: socket.id,
      name: session.name,
      teamId: session.teamId,
      isHost: false,
      reconnectToken: token,
      reconnected: true,
      team: getMyTeamForSocket(socket),
    });
    socket.emit('myTeam', { team: getMyTeamForSocket(socket) });
  });

  socket.on('leaveGame', () => {
    if (gameState.phase !== 'lobby') {
      socket.emit('error', 'Cannot leave after auction starts');
      return;
    }

    releaseUserFromGame(socket.id, false);
    socket.emit('leftGame', { success: true });
  });

  socket.on('startAuction', () => {
    if (!canControlAuction(socket)) {
      socket.emit('error', 'Only admin can start the auction');
      return;
    }

    if (gameState.phase !== 'lobby') {
      return;
    }

    if (Object.keys(gameState.teams).length < 2) {
      socket.emit('error', 'Need at least 2 teams to start');
      return;
    }

    gameState.phase = 'auction';
    gameState.auctionQueue = [...gameState.players].sort(() => Math.random() - 0.5);
    gameState.queueFilter = normalizeQueueFilter(null);
    gameState.timerSeconds = BID_TIMER_SECONDS;
    gameState.resultReview = createInitialResultReview();
    io.emit('auctionStarted', { gameState: getSafeState(), hostSocketId: null });
    emitQueueUpdate();
    saveState();

    // create a new JSON dump for this game
    try {
      const gameDir = path.join(__dirname, 'game');
      if (!fs.existsSync(gameDir)) fs.mkdirSync(gameDir, { recursive: true });
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filePath = path.join(gameDir, `auction-${stamp}.json`);
      fs.writeFileSync(filePath, JSON.stringify({
        startedAt: Date.now(),
        teams: gameState.teams,
        players: gameState.players,
      }, null, 2), 'utf8');
      console.log('Created game file', filePath);
    } catch (error) {
      console.error('Failed to write game file:', error);
    }

    setTimeout(() => {
      if (gameState.phase === 'auction') {
        nextPlayer();
      }
    }, 800);
  });

  socket.on('nextPlayer', () => {
    if (!canControlAuction(socket)) {
      socket.emit('error', 'Only admin can move to next player');
      return;
    }

    if (gameState.phase !== 'auction' && gameState.phase !== 'paused') {
      return;
    }

    gameState.phase = 'auction';
    nextPlayer();
  });

  socket.on('pauseAuction', () => {
    if (!canControlAuction(socket)) {
      socket.emit('error', 'Only admin can pause');
      return;
    }

    if (gameState.phase !== 'auction') {
      return;
    }

    clearBidTimer();
    gameState.phase = 'paused';
    io.emit('auctionPaused', { gameState: getSafeState() });
    emitQueueUpdate();
    saveState();
  });

  socket.on('resumeAuction', () => {
    if (!canControlAuction(socket)) {
      socket.emit('error', 'Only admin can resume');
      return;
    }

    if (gameState.phase !== 'paused') {
      return;
    }

    gameState.phase = 'auction';
    startBidTimer();
    io.emit('auctionResumed', { gameState: getSafeState() });
    emitQueueUpdate();
    saveState();
  });

  socket.on('stopAuction', () => {
    if (!canControlAuction(socket)) {
      socket.emit('error', 'Only admin can stop the auction');
      return;
    }

    if (gameState.phase === 'finished') {
      return;
    }

    endAuction();
  });

  socket.on('adminVerifyTeam', (payload = {}) => {
    if (!canControlAuction(socket)) {
      socket.emit('error', 'Only admin can verify teams');
      return;
    }
    const teamId = String(payload.teamId || '').trim();
    const verified = payload.verified !== undefined ? Boolean(payload.verified) : true;
    if (!teamId || !gameState.teams[teamId]) {
      socket.emit('error', 'Team not found');
      return;
    }
    gameState.teams[teamId].verified = verified;
    saveState();
    broadcastTeamsUpdate();
    io.emit('teamVerified', { teamId, verified });
  });

  socket.on('adminVerifyAllTeams', (payload = {}) => {
    if (!canControlAuction(socket)) {
      socket.emit('error', 'Only admin can verify teams');
      return;
    }
    const verified = payload.verified !== undefined ? Boolean(payload.verified) : true;
    Object.values(gameState.teams).forEach((t) => {
      t.verified = verified;
    });
    saveState();
    broadcastTeamsUpdate();
    io.emit('allTeamsVerified', { verified });
  });

  socket.on('placeBid', (payload = {}) => {
    const user = connectedUsers[socket.id];
    if (!user) {
      return;
    }

    if (gameState.phase !== 'auction' || !gameState.currentPlayer) {
      return;
    }

    const team = gameState.teams[user.teamId];
    if (!team || team.ownerId !== socket.id) {
      return;
    }

    if (team.verified === false) {
      socket.emit(
        'error',
        'Your team is pending verification by the admin. Please wait for approval before bidding.'
      );
      return;
    }

    if (isTeamSquadFull(team)) {
      socket.emit(
        'error',
        `Squad full (${MAX_SQUAD_SIZE}: ${PLAYING_XI_SIZE} playing + ${SUBSTITUTE_SIZE} subs). Cannot bid for more components.`
      );
      return;
    }

    let bidAmount = parseInt(payload.amount, 10);
    if (payload.increment) {
      bidAmount = gameState.currentBid + parseInt(payload.increment, 10);
    } else if (Number.isFinite(bidAmount) && bidAmount > 0 && bidAmount <= 10 && gameState.currentBid > 0 && bidAmount <= gameState.currentBid) {
      // Convenience: treat small numbers <= 10 as incremental bid if below currentBid
      bidAmount = gameState.currentBid + bidAmount;
    }
    if (!Number.isFinite(bidAmount) || bidAmount <= gameState.currentBid) {
      socket.emit('error', `Bid must be higher than ${gameState.currentBid} points`);
      return;
    }

    if (bidAmount > team.budget) {
      socket.emit('error', `Not enough budget. Available: ${team.budget} points`);
      return;
    }

    gameState.currentBid = bidAmount;
    gameState.currentBidder = user.teamId;

    resetBidTimer();

    io.emit('bidPlaced', {
      bid: bidAmount,
      bidderTeamId: user.teamId,
      bidderName: team.ownerName,
      teamName: team.name,
      timerSeconds: gameState.timerSeconds,
    });
  });

  socket.on('markUnsold', () => {
    if (!canControlAuction(socket)) {
      socket.emit('error', 'Only admin can mark unsold');
      return;
    }

    if (gameState.phase !== 'auction') {
      return;
    }

    clearBidTimer();
    const player = gameState.currentPlayer;
    if (!player) {
      return;
    }

    gameState.unsoldPlayers.push({ ...player });
    io.emit('playerUnsold', { player });

    gameState.currentPlayer = null;
    gameState.currentBid = 0;
    gameState.currentBidder = null;
    gameState.timerSeconds = 0;
    emitQueueUpdate();
    saveState();
  });

  socket.on('sellPlayer', () => {
    if (!canControlAuction(socket)) {
      socket.emit('error', 'Only admin can confirm sale');
      return;
    }

    if (gameState.phase !== 'auction') {
      return;
    }

    clearBidTimer();
    sealBid();
  });

  socket.on('getState', () => {
    socket.emit('stateUpdate', getSafeState());
  });

  socket.on('disconnect', () => {
    releaseUserFromGame(socket.id, true);
  });
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/simulator', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'simulator.html'));
});

app.get('/audience', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'audience.html'));
});

app.get('/api/players', (req, res) => {
  reloadPlayersFromDiskIfNeeded();
  res.json(gameState.players);
});

app.post('/api/players', requireAdmin, (req, res) => {
  if (isPlayerCatalogLocked()) {
    return res.status(409).json({ error: 'Player list is locked while auction is running' });
  }

  const name = String(req.body.name || '').trim();
  const role = String(req.body.role || '').trim();
  const country = String(req.body.country || 'Unknown').trim();
  const image = String(req.body.image || '').trim();
  const basePrice = parseInt(req.body.basePrice, 10);

  if (!name || !role || !Number.isFinite(basePrice)) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  const maxId = gameState.players.reduce((acc, player) => Math.max(acc, Number(player.id) || 0), 0);

  const player = {
    id: maxId + 1,
    name,
    role,
    country,
    image: image || `https://via.placeholder.com/300x400?text=${encodeURIComponent(name)}`,
    basePrice,
    isCapped: Boolean(req.body.isCapped),
  };

  gameState.players.push(player);
  try {
    syncPlayersDataFromState();
  } catch (error) {
    gameState.players.pop();
    console.error('Failed to persist new player:', error);
    return res.status(500).json({ error: 'Failed to save player permanently' });
  }

  io.emit('playerAdded', { player });
  return res.json({ success: true, player });
});

app.put('/api/players/:id', requireAdmin, (req, res) => {
  if (isPlayerCatalogLocked()) {
    return res.status(409).json({ error: 'Player list is locked while auction is running' });
  }

  const numericPlayerId = Number(req.params.id);
  if (!Number.isFinite(numericPlayerId) || numericPlayerId <= 0) {
    return res.status(400).json({ error: 'Invalid player id' });
  }

  const idx = gameState.players.findIndex((item) => item.id === numericPlayerId);
  if (idx === -1) {
    return res.status(404).json({ error: 'Player not found' });
  }

  const existing = gameState.players[idx];
  const name = String(req.body.name ?? existing.name ?? '').trim();
  const role = String(req.body.role ?? existing.role ?? '').trim();
  const country = String(req.body.country ?? existing.country ?? 'Unknown').trim();
  const image = String(req.body.image ?? existing.image ?? '').trim();
  const basePrice = Number.parseInt(req.body.basePrice ?? existing.basePrice, 10);

  if (!name || !role || !Number.isFinite(basePrice)) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  const updated = {
    ...existing,
    id: numericPlayerId,
    name,
    role,
    country: country || 'Unknown',
    image: image || `https://via.placeholder.com/300x400?text=${encodeURIComponent(name)}`,
    basePrice,
    isCapped: Boolean(req.body.isCapped ?? existing.isCapped),
  };

  gameState.players[idx] = updated;
  gameState.auctionQueue = gameState.auctionQueue.map((player) => (
    player.id === numericPlayerId ? { ...player, ...updated } : player
  ));

  try {
    syncPlayersDataFromState();
  } catch (error) {
    gameState.players[idx] = existing;
    console.error('Failed to persist player update:', error);
    return res.status(500).json({ error: 'Failed to save player permanently' });
  }

  io.emit('playerUpdated', { player: updated });
  emitQueueUpdate();
  return res.json({ success: true, player: updated });
});

function handleDeletePlayerRequest(req, res) {
  if (isPlayerCatalogLocked()) {
    return res.status(409).json({ error: 'Player list is locked while auction is running' });
  }

  const numericPlayerId = Number(req.params.id);
  if (!Number.isFinite(numericPlayerId) || numericPlayerId <= 0) {
    return res.status(400).json({ error: 'Invalid player id' });
  }

  const idx = gameState.players.findIndex((item) => item.id === numericPlayerId);
  if (idx === -1) {
    return res.status(404).json({ error: 'Player not found' });
  }

  const [removed] = gameState.players.splice(idx, 1);
  const prevQueue = gameState.auctionQueue.slice();
  gameState.auctionQueue = gameState.auctionQueue.filter((item) => item.id !== numericPlayerId);

  try {
    syncPlayersDataFromState();
  } catch (error) {
    gameState.players.splice(idx, 0, removed);
    gameState.auctionQueue = prevQueue;
    console.error('Failed to persist player deletion:', error);
    return res.status(500).json({ error: 'Failed to delete player permanently' });
  }

  io.emit('playerDeleted', { playerId: numericPlayerId });
  emitQueueUpdate();
  return res.json({ success: true, playerId: numericPlayerId });
}

app.delete('/api/players/:id', requireAdmin, handleDeletePlayerRequest);
app.post('/api/players/:id/delete', requireAdmin, handleDeletePlayerRequest);

app.get('/api/state', (req, res) => {
  res.json(getSafeState());
});

app.post('/api/admin/login', (req, res) => {
  const password = String((req.body && req.body.password) || '');
  if (!isAdminPass(password)) {
    return res.status(401).json({ error: 'Invalid admin password' });
  }
  return res.json({ success: true });
});

app.get('/api/admin/report', requireAdmin, (req, res) => {
  const report = buildAdminReport();
  const teams = Object.values(gameState.teams || {});
  const teamData = teams.map((t) => ({
    id: t.id,
    short: t.short,
    name: t.name,
    ownerName: t.ownerName,
    logo: t.logo || '',
    playersCount: Array.isArray(t.players) ? t.players.length : 0,
    playingXI: t.playingXI || {},
  }));

  return res.json({
    success: true,
    report,
    teamData,
  });
});

// Get public or admin teams list
app.get('/api/teams', (req, res) => {
  const isAdmin = isAdminPass(req.headers['x-admin-pass']);
  const teams = Object.values(gameState.teams || {}).map((t) => {
    const copy = { ...t };
    if (!isAdmin) {
      delete copy.password;
    }
    return copy;
  });
  return res.json({ success: true, teams });
});

// Upload team logo image (Base64 Memory Storage + Resilient Serverless Support)
const memoryStorage = multer.memoryStorage();
const uploadMemory = multer({
  storage: memoryStorage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
});

app.post('/api/teams/upload-logo', uploadMemory.single('logo'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Logo file required' });
    }
    const mime = req.file.mimetype || 'image/png';
    const base64Data = req.file.buffer.toString('base64');
    const dataUrl = `data:${mime};base64,${base64Data}`;
    return res.json({
      success: true,
      url: dataUrl,
      logoUrl: dataUrl,
    });
  } catch (error) {
    console.error('Error in upload-logo:', error);
    return res.status(500).json({ error: error.message || 'Failed to upload logo' });
  }
});

// Full Real-time State Synchronization Endpoint
app.get('/api/sync', (req, res) => {
  res.json({
    success: true,
    timestamp: Date.now(),
    db: db.getDbHealth(),
    gameState: getSafeState(),
    teams: getSanitizedTeams(),
    allPlayers: gameState.players,
    queueState: getQueueStatePayload(),
    alertsState: getAlertsStatePayload(),
    resultReview: getPublicResultReview(),
  });
});

app.get('/api/db/health', (req, res) => {
  res.json(db.getDbHealth());
});

app.get('/api/db/status', (req, res) => {
  res.json(db.getDbHealth());
});

// REST Bidding API
app.post('/api/auction/bid', (req, res) => {
  const { teamId, password, passcode, code, amount, increment } = req.body || {};
  const effectivePass = password || passcode || code || '';
  
  if (!teamId || !gameState.teams[teamId]) {
    return res.status(404).json({ error: 'Team not found' });
  }

  const team = gameState.teams[teamId];
  if (team.password && effectivePass && team.password.toLowerCase() !== String(effectivePass).trim().toLowerCase()) {
    return res.status(401).json({ error: 'Incorrect team passcode' });
  }

  if (gameState.phase !== 'auction' || !gameState.currentPlayer) {
    return res.status(400).json({ error: 'Auction is not active or waiting for next component' });
  }

  if (team.verified === false) {
    return res.status(403).json({ error: 'Team is pending approval by admin' });
  }

  if (isTeamSquadFull(team)) {
    return res.status(400).json({ error: `Squad full (${MAX_SQUAD_SIZE}). Cannot buy more components` });
  }

  let bidAmount = parseInt(amount, 10);
  if (increment) {
    bidAmount = gameState.currentBid + parseInt(increment, 10);
  } else if (Number.isFinite(bidAmount) && bidAmount > 0 && bidAmount <= 10 && gameState.currentBid > 0 && bidAmount <= gameState.currentBid) {
    bidAmount = gameState.currentBid + bidAmount;
  }

  if (!Number.isFinite(bidAmount) || bidAmount <= gameState.currentBid) {
    return res.status(400).json({ error: `Bid must be higher than ${gameState.currentBid} points` });
  }

  if (bidAmount > team.budget) {
    return res.status(400).json({ error: `Not enough budget. Available: ${team.budget} points` });
  }

  gameState.currentBid = bidAmount;
  gameState.currentBidder = teamId;
  resetBidTimer();

  const bidPayload = {
    bid: bidAmount,
    bidderTeamId: teamId,
    bidderName: team.ownerName || team.name,
    teamName: team.name,
    timerSeconds: gameState.timerSeconds,
  };

  io.emit('bidPlaced', bidPayload);
  saveState();

  return res.json({ success: true, ...bidPayload });
});

// REST Admin Auction Control APIs
app.post('/api/auction/start', (req, res) => {
  const pass = req.headers['x-admin-pass'] || (req.body && req.body.adminPass);
  if (!isAdminPass(pass)) return res.status(401).json({ error: 'Unauthorized' });

  if (gameState.phase !== 'lobby' && gameState.phase !== 'finished') {
    return res.json({ success: true, gameState: getSafeState() });
  }

  if (Object.keys(gameState.teams).length < 1) {
    return res.status(400).json({ error: 'Need at least 1 registered team to start' });
  }

  gameState.phase = 'auction';
  gameState.auctionQueue = [...gameState.players].sort(() => Math.random() - 0.5);
  gameState.queueFilter = normalizeQueueFilter(null);
  gameState.timerSeconds = BID_TIMER_SECONDS;
  gameState.resultReview = createInitialResultReview();
  
  io.emit('auctionStarted', { gameState: getSafeState(), hostSocketId: null });
  emitQueueUpdate();
  saveState();

  setTimeout(() => {
    if (gameState.phase === 'auction') {
      nextPlayer();
    }
  }, 800);

  return res.json({ success: true, gameState: getSafeState() });
});

app.post('/api/auction/pause', (req, res) => {
  const pass = req.headers['x-admin-pass'] || (req.body && req.body.adminPass);
  if (!isAdminPass(pass)) return res.status(401).json({ error: 'Unauthorized' });

  if (gameState.phase !== 'auction') {
    return res.json({ success: true, gameState: getSafeState() });
  }

  clearBidTimer();
  gameState.phase = 'paused';
  io.emit('auctionPaused', { gameState: getSafeState() });
  emitQueueUpdate();
  saveState();
  return res.json({ success: true, gameState: getSafeState() });
});

app.post('/api/auction/resume', (req, res) => {
  const pass = req.headers['x-admin-pass'] || (req.body && req.body.adminPass);
  if (!isAdminPass(pass)) return res.status(401).json({ error: 'Unauthorized' });

  if (gameState.phase !== 'paused') {
    return res.json({ success: true, gameState: getSafeState() });
  }

  gameState.phase = 'auction';
  startBidTimer();
  io.emit('auctionResumed', { gameState: getSafeState() });
  emitQueueUpdate();
  saveState();
  return res.json({ success: true, gameState: getSafeState() });
});

app.post('/api/auction/next', (req, res) => {
  const pass = req.headers['x-admin-pass'] || (req.body && req.body.adminPass);
  if (!isAdminPass(pass)) return res.status(401).json({ error: 'Unauthorized' });

  gameState.phase = 'auction';
  nextPlayer();
  return res.json({ success: true, gameState: getSafeState() });
});

app.post('/api/auction/sell', (req, res) => {
  const pass = req.headers['x-admin-pass'] || (req.body && req.body.adminPass);
  if (!isAdminPass(pass)) return res.status(401).json({ error: 'Unauthorized' });

  if (gameState.phase !== 'auction') return res.status(400).json({ error: 'Auction not active' });
  clearBidTimer();
  sealBid();
  return res.json({ success: true, gameState: getSafeState() });
});

app.post('/api/auction/unsold', (req, res) => {
  const pass = req.headers['x-admin-pass'] || (req.body && req.body.adminPass);
  if (!isAdminPass(pass)) return res.status(401).json({ error: 'Unauthorized' });

  if (gameState.phase !== 'auction') return res.status(400).json({ error: 'Auction not active' });
  clearBidTimer();
  const player = gameState.currentPlayer;
  if (player) {
    gameState.unsoldPlayers.push({ ...player });
    io.emit('playerUnsold', { player });
    gameState.currentPlayer = null;
    gameState.currentBid = 0;
    gameState.currentBidder = null;
    gameState.timerSeconds = 0;
    emitQueueUpdate();
    saveState();
  }
  return res.json({ success: true, gameState: getSafeState() });
});

app.post('/api/auction/stop', (req, res) => {
  const pass = req.headers['x-admin-pass'] || (req.body && req.body.adminPass);
  if (!isAdminPass(pass)) return res.status(401).json({ error: 'Unauthorized' });

  endAuction();
  return res.json({ success: true, gameState: getSafeState() });
});

app.post('/api/admin/verify-team', (req, res) => {
  const pass = req.headers['x-admin-pass'] || (req.body && req.body.adminPass);
  if (!isAdminPass(pass)) return res.status(401).json({ error: 'Unauthorized' });

  const { teamId, verified } = req.body || {};
  if (!teamId || !gameState.teams[teamId]) {
    return res.status(404).json({ error: 'Team not found' });
  }

  const isVerified = verified !== undefined ? Boolean(verified) : true;
  gameState.teams[teamId].verified = isVerified;
  saveState();
  broadcastTeamsUpdate();
  io.emit('teamVerified', { teamId, verified: isVerified });
  return res.json({ success: true, teamId, verified: isVerified });
});

app.post('/api/admin/verify-all-teams', (req, res) => {
  const pass = req.headers['x-admin-pass'] || (req.body && req.body.adminPass);
  if (!isAdminPass(pass)) return res.status(401).json({ error: 'Unauthorized' });

  const isVerified = req.body && req.body.verified !== undefined ? Boolean(req.body.verified) : true;
  Object.values(gameState.teams).forEach((t) => {
    t.verified = isVerified;
  });
  saveState();
  broadcastTeamsUpdate();
  io.emit('allTeamsVerified', { verified: isVerified });
  return res.json({ success: true, verified: isVerified });
});

// Register new team via public API
app.post('/api/teams/register', (req, res) => {
  const rawName = String(req.body.name || req.body.teamName || '').trim();
  if (!rawName) {
    return res.status(400).json({ error: 'Team name is required' });
  }

  const existingNames = Object.values(gameState.teams).map(t => (t.name || '').toLowerCase());
  if (existingNames.includes(rawName.toLowerCase())) {
    return res.status(409).json({ error: 'A team with this name already exists' });
  }

  const slug = rawName.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 16);
  const teamId = `team_${slug}_${Math.random().toString(36).substring(2, 6)}`;
  let short = String(req.body.short || '').trim().toUpperCase();
  if (!short) {
    short = rawName.split(/\s+/).map(w => w[0]).join('').slice(0, 4).toUpperCase() || 'TEAM';
  }

  const leader = String(req.body.leader || req.body.leaderName || '').trim();
  const rawMembers = Array.isArray(req.body.members)
    ? req.body.members
    : (typeof req.body.members === 'string' ? req.body.members.split(',').map(s => s.trim()).filter(Boolean) : []);
  const members = rawMembers.map(m => String(m).trim()).filter(Boolean).slice(0, 5);
  const logo = String(req.body.logo || req.body.image || '').trim();
  const color = String(req.body.color || '#00e5ff').trim();
  const icon = String(req.body.icon || '⚡').trim();
  const password = String(req.body.password || req.body.code || Math.random().toString(36).substring(2, 8)).trim();
  const customBudget = Number(req.body.budget);
  const budget = Number.isFinite(customBudget) && customBudget > 0 ? customBudget : INITIAL_BUDGET;

  const newTeam = {
    id: teamId,
    name: rawName,
    short,
    leader,
    members,
    color,
    icon,
    logo,
    password,
    budget,
    verified: false,
    players: [],
    playingXI: {},
    ownerId: null,
    ownerName: rawName,
    ownerIp: null,
  };

  gameState.teams[teamId] = newTeam;
  saveState();

  io.emit('teamRegistered', {
    team: {
      id: newTeam.id,
      name: newTeam.name,
      short: newTeam.short,
      leader: newTeam.leader,
      members: newTeam.members,
      color: newTeam.color,
      icon: newTeam.icon,
      logo: newTeam.logo,
      budget: newTeam.budget,
      verified: newTeam.verified,
      players: [],
      playerCount: 0,
    }
  });
  broadcastTeamsUpdate();

  return res.json({
    success: true,
    teamId,
    password,
    team: newTeam,
  });
});

// Join / Authenticate team via public REST API
app.post(['/api/teams/join', '/api/teams/login'], (req, res) => {
  const { teamId: rawTeamId, password: rawPassword, passcode } = req.body || {};
  const searchKey = String(rawTeamId || req.body.name || req.body.code || '').trim();
  const password = String(rawPassword || passcode || '').trim();

  if (!searchKey && !password) {
    return res.status(400).json({ error: 'Team passcode or name is required' });
  }

  let team = null;
  if (searchKey && gameState.teams[searchKey]) {
    team = gameState.teams[searchKey];
  } else {
    const teamsList = Object.values(gameState.teams);
    team = teamsList.find(t => 
      (t.password && password && t.password.toLowerCase() === password.toLowerCase()) ||
      (t.password && searchKey && t.password.toLowerCase() === searchKey.toLowerCase()) ||
      (t.id && searchKey && t.id.toLowerCase() === searchKey.toLowerCase()) ||
      (t.short && searchKey && t.short.toLowerCase() === searchKey.toLowerCase()) ||
      (t.name && searchKey && t.name.toLowerCase() === searchKey.toLowerCase())
    );
  }

  if (!team) {
    return res.status(404).json({ error: 'Invalid team passcode or name' });
  }

  if (team.password && password && team.password.toLowerCase() !== password.toLowerCase()) {
    return res.status(401).json({ error: 'Incorrect team passcode' });
  }

  const reconnectToken = randomUUID();
  reconnectSessions[reconnectToken] = {
    teamId: team.id,
    name: team.name,
  };

  saveState();

  return res.json({
    success: true,
    teamId: team.id,
    name: team.name,
    password: team.password,
    reconnectToken,
    team: {
      id: team.id,
      name: team.name,
      short: team.short,
      leader: team.leader,
      members: team.members,
      color: team.color,
      icon: team.icon,
      logo: team.logo,
      budget: team.budget,
      verified: Boolean(team.verified),
      players: team.players || [],
      playingXI: team.playingXI || {},
    },
  });
});

// Admin Add Team
app.post('/api/admin/teams/add', requireAdmin, (req, res) => {
  const rawName = String(req.body.name || req.body.teamName || '').trim();
  if (!rawName) {
    return res.status(400).json({ error: 'Team name is required' });
  }

  const slug = rawName.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 16);
  const teamId = String(req.body.id || `team_${slug}_${Math.random().toString(36).substring(2, 6)}`).trim();
  
  let short = String(req.body.short || '').trim().toUpperCase();
  if (!short) {
    short = rawName.split(/\s+/).map(w => w[0]).join('').slice(0, 4).toUpperCase() || 'TEAM';
  }

  const leader = String(req.body.leader || req.body.leaderName || '').trim();
  const rawMembers = Array.isArray(req.body.members)
    ? req.body.members
    : (typeof req.body.members === 'string' ? req.body.members.split(',').map(s => s.trim()).filter(Boolean) : []);
  const members = rawMembers.map(m => String(m).trim()).filter(Boolean).slice(0, 5);
  const color = String(req.body.color || '#00e5ff').trim();
  const icon = String(req.body.icon || '⚡').trim();
  const password = String(req.body.password || Math.random().toString(36).substring(2, 8)).trim();
  const customBudget = Number(req.body.budget);
  const budget = Number.isFinite(customBudget) && customBudget > 0 ? customBudget : INITIAL_BUDGET;

  const newTeam = {
    id: teamId,
    name: rawName,
    short,
    leader,
    members,
    color,
    icon,
    logo: String(req.body.logo || '').trim(),
    password,
    budget,
    verified: req.body.verified !== undefined ? Boolean(req.body.verified) : true,
    players: [],
    playingXI: {},
    ownerId: null,
    ownerName: rawName,
    ownerIp: null,
  };

  gameState.teams[teamId] = newTeam;
  saveState();
  broadcastTeamsUpdate();

  return res.json({ success: true, team: newTeam });
});

// Admin Verify / Approve Team
app.post('/api/admin/teams/verify', requireAdmin, (req, res) => {
  const teamId = String(req.body.id || req.body.teamId || '').trim();
  if (!teamId || !gameState.teams[teamId]) {
    return res.status(404).json({ error: 'Team not found' });
  }
  const verified = req.body.verified !== undefined ? Boolean(req.body.verified) : true;
  gameState.teams[teamId].verified = verified;
  saveState();
  broadcastTeamsUpdate();
  io.emit('teamVerified', { teamId, verified });
  return res.json({ success: true, team: gameState.teams[teamId], verified });
});

// Admin Verify All Teams
app.post('/api/admin/teams/verify-all', requireAdmin, (req, res) => {
  const verified = req.body.verified !== undefined ? Boolean(req.body.verified) : true;
  Object.values(gameState.teams).forEach((t) => {
    t.verified = verified;
  });
  saveState();
  broadcastTeamsUpdate();
  io.emit('allTeamsVerified', { verified });
  return res.json({ success: true, verified });
});

// Admin Edit Team
app.post('/api/admin/teams/edit', requireAdmin, (req, res) => {
  const teamId = String(req.body.id || '').trim();
  if (!teamId || !gameState.teams[teamId]) {
    return res.status(404).json({ error: 'Team not found' });
  }

  const t = gameState.teams[teamId];
  if (req.body.name) t.name = String(req.body.name).trim();
  if (req.body.short) t.short = String(req.body.short).trim().toUpperCase();
  if (req.body.leader !== undefined) t.leader = String(req.body.leader).trim();
  if (req.body.members !== undefined) {
    const raw = Array.isArray(req.body.members) ? req.body.members : String(req.body.members).split(',').map(s => s.trim());
    t.members = raw.filter(Boolean).slice(0, 5);
  }
  if (req.body.color) t.color = String(req.body.color).trim();
  if (req.body.icon) t.icon = String(req.body.icon).trim();
  if (req.body.logo !== undefined) t.logo = String(req.body.logo).trim();
  if (req.body.password) t.password = String(req.body.password).trim();
  if (req.body.verified !== undefined) t.verified = Boolean(req.body.verified);
  if (req.body.budget !== undefined && Number.isFinite(Number(req.body.budget))) {
    t.budget = Number(req.body.budget);
  }

  saveState();
  broadcastTeamsUpdate();
  return res.json({ success: true, team: t });
});

// Admin Delete Team
app.post('/api/admin/teams/delete', requireAdmin, (req, res) => {
  const teamId = String(req.body.id || '').trim();
  if (!teamId || !gameState.teams[teamId]) {
    return res.status(404).json({ error: 'Team not found' });
  }

  delete gameState.teams[teamId];
  saveState();
  broadcastTeamsUpdate();
  return res.json({ success: true, deletedId: teamId });
});

// Admin Seed Starter Electronic Teams
app.post('/api/admin/teams/seed', requireAdmin, (req, res) => {
  seedDefaultTeams(gameState.teams);
  saveState();
  broadcastTeamsUpdate();
  return res.json({ success: true, teams: gameState.teams });
});

// Admin Reset Starting Budget for All Teams
app.post('/api/admin/teams/reset-budget', requireAdmin, (req, res) => {
  const budget = Number(req.body.budget);
  if (!Number.isFinite(budget) || budget <= 0) {
    return res.status(400).json({ error: 'Valid budget number is required' });
  }

  Object.values(gameState.teams).forEach((t) => {
    t.budget = budget;
  });

  saveState();
  broadcastTeamsUpdate();
  return res.json({ success: true, budget });
});

// Reset all team passwords (admin only)
app.post('/api/admin/reset-passwords', requireAdmin, (req, res) => {
  const body = req.body || {};
  const manual = body.passwords && typeof body.passwords === 'object' ? body.passwords : null;
  const newPasswords = [];

  Object.values(gameState.teams || {}).forEach((t) => {
    if (manual && manual[t.id]) {
      t.password = String(manual[t.id]).trim();
    } else {
      t.password = Math.random().toString(36).substring(2, 8);
    }
    newPasswords.push({ id: t.id, name: t.name, short: t.short, password: t.password });
  });

  saveState();
  return res.json({ success: true, newPasses: newPasswords });
});

app.get('/api/admin/report.csv', requireAdmin, (req, res) => {
  const report = buildAdminReport();
  const csv = buildAdminReportCsv(report);
  const stamp = new Date(report.generatedAt).toISOString().replace(/[:.]/g, '-');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="electro-auction-report-${stamp}.csv"`);
  return res.send(csv);
});

app.get('/api/admin/alerts', requireAdmin, (req, res) => {
  const statusFilter = String(req.query && req.query.status ? req.query.status : 'all').trim().toLowerCase();
  const alertsState = getAlertsStatePayload();

  let alerts = alertsState.alerts;
  if (statusFilter === 'active') alerts = alertsState.activeAlerts;
  if (statusFilter === 'resolved') alerts = alertsState.resolvedAlerts;

  return res.json({
    success: true,
    emailTo: ALERT_EMAIL_TO,
    webhookConfigured: Boolean(ALERT_EMAIL_WEBHOOK_URL),
    alerts,
    alertsState,
  });
});

app.post('/api/admin/alerts', requireAdmin, async (req, res) => {
  const message = trimAndLimit(req.body && req.body.message ? req.body.message : '', 600);
  if (!message) {
    return res.status(400).json({ error: 'Alert message is required' });
  }

  const typeRaw = String(req.body && req.body.type ? req.body.type : '').trim().toLowerCase();
  const severity = normalizeAlertSeverity(req.body && req.body.severity);
  const source = trimAndLimit(req.body && req.body.source ? req.body.source : 'Coordinator', 80) || 'Coordinator';
  const createdBy = trimAndLimit(req.body && req.body.createdBy ? req.body.createdBy : 'Coordinator', 60) || 'Coordinator';
  const title = trimAndLimit(
    req.body && req.body.title ? req.body.title : (typeRaw === 'note' ? 'Coordinator Note' : 'Coordinator Alert'),
    120
  ) || (typeRaw === 'note' ? 'Coordinator Note' : 'Coordinator Alert');
  const sendEmail = req.body && Object.prototype.hasOwnProperty.call(req.body, 'sendEmail')
    ? Boolean(req.body.sendEmail)
    : true;

  const alert = {
    id: randomUUID(),
    title,
    message,
    severity,
    source,
    status: 'active',
    createdAt: Date.now(),
    createdBy,
    resolvedAt: null,
    resolvedBy: null,
    email: {
      to: ALERT_EMAIL_TO,
      attempted: false,
      delivered: false,
      statusCode: null,
      reason: sendEmail ? null : 'Email disabled by request',
    },
  };

  if (sendEmail) {
    const emailResult = await sendAlertEmailWebhook(alert);
    alert.email = {
      to: ALERT_EMAIL_TO,
      attempted: Boolean(emailResult && emailResult.attempted),
      delivered: Boolean(emailResult && emailResult.delivered),
      statusCode: Number(emailResult && emailResult.statusCode) || null,
      reason: trimAndLimit(emailResult && emailResult.reason ? emailResult.reason : '', 200) || null,
    };
  }

  if (!Array.isArray(gameState.alerts)) {
    gameState.alerts = [];
  }
  gameState.alerts.unshift(alert);
  if (gameState.alerts.length > ALERT_HISTORY_LIMIT) {
    gameState.alerts = gameState.alerts.slice(0, ALERT_HISTORY_LIMIT);
  }

  emitAlertsUpdate();

  return res.status(201).json({
    success: true,
    alert,
    emailTo: ALERT_EMAIL_TO,
    webhookConfigured: Boolean(ALERT_EMAIL_WEBHOOK_URL),
    alertsState: getAlertsStatePayload(),
  });
});

app.post('/api/admin/alerts/:id/resolve', requireAdmin, (req, res) => {
  const alertId = trimAndLimit(req.params && req.params.id ? req.params.id : '', 120);
  if (!alertId) {
    return res.status(400).json({ error: 'Invalid alert id' });
  }

  if (!Array.isArray(gameState.alerts)) {
    gameState.alerts = [];
  }

  const idx = gameState.alerts.findIndex((alert) => String(alert && alert.id) === alertId);
  if (idx === -1) {
    return res.status(404).json({ error: 'Alert not found' });
  }

  const resolvedBy = trimAndLimit(req.body && req.body.resolvedBy ? req.body.resolvedBy : 'Admin', 60) || 'Admin';
  const target = gameState.alerts[idx];
  if (normalizeAlertStatus(target && target.status) !== 'resolved') {
    target.status = 'resolved';
    target.resolvedAt = Date.now();
    target.resolvedBy = resolvedBy;
  }

  emitAlertsUpdate();

  return res.json({
    success: true,
    alert: target,
    alertsState: getAlertsStatePayload(),
  });
});

app.delete('/api/admin/alerts/:id', requireAdmin, (req, res) => {
  const alertId = trimAndLimit(req.params && req.params.id ? req.params.id : '', 120);
  if (!alertId) {
    return res.status(400).json({ error: 'Invalid alert id' });
  }

  if (!Array.isArray(gameState.alerts)) {
    gameState.alerts = [];
  }

  const initialLength = gameState.alerts.length;
  gameState.alerts = gameState.alerts.filter((alert) => String(alert && alert.id) !== alertId);
  if (gameState.alerts.length === initialLength) {
    return res.status(404).json({ error: 'Alert not found' });
  }

  emitAlertsUpdate();

  return res.json({
    success: true,
    deletedAlertId: alertId,
    alertsState: getAlertsStatePayload(),
  });
});

app.post('/api/admin/alerts/clear-resolved', requireAdmin, (req, res) => {
  if (!Array.isArray(gameState.alerts)) {
    gameState.alerts = [];
  }

  const before = gameState.alerts.length;
  gameState.alerts = gameState.alerts.filter((alert) => normalizeAlertStatus(alert && alert.status) !== 'resolved');
  const deleted = Math.max(0, before - gameState.alerts.length);

  emitAlertsUpdate();

  return res.json({
    success: true,
    deleted,
    alertsState: getAlertsStatePayload(),
  });
});

app.get('/api/admin/queue', requireAdmin, (req, res) => {
  return res.json({
    success: true,
    queueState: getQueueStatePayload(),
  });
});

app.post('/api/admin/queue/prioritize', requireAdmin, (req, res) => {
  if (gameState.phase !== 'auction' && gameState.phase !== 'paused') {
    return res.status(409).json({ error: 'Queue prioritization is available only during auction or pause' });
  }

  const filter = normalizeQueueFilter(req.body || {});
  const prioritized = [];
  const remaining = [];

  gameState.auctionQueue.forEach((player) => {
    if (matchesQueueFilter(player, filter)) prioritized.push(player);
    else remaining.push(player);
  });

  gameState.auctionQueue = prioritized.concat(remaining);
  gameState.queueFilter = filter;
  emitQueueUpdate();

  return res.json({
    success: true,
    matched: prioritized.length,
    remaining: remaining.length,
    queueState: getQueueStatePayload(),
  });
});

app.post('/api/admin/queue/move-next', requireAdmin, (req, res) => {
  if (gameState.phase !== 'auction' && gameState.phase !== 'paused') {
    return res.status(409).json({ error: 'Queue editing is available only during auction or pause' });
  }

  const playerId = Number(req.body && req.body.playerId);
  if (!Number.isFinite(playerId) || playerId <= 0) {
    return res.status(400).json({ error: 'Invalid playerId' });
  }

  const idx = gameState.auctionQueue.findIndex((player) => Number(player && player.id) === playerId);
  if (idx === -1) {
    return res.status(404).json({ error: 'Player not found in remaining queue' });
  }

  const [target] = gameState.auctionQueue.splice(idx, 1);
  gameState.auctionQueue.unshift(target);
  gameState.queueFilter = normalizeQueueFilter(null);
  emitQueueUpdate();

  return res.json({
    success: true,
    player: target,
    queueState: getQueueStatePayload(),
  });
});

app.post('/api/admin/queue/deck', requireAdmin, (req, res) => {
  if (gameState.phase !== 'auction' && gameState.phase !== 'paused') {
    return res.status(409).json({ error: 'Deck queueing is available only during auction or pause' });
  }

  const rawPlayerIds = Array.isArray(req.body && req.body.playerIds) ? req.body.playerIds : [];
  const playerIds = [];
  const seen = new Set();

  rawPlayerIds.forEach((value) => {
    const id = Number(value);
    if (!Number.isFinite(id) || id <= 0) return;
    if (seen.has(id)) return;
    seen.add(id);
    playerIds.push(id);
  });

  if (playerIds.length === 0) {
    return res.status(400).json({ error: 'playerIds must include at least one valid id' });
  }

  const mode = String(req.body && req.body.mode || 'ordered').trim().toLowerCase();
  const randomMode = mode === 'random';

  const soldIds = getSoldPlayerIdSet();
  const picked = [];
  let movedFromRemaining = 0;
  let movedFromUnsold = 0;
  let ignoredSold = 0;
  let ignoredMissing = 0;

  playerIds.forEach((id) => {
    if (soldIds.has(id)) {
      ignoredSold += 1;
      return;
    }

    const queueIdx = gameState.auctionQueue.findIndex((player) => Number(player && player.id) === id);
    if (queueIdx >= 0) {
      const [player] = gameState.auctionQueue.splice(queueIdx, 1);
      if (player) {
        picked.push(player);
        movedFromRemaining += 1;
      }
      return;
    }

    const unsoldIdx = gameState.unsoldPlayers.findIndex((player) => Number(player && player.id) === id);
    if (unsoldIdx >= 0) {
      const [player] = gameState.unsoldPlayers.splice(unsoldIdx, 1);
      if (player) {
        picked.push(player);
        movedFromUnsold += 1;
      }
      return;
    }

    ignoredMissing += 1;
  });

  if (picked.length === 0) {
    return res.status(404).json({
      error: 'No eligible players found. Deck supports only unsold and remaining players (not sold).',
      ignoredSold,
      ignoredMissing,
    });
  }

  const selectedPlayers = randomMode ? shufflePlayers(picked) : picked;
  gameState.auctionQueue = selectedPlayers.concat(gameState.auctionQueue);
  gameState.queueFilter = normalizeQueueFilter(null);

  emitQueueUpdate();
  io.emit('stateUpdate', getSafeState());

  return res.json({
    success: true,
    moved: selectedPlayers.length,
    movedFromRemaining,
    movedFromUnsold,
    ignoredSold,
    ignoredMissing,
    mode: randomMode ? 'random' : 'ordered',
    queueState: getQueueStatePayload(),
  });
});

function getTeamsBelowSquadTarget(teamsMap) {
  const teams = Object.values(teamsMap || {});
  return teams
    .map((team) => ({
      teamId: team.id,
      teamShort: team.short || team.name || 'TEAM',
      players: getTeamSquadSize(team),
    }))
    .filter((entry) => entry.players < MAX_SQUAD_SIZE);
}

app.get('/api/admin/results', requireAdmin, (req, res) => {
  if (gameState.phase === 'finished' && (!gameState.resultReview || !Array.isArray(gameState.resultReview.standings) || gameState.resultReview.standings.length === 0)) {
    gameState.resultReview = {
      validated: false,
      validatedAt: null,
      standings: calculateResultStandings(gameState.teams),
      revealedPlaces: normalizeRevealedPlaces(null),
      revealedAt: {},
      manualOverride: null,
    };
  }

  return res.json({
    success: true,
    phase: gameState.phase,
    teams: gameState.teams,
    resultReview: getAdminResultReview(),
    publicResult: getPublicResultReview(),
  });
});

app.post('/api/admin/results/validate', requireAdmin, (req, res) => {
  if (gameState.phase !== 'finished') {
    return res.status(409).json({ error: 'Result validation is available only after auction completion' });
  }

  const incompleteTeams = getTeamsBelowSquadTarget(gameState.teams);
  if (incompleteTeams.length > 0) {
    const summary = incompleteTeams
      .map((entry) => `${entry.teamShort} (${entry.players}/${MAX_SQUAD_SIZE})`)
      .join(', ');
    return res.status(409).json({
      error: `All teams must have ${MAX_SQUAD_SIZE} players before validation. Incomplete: ${summary}`,
      incompleteTeams,
    });
  }

  const standings = calculateResultStandings(gameState.teams);
  const previous = gameState.resultReview || createInitialResultReview();
  gameState.resultReview = {
    validated: true,
    validatedAt: Date.now(),
    standings,
    revealedPlaces: normalizeRevealedPlaces(previous.revealedPlaces),
    revealedAt: previous.revealedAt || {},
    manualOverride: null,
  };

  emitResultUpdate();

  return res.json({
    success: true,
    resultReview: getAdminResultReview(),
    publicResult: getPublicResultReview(),
  });
});

app.post('/api/admin/results/override', requireAdmin, (req, res) => {
  if (gameState.phase !== 'finished') {
    return res.status(409).json({ error: 'Winning-list override is available only after auction completion' });
  }

  if (!gameState.resultReview || !gameState.resultReview.validated) {
    return res.status(409).json({ error: 'Validate results before applying manual winning list' });
  }

  if (hasAnyRevealedPlace(gameState.resultReview)) {
    return res.status(409).json({ error: 'Cannot edit winning list after reveal has started' });
  }

  const firstTeamId = String(req.body && req.body.firstTeamId || '').trim();
  const secondTeamId = String(req.body && req.body.secondTeamId || '').trim();
  const thirdTeamId = String(req.body && req.body.thirdTeamId || '').trim();
  if (!firstTeamId || !secondTeamId || !thirdTeamId) {
    return res.status(400).json({ error: 'firstTeamId, secondTeamId and thirdTeamId are required' });
  }

  const uniqueTeamIds = new Set([firstTeamId, secondTeamId, thirdTeamId]);
  if (uniqueTeamIds.size !== 3) {
    return res.status(400).json({ error: 'Top 3 teams must be unique' });
  }

  const standings = Array.isArray(gameState.resultReview.standings) ? gameState.resultReview.standings : [];
  const allTeamIds = new Set(standings.map((entry) => String(entry.teamId)));
  if (!allTeamIds.has(firstTeamId) || !allTeamIds.has(secondTeamId) || !allTeamIds.has(thirdTeamId)) {
    return res.status(404).json({ error: 'One or more selected teams are not found in standings' });
  }

  gameState.resultReview.standings = reorderStandingsByTopTeams(standings, {
    1: firstTeamId,
    2: secondTeamId,
    3: thirdTeamId,
  });
  gameState.resultReview.manualOverride = {
    updatedAt: Date.now(),
    places: {
      1: firstTeamId,
      2: secondTeamId,
      3: thirdTeamId,
    },
  };

  emitResultUpdate();

  return res.json({
    success: true,
    resultReview: getAdminResultReview(),
    publicResult: getPublicResultReview(),
  });
});

app.post('/api/admin/results/reveal', requireAdmin, (req, res) => {
  if (gameState.phase !== 'finished') {
    return res.status(409).json({ error: 'Reveal is available only after auction completion' });
  }

  const place = Number(req.body && req.body.place);
  if (!REVEAL_PLACES.includes(place)) {
    return res.status(400).json({ error: 'Invalid place. Allowed values: 3, 2, 1' });
  }

  if (!gameState.resultReview || !gameState.resultReview.validated) {
    return res.status(409).json({ error: 'Validate results before revealing winners' });
  }

  const revealedPlaces = normalizeRevealedPlaces(gameState.resultReview.revealedPlaces);

  if (place === 2 && !revealedPlaces[3]) {
    return res.status(409).json({ error: 'Reveal 3rd place first' });
  }
  if (place === 1 && (!revealedPlaces[3] || !revealedPlaces[2])) {
    return res.status(409).json({ error: 'Reveal 3rd and 2nd place before 1st' });
  }

  const standings = Array.isArray(gameState.resultReview.standings) ? gameState.resultReview.standings : [];
  const standing = standings.find((entry) => entry.place === place);
  if (!standing) {
    return res.status(404).json({ error: `No team available for place ${place}` });
  }

  revealedPlaces[place] = true;
  gameState.resultReview.revealedPlaces = revealedPlaces;
  gameState.resultReview.revealedAt = {
    ...(gameState.resultReview.revealedAt || {}),
    [place]: Date.now(),
  };

  emitResultUpdate();

  return res.json({
    success: true,
    place,
    revealed: standing,
    resultReview: getAdminResultReview(),
    publicResult: getPublicResultReview(),
  });
});

app.post('/api/admin/update-player-image', requireAdmin, (req, res) => {
  const { playerId, imageUrl } = req.body || {};
  if (!playerId || !imageUrl) {
    return res.status(400).json({ error: 'playerId and imageUrl required' });
  }

  const numericPlayerId = Number(playerId);
  if (!Number.isFinite(numericPlayerId) || numericPlayerId <= 0) {
    return res.status(400).json({ error: 'Invalid playerId' });
  }

  const player = gameState.players.find((item) => item.id === numericPlayerId);
  if (!player) {
    return res.status(404).json({ error: 'Player not found' });
  }

  const previousImage = player.image;
  player.image = imageUrl;

  try {
    syncPlayersDataFromState();
  } catch (error) {
    player.image = previousImage;
    console.error('Failed to persist player image update:', error);
    return res.status(500).json({ error: 'Failed to save image permanently' });
  }

  io.emit('playerUpdated', { player });
  return res.json({ success: true, player });
});

app.post('/api/admin/upload-player-image', requireAdmin, uploadMemory.single('image'), (req, res) => {
  const playerId = Number(req.body.playerId);
  if (!playerId || !Number.isFinite(playerId) || playerId <= 0) {
    return res.status(400).json({ error: 'Valid playerId required' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'Image file required' });
  }

  const mime = req.file.mimetype || 'image/png';
  const dataUrl = `data:${mime};base64,${req.file.buffer.toString('base64')}`;

  const player = gameState.players.find((item) => item.id === playerId);
  if (!player) {
    return res.status(404).json({ error: 'Player not found' });
  }

  const previousImage = player.image;
  player.image = dataUrl;

  try {
    syncPlayersDataFromState();
  } catch (error) {
    player.image = previousImage;
    console.error('Failed to persist uploaded player image:', error);
    return res.status(500).json({ error: 'Failed to save uploaded image permanently' });
  }

  io.emit('playerUpdated', { player });
  return res.json({ success: true, player, url: dataUrl });
});

app.post('/api/admin/flag-duplicate', requireAdmin, (req, res) => {
  const { playerId, note } = req.body || {};
  if (!playerId) {
    return res.status(400).json({ error: 'playerId required' });
  }

  gameState.duplicateFlags.push({
    playerId: Number(playerId),
    note: String(note || ''),
    flaggedAt: Date.now(),
  });

  io.emit('playerFlagged', {
    playerId: Number(playerId),
    note: String(note || ''),
  });

  return res.json({ success: true });
});

app.post('/api/reset', requireAdmin, (req, res) => {
  clearBidTimer();
  gameState = createInitialState();
  reloadPlayersFromDiskIfNeeded(true);
  clearObject(connectedUsers);
  clearObject(reconnectSessions);

  if (fs.existsSync(STATE_FILE)) {
    try {
      fs.unlinkSync(STATE_FILE);
    } catch (e) {
      console.error('Failed to delete state file during reset:', e);
    }
  }

  io.emit('gameReset', { message: 'Game has been reset' });
  emitQueueUpdate();
  emitAlertsUpdate();
  return res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Electro Auction (ECE Components) server running on http://localhost:${PORT}`);
  });
} else if (process.env.VERCEL) {
  server.listen(PORT);
}

module.exports = app;
module.exports.server = server;
module.exports.io = io;
