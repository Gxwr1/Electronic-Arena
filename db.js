/**
 * Electronic-Arena Local Directory Storage Layer (db.js)
 * 100% Local, Offline & Wi-Fi Ready (Zero Cloud / Database Dependencies)
 * High-performance In-Memory State Cache + Asynchronous Local File Persistence.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Resolve local storage directory
function resolveStorageDir() {
  const localStorageDir = path.join(__dirname, 'storage');
  try {
    if (!fs.existsSync(localStorageDir)) {
      fs.mkdirSync(localStorageDir, { recursive: true });
    }
    return localStorageDir;
  } catch (err) {
    const tmpDir = process.env.TMPDIR || os.tmpdir() || path.join(__dirname, 'data');
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    return tmpDir;
  }
}

const STORAGE_DIR = resolveStorageDir();
const STATE_FILE_PATH = path.join(STORAGE_DIR, 'auction_state.json');

// In-memory cached state for instant zero-latency access
let memoryCache = null;
let saveDebounceTimer = null;
let isWriting = false;
let pendingStateToWrite = null;

/**
 * Perform asynchronous, non-blocking atomic write to disk
 */
async function flushStateToDisk(stateData) {
  if (isWriting) {
    pendingStateToWrite = stateData;
    return;
  }

  isWriting = true;
  try {
    const jsonString = JSON.stringify(stateData, null, 2);
    const tempFile = `${STATE_FILE_PATH}.tmp.${Date.now()}`;
    await fs.promises.writeFile(tempFile, jsonString, 'utf8');
    await fs.promises.rename(tempFile, STATE_FILE_PATH);
  } catch (err) {
    // If atomic rename fails (e.g. windows file lock), fallback to direct write
    try {
      await fs.promises.writeFile(STATE_FILE_PATH, JSON.stringify(stateData, null, 2), 'utf8');
    } catch (fallbackErr) {
      console.error('[LocalStorage] Failed to write state file:', fallbackErr.message);
    }
  } finally {
    isWriting = false;
    if (pendingStateToWrite) {
      const nextData = pendingStateToWrite;
      pendingStateToWrite = null;
      flushStateToDisk(nextData);
    }
  }
}

/**
 * Save complete Auction State to Local Storage
 * Updates memory instantly and schedules non-blocking disk persistence
 */
function saveAuctionState(stateData) {
  if (!stateData) return;
  memoryCache = stateData;

  // Debounce rapid saves (e.g. fast bids) to prevent disk thrashing
  clearTimeout(saveDebounceTimer);
  saveDebounceTimer = setTimeout(() => {
    flushStateToDisk(memoryCache);
  }, 50);
}

/**
 * Load Auction State from Local File Storage
 */
async function loadAuctionState() {
  if (memoryCache) {
    return memoryCache;
  }

  try {
    if (fs.existsSync(STATE_FILE_PATH)) {
      const raw = await fs.promises.readFile(STATE_FILE_PATH, 'utf8');
      memoryCache = JSON.parse(raw);
      return memoryCache;
    }
  } catch (err) {
    console.warn('[LocalStorage] Notice reading state file:', err.message);
  }

  return null;
}

/**
 * Save single team locally in state cache
 */
async function saveTeamToDb(team) {
  if (!team || !team.id) return;
  if (memoryCache && memoryCache.teams) {
    memoryCache.teams[team.id] = team;
    saveAuctionState(memoryCache);
  }
}

/**
 * Delete team from local state cache
 */
async function deleteTeamFromDb(teamId) {
  if (!teamId) return;
  if (memoryCache && memoryCache.teams) {
    delete memoryCache.teams[teamId];
    saveAuctionState(memoryCache);
  }
}

/**
 * Get all teams from local state
 */
async function getTeamsFromDb() {
  if (memoryCache && memoryCache.teams) {
    return Object.values(memoryCache.teams);
  }
  const loaded = await loadAuctionState();
  if (loaded && loaded.teams) {
    return Object.values(loaded.teams);
  }
  return [];
}

/**
 * Get Storage Health & Diagnostics
 */
function getDbHealth() {
  return {
    connected: true,
    storageType: 'local-file-system',
    provider: 'Local Storage (JSON)',
    storagePath: STATE_FILE_PATH,
    storageDir: STORAGE_DIR,
    lastError: null,
  };
}

module.exports = {
  saveAuctionState,
  loadAuctionState,
  saveTeamToDb,
  deleteTeamFromDb,
  getTeamsFromDb,
  getDbHealth,
  getFallbackFilePath: () => STATE_FILE_PATH,
  FALLBACK_STATE_FILE: STATE_FILE_PATH,
};
