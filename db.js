/**
 * Electronic-Arena Database Layer (db.js)
 * Powered by Convex Cloud Database (https://dapper-akita-326.convex.cloud)
 * with Automatic Offline / Serverless File Storage Fallback.
 */

require('dotenv').config();
const { ConvexHttpClient } = require('convex/browser');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Resolve Convex URL from environment variables
const CONVEX_URL = process.env.CONVEX_URL || process.env.VITE_CONVEX_URL || 'https://dapper-akita-326.convex.cloud';

let convexClient = null;
let api = null;
let isConvexAvailable = false;
let lastDbError = null;

try {
  convexClient = new ConvexHttpClient(CONVEX_URL);
  const generated = require('./convex/_generated/api');
  api = generated.api;
  isConvexAvailable = true;
  console.log(`[Database] Convex client initialized for: ${CONVEX_URL}`);
} catch (err) {
  console.warn('[Database] Convex initialization notice:', err.message);
  isConvexAvailable = false;
  lastDbError = err.message;
}

// Resilient writable file path for fallback
function getFallbackFilePath(filename = 'auction_state.json') {
  const localStorageDir = path.join(__dirname, 'storage');
  try {
    if (!fs.existsSync(localStorageDir)) {
      fs.mkdirSync(localStorageDir, { recursive: true });
    }
    const testFile = path.join(localStorageDir, '.write_test');
    fs.writeFileSync(testFile, 'ok', 'utf8');
    fs.unlinkSync(testFile);
    return path.join(localStorageDir, filename);
  } catch (err) {
    const tmpDir = process.env.TMPDIR || os.tmpdir() || '/tmp';
    return path.join(tmpDir, filename);
  }
}

const FALLBACK_STATE_FILE = getFallbackFilePath('auction_state.json');

/**
 * Save complete Auction State to Convex Cloud DB and local fallback
 */
async function saveAuctionState(stateData) {
  // 1. Always save to local/tmp fallback for instant local access
  try {
    const dir = path.dirname(FALLBACK_STATE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(FALLBACK_STATE_FILE, JSON.stringify(stateData, null, 2), 'utf8');
  } catch (err) {
    console.warn('[Database] Fallback file save warning:', err.message);
  }

  // 2. Persist to Convex Cloud Database
  if (isConvexAvailable && convexClient && api && api.auction) {
    try {
      await convexClient.mutation(api.auction.saveAuctionState, {
        key: 'current_game',
        data: stateData,
      });
    } catch (err) {
      lastDbError = err.message;
      console.warn('[Database] Convex save warning:', err.message);
    }
  }
}

/**
 * Load Auction State from Convex Cloud DB or local fallback
 */
async function loadAuctionState() {
  // 1. Try Convex first
  if (isConvexAvailable && convexClient && api && api.auction) {
    try {
      const data = await convexClient.query(api.auction.getAuctionState, {
        key: 'current_game',
      });
      if (data && typeof data === 'object') {
        return data;
      }
    } catch (err) {
      lastDbError = err.message;
      console.warn('[Database] Convex load warning:', err.message);
    }
  }

  // 2. Fallback to file storage
  try {
    if (fs.existsSync(FALLBACK_STATE_FILE)) {
      const raw = fs.readFileSync(FALLBACK_STATE_FILE, 'utf8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('[Database] Fallback file load warning:', err.message);
  }

  return null;
}

/**
 * Save or update single team in Convex DB
 */
async function saveTeamToDb(team) {
  if (!team || !team.id) return;
  if (isConvexAvailable && convexClient && api && api.auction) {
    try {
      await convexClient.mutation(api.auction.saveTeam, { team });
    } catch (err) {
      console.warn('[Database] Convex saveTeam warning:', err.message);
    }
  }
}

/**
 * Delete team from Convex DB
 */
async function deleteTeamFromDb(teamId) {
  if (!teamId) return;
  if (isConvexAvailable && convexClient && api && api.auction) {
    try {
      await convexClient.mutation(api.auction.deleteTeam, { teamId });
    } catch (err) {
      console.warn('[Database] Convex deleteTeam warning:', err.message);
    }
  }
}

/**
 * Get all teams from Convex DB
 */
async function getTeamsFromDb() {
  if (isConvexAvailable && convexClient && api && api.auction) {
    try {
      const teams = await convexClient.query(api.auction.getTeams, {});
      return Array.isArray(teams) ? teams : [];
    } catch (err) {
      console.warn('[Database] Convex getTeams warning:', err.message);
    }
  }
  return [];
}

/**
 * Get Database Connection Diagnostics
 */
function getDbHealth() {
  return {
    connected: isConvexAvailable,
    storageType: 'convex-cloud-database',
    provider: 'Convex',
    url: CONVEX_URL,
    fallbackFilePath: FALLBACK_STATE_FILE,
    lastError: lastDbError,
  };
}

module.exports = {
  saveAuctionState,
  loadAuctionState,
  saveTeamToDb,
  deleteTeamFromDb,
  getTeamsFromDb,
  getDbHealth,
  getFallbackFilePath,
  FALLBACK_STATE_FILE,
  CONVEX_URL,
};
