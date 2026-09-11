/**
 * Digital Logic Circuit Simulator
 * High-performance digital logic evaluation engine & interactive canvas
 */
const socket = typeof io !== 'undefined'
  ? io({ transports: ['polling', 'websocket'], reconnection: true })
  : { on: () => {}, emit: () => {}, close: () => {} };
// ─── STATE & CONFIG ───
let allCatalog = [];
let myTeam = null;
let sandboxMode = false;
let isRunning = true;
let zoomLevel = 1.0;
let panOffset = { x: 0, y: 0 };
let isPanning = false;
let startPan = { x: 0, y: 0 };

// Circuit Graph
let placedComponents = []; // Array of ComponentInstance
let wires = []; // Array of WireInstance
let nextCompId = 1;
let nextWireId = 1;

// Interaction State
let selectedComponent = null;
let draggingComponent = null;
let dragOffset = { x: 0, y: 0 };
let wiringStartPin = null;
let currentMousePos = { x: 0, y: 0 };
let audioCtx = null;

// Clock generator state
let clockTimer = 0;
let clockState = 0;

// ─── COMPONENT DEFINITIONS (All 53 Items) ───
const COMPONENT_SPECS = {
  1: { id: 1, name: 'Input', role: 'Input', symbol: '→', pins: [{ id: 'out', label: 'OUT', type: 'out', x: 70, y: 30 }], w: 80, h: 60, type: 'toggle', defaultState: 0 },
  2: { id: 2, name: 'Button (Red)', role: 'Input', symbol: '—[SW]—', pins: [{ id: 'out', label: 'OUT', type: 'out', x: 70, y: 30 }], w: 80, h: 60, type: 'push', defaultState: 0 },
  3: { id: 3, name: 'Power (+V)', role: 'Input', symbol: '+V', pins: [{ id: 'out', label: '+V', type: 'out', x: 70, y: 30 }], w: 80, h: 60, type: 'vcc', defaultState: 1 },
  4: { id: 4, name: 'Constant Value', role: 'Input', symbol: '1', pins: [{ id: 'out', label: '1', type: 'out', x: 70, y: 30 }], w: 80, h: 60, type: 'const1', defaultState: 1 },
  5: { id: 5, name: 'Ground', role: 'Input', symbol: '⏚', pins: [{ id: 'out', label: 'GND', type: 'out', x: 70, y: 30 }], w: 80, h: 60, type: 'gnd', defaultState: 0 },
  6: { id: 6, name: 'Stepper Motor', role: 'Input', symbol: 'M', pins: [{ id: 'step', label: 'STEP', type: 'in', x: 10, y: 25 }, { id: 'dir', label: 'DIR', type: 'in', x: 10, y: 55 }], w: 90, h: 80, type: 'motor' },
  7: { id: 7, name: 'Counter', role: 'Input', symbol: 'CTR', pins: [{ id: 'clk', label: 'CLK', type: 'in', x: 10, y: 25 }, { id: 'rst', label: 'RST', type: 'in', x: 10, y: 55 }, { id: 'q0', label: 'Q0', type: 'out', x: 90, y: 20 }, { id: 'q1', label: 'Q1', type: 'out', x: 90, y: 40 }, { id: 'q2', label: 'Q2', type: 'out', x: 90, y: 60 }, { id: 'q3', label: 'Q3', type: 'out', x: 90, y: 80 }], w: 100, h: 100, type: 'counter' },
  8: { id: 8, name: 'Random', role: 'Input', symbol: '⚄', pins: [{ id: 'clk', label: 'CLK', type: 'in', x: 10, y: 30 }, { id: 'out', label: 'RND', type: 'out', x: 80, y: 30 }], w: 90, h: 60, type: 'random' },
  9: { id: 9, name: 'Digital Output', role: 'Output', symbol: '←', pins: [{ id: 'in', label: 'IN', type: 'in', x: 10, y: 30 }], w: 80, h: 60, type: 'output_terminal' },
  10: { id: 10, name: 'Digital Indicator (Red)', role: 'Output', symbol: '⊗', pins: [{ id: 'in', label: 'IN', type: 'in', x: 10, y: 30 }], w: 80, h: 60, type: 'led', color: '#ff3366' },
  11: { id: 11, name: 'Digital Indicator (Green)', role: 'Output', symbol: '⊗', pins: [{ id: 'in', label: 'IN', type: 'in', x: 10, y: 30 }], w: 80, h: 60, type: 'led', color: '#00ff88' },
  12: { id: 12, name: 'Digital Indicator (Blue)', role: 'Output', symbol: '⊗', pins: [{ id: 'in', label: 'IN', type: 'in', x: 10, y: 30 }], w: 80, h: 60, type: 'led', color: '#00e5ff' },
  13: { id: 13, name: 'Digital Indicator (Yellow)', role: 'Output', symbol: '⊗', pins: [{ id: 'in', label: 'IN', type: 'in', x: 10, y: 30 }], w: 80, h: 60, type: 'led', color: '#ffd700' },
  14: { id: 14, name: 'Digital Indicator (Orange)', role: 'Output', symbol: '⊗', pins: [{ id: 'in', label: 'IN', type: 'in', x: 10, y: 30 }], w: 80, h: 60, type: 'led', color: '#ff9900' },
  15: { id: 15, name: 'Digital Indicator (Cyan)', role: 'Output', symbol: '⊗', pins: [{ id: 'in', label: 'IN', type: 'in', x: 10, y: 30 }], w: 80, h: 60, type: 'led', color: '#00ffff' },
  16: { id: 16, name: 'Digital Indicator (Magenta)', role: 'Output', symbol: '⊗', pins: [{ id: 'in', label: 'IN', type: 'in', x: 10, y: 30 }], w: 80, h: 60, type: 'led', color: '#ff00ff' },
  17: { id: 17, name: 'Digital Indicator (White)', role: 'Output', symbol: '⊗', pins: [{ id: 'in', label: 'IN', type: 'in', x: 10, y: 30 }], w: 80, h: 60, type: 'led', color: '#ffffff' },
  18: { id: 18, name: 'Digital Indicator (Gray)', role: 'Output', symbol: '⊗', pins: [{ id: 'in', label: 'IN', type: 'in', x: 10, y: 30 }], w: 80, h: 60, type: 'led', color: '#94a3b8' },
  19: { id: 19, name: 'Digital Indicator (Dark)', role: 'Output', symbol: '⊗', pins: [{ id: 'in', label: 'IN', type: 'in', x: 10, y: 30 }], w: 80, h: 60, type: 'led', color: '#475569' },
  20: { id: 20, name: 'Digital Buzzer', role: 'Output', symbol: '🔊', pins: [{ id: 'in', label: 'IN', type: 'in', x: 10, y: 30 }], w: 80, h: 60, type: 'buzzer' },
  21: { id: 21, name: '7-Segment Display', role: 'Output', symbol: '8', pins: [{ id: 'a', label: 'a', type: 'in', x: 10, y: 15 }, { id: 'b', label: 'b', type: 'in', x: 10, y: 30 }, { id: 'c', label: 'c', type: 'in', x: 10, y: 45 }, { id: 'd', label: 'd', type: 'in', x: 10, y: 60 }, { id: 'e', label: 'e', type: 'in', x: 10, y: 75 }, { id: 'f', label: 'f', type: 'in', x: 10, y: 90 }, { id: 'g', label: 'g', type: 'in', x: 10, y: 105 }], w: 100, h: 120, type: 'seven_segment' },
  22: { id: 22, name: 'Hex Digit Display', role: 'Output', symbol: 'HEX', pins: [{ id: 'd0', label: 'D0', type: 'in', x: 10, y: 25 }, { id: 'd1', label: 'D1', type: 'in', x: 10, y: 45 }, { id: 'd2', label: 'D2', type: 'in', x: 10, y: 65 }, { id: 'd3', label: 'D3', type: 'in', x: 10, y: 85 }], w: 90, h: 110, type: 'hex_display' },
  23: { id: 23, name: 'AND Gate', role: 'Logic Gates', symbol: '&', pins: [{ id: 'a', label: 'A', type: 'in', x: 10, y: 25 }, { id: 'b', label: 'B', type: 'in', x: 10, y: 55 }, { id: 'out', label: 'Y', type: 'out', x: 80, y: 40 }], w: 90, h: 80, type: 'and' },
  24: { id: 24, name: 'OR Gate', role: 'Logic Gates', symbol: '≥1', pins: [{ id: 'a', label: 'A', type: 'in', x: 10, y: 25 }, { id: 'b', label: 'B', type: 'in', x: 10, y: 55 }, { id: 'out', label: 'Y', type: 'out', x: 80, y: 40 }], w: 90, h: 80, type: 'or' },
  25: { id: 25, name: 'NOT Gate', role: 'Logic Gates', symbol: '1○', pins: [{ id: 'a', label: 'A', type: 'in', x: 10, y: 35 }, { id: 'out', label: 'Y', type: 'out', x: 80, y: 35 }], w: 90, h: 70, type: 'not' },
  26: { id: 26, name: 'NAND Gate', role: 'Logic Gates', symbol: '&○', pins: [{ id: 'a', label: 'A', type: 'in', x: 10, y: 25 }, { id: 'b', label: 'B', type: 'in', x: 10, y: 55 }, { id: 'out', label: 'Y', type: 'out', x: 80, y: 40 }], w: 90, h: 80, type: 'nand' },
  27: { id: 27, name: 'NOR Gate', role: 'Logic Gates', symbol: '≥1○', pins: [{ id: 'a', label: 'A', type: 'in', x: 10, y: 25 }, { id: 'b', label: 'B', type: 'in', x: 10, y: 55 }, { id: 'out', label: 'Y', type: 'out', x: 80, y: 40 }], w: 90, h: 80, type: 'nor' },
  28: { id: 28, name: 'XOR Gate', role: 'Logic Gates', symbol: '=1', pins: [{ id: 'a', label: 'A', type: 'in', x: 10, y: 25 }, { id: 'b', label: 'B', type: 'in', x: 10, y: 55 }, { id: 'out', label: 'Y', type: 'out', x: 80, y: 40 }], w: 90, h: 80, type: 'xor' },
  29: { id: 29, name: 'XNOR Gate', role: 'Logic Gates', symbol: '=1○', pins: [{ id: 'a', label: 'A', type: 'in', x: 10, y: 25 }, { id: 'b', label: 'B', type: 'in', x: 10, y: 55 }, { id: 'out', label: 'Y', type: 'out', x: 80, y: 40 }], w: 90, h: 80, type: 'xnor' },
  30: { id: 30, name: 'Buffer', role: 'Logic Gates', symbol: '1', pins: [{ id: 'a', label: 'A', type: 'in', x: 10, y: 35 }, { id: 'out', label: 'Y', type: 'out', x: 80, y: 35 }], w: 90, h: 70, type: 'buffer' },
  31: { id: 31, name: 'Tri-State Buffer', role: 'Logic Gates', symbol: '▷', pins: [{ id: 'a', label: 'A', type: 'in', x: 10, y: 25 }, { id: 'en', label: 'EN', type: 'in', x: 45, y: 65 }, { id: 'out', label: 'Y', type: 'out', x: 80, y: 25 }], w: 90, h: 75, type: 'tristate' },
  32: { id: 32, name: 'Multiplexer', role: 'Decoders / Data Selectors', symbol: 'MUX', pins: [{ id: 'd0', label: 'D0', type: 'in', x: 10, y: 20 }, { id: 'd1', label: 'D1', type: 'in', x: 10, y: 50 }, { id: 's', label: 'S', type: 'in', x: 45, y: 70 }, { id: 'out', label: 'Y', type: 'out', x: 80, y: 35 }], w: 90, h: 80, type: 'mux2' },
  33: { id: 33, name: 'Demultiplexer', role: 'Decoders / Data Selectors', symbol: 'DEMUX', pins: [{ id: 'in', label: 'IN', type: 'in', x: 10, y: 35 }, { id: 's', label: 'S', type: 'in', x: 45, y: 70 }, { id: 'y0', label: 'Y0', type: 'out', x: 80, y: 20 }, { id: 'y1', label: 'Y1', type: 'out', x: 80, y: 50 }], w: 90, h: 80, type: 'demux2' },
  34: { id: 34, name: 'Decoder', role: 'Decoders / Data Selectors', symbol: 'DEC', pins: [{ id: 'a', label: 'A', type: 'in', x: 10, y: 30 }, { id: 'b', label: 'B', type: 'in', x: 10, y: 60 }, { id: 'y0', label: 'Y0', type: 'out', x: 90, y: 20 }, { id: 'y1', label: 'Y1', type: 'out', x: 90, y: 40 }, { id: 'y2', label: 'Y2', type: 'out', x: 90, y: 60 }, { id: 'y3', label: 'Y3', type: 'out', x: 90, y: 80 }], w: 100, h: 100, type: 'dec24' },
  35: { id: 35, name: 'Priority Encoder', role: 'Decoders / Data Selectors', symbol: 'ENC', pins: [{ id: 'd0', label: 'D0', type: 'in', x: 10, y: 20 }, { id: 'd1', label: 'D1', type: 'in', x: 10, y: 40 }, { id: 'd2', label: 'D2', type: 'in', x: 10, y: 60 }, { id: 'd3', label: 'D3', type: 'in', x: 10, y: 80 }, { id: 'y0', label: 'Y0', type: 'out', x: 90, y: 35 }, { id: 'y1', label: 'Y1', type: 'out', x: 90, y: 65 }], w: 100, h: 100, type: 'penc42' },
  36: { id: 36, name: 'D Flip-Flop', role: 'Sequential Elements', symbol: 'D', pins: [{ id: 'd', label: 'D', type: 'in', x: 10, y: 25 }, { id: 'clk', label: 'CLK', type: 'in', x: 10, y: 60 }, { id: 'q', label: 'Q', type: 'out', x: 80, y: 25 }, { id: 'qbar', label: "Q'", type: 'out', x: 80, y: 60 }], w: 90, h: 85, type: 'dff' },
  37: { id: 37, name: 'JK Flip-Flop', role: 'Sequential Elements', symbol: 'JK', pins: [{ id: 'j', label: 'J', type: 'in', x: 10, y: 20 }, { id: 'clk', label: 'CLK', type: 'in', x: 10, y: 45 }, { id: 'k', label: 'K', type: 'in', x: 10, y: 70 }, { id: 'q', label: 'Q', type: 'out', x: 80, y: 25 }, { id: 'qbar', label: "Q'", type: 'out', x: 80, y: 65 }], w: 90, h: 90, type: 'jkff' },
  38: { id: 38, name: 'T Flip-Flop', role: 'Sequential Elements', symbol: 'T', pins: [{ id: 't', label: 'T', type: 'in', x: 10, y: 25 }, { id: 'clk', label: 'CLK', type: 'in', x: 10, y: 60 }, { id: 'q', label: 'Q', type: 'out', x: 80, y: 25 }, { id: 'qbar', label: "Q'", type: 'out', x: 80, y: 60 }], w: 90, h: 85, type: 'tff' },
  39: { id: 39, name: 'SR Flip-Flop', role: 'Sequential Elements', symbol: 'SR', pins: [{ id: 's', label: 'S', type: 'in', x: 10, y: 20 }, { id: 'clk', label: 'CLK', type: 'in', x: 10, y: 45 }, { id: 'r', label: 'R', type: 'in', x: 10, y: 70 }, { id: 'q', label: 'Q', type: 'out', x: 80, y: 25 }, { id: 'qbar', label: "Q'", type: 'out', x: 80, y: 65 }], w: 90, h: 90, type: 'srff' },
  40: { id: 40, name: 'Register', role: 'Sequential Elements', symbol: 'REG', pins: [{ id: 'd0', label: 'D0', type: 'in', x: 10, y: 20 }, { id: 'd1', label: 'D1', type: 'in', x: 10, y: 40 }, { id: 'clk', label: 'CLK', type: 'in', x: 10, y: 65 }, { id: 'q0', label: 'Q0', type: 'out', x: 80, y: 20 }, { id: 'q1', label: 'Q1', type: 'out', x: 80, y: 40 }], w: 90, h: 85, type: 'reg2' },
  41: { id: 41, name: 'Clock', role: 'Sequential Elements', symbol: 'CLK', pins: [{ id: 'out', label: 'CLK', type: 'out', x: 70, y: 30 }], w: 80, h: 60, type: 'clock' },
  42: { id: 42, name: 'Text Annotation', role: 'Annotation', symbol: 'TXT', pins: [], w: 120, h: 50, type: 'text', label: 'Circuit Note' },
  43: { id: 43, name: 'Voltage Probe', role: 'Annotation', symbol: 'V', pins: [{ id: 'in', label: 'IN', type: 'in', x: 10, y: 30 }], w: 80, h: 60, type: 'probe' },
  44: { id: 44, name: 'Half Adder', role: 'Misc Components', symbol: 'HA', pins: [{ id: 'a', label: 'A', type: 'in', x: 10, y: 25 }, { id: 'b', label: 'B', type: 'in', x: 10, y: 55 }, { id: 's', label: 'SUM', type: 'out', x: 80, y: 25 }, { id: 'c', label: 'CARRY', type: 'out', x: 80, y: 55 }], w: 90, h: 80, type: 'ha' },
  45: { id: 45, name: 'Full Adder', role: 'Misc Components', symbol: 'FA', pins: [{ id: 'a', label: 'A', type: 'in', x: 10, y: 20 }, { id: 'b', label: 'B', type: 'in', x: 10, y: 45 }, { id: 'cin', label: 'CIN', type: 'in', x: 10, y: 70 }, { id: 's', label: 'SUM', type: 'out', x: 80, y: 30 }, { id: 'cout', label: 'COUT', type: 'out', x: 80, y: 60 }], w: 90, h: 90, type: 'fa' },
  46: { id: 46, name: '4-Bit Adder', role: 'Misc Components', symbol: 'ADD4', pins: [{ id: 'a', label: 'A[4]', type: 'in', x: 10, y: 30 }, { id: 'b', label: 'B[4]', type: 'in', x: 10, y: 60 }, { id: 's', label: 'S[4]', type: 'out', x: 90, y: 45 }], w: 100, h: 90, type: 'add4' },
  47: { id: 47, name: 'Comparator', role: 'Misc Components', symbol: 'CMP', pins: [{ id: 'a', label: 'A', type: 'in', x: 10, y: 25 }, { id: 'b', label: 'B', type: 'in', x: 10, y: 55 }, { id: 'eq', label: 'A=B', type: 'out', x: 80, y: 20 }, { id: 'gt', label: 'A>B', type: 'out', x: 80, y: 40 }, { id: 'lt', label: 'A<B', type: 'out', x: 80, y: 60 }], w: 90, h: 80, type: 'cmp' },
  48: { id: 48, name: '4-Bit ALU', role: 'Misc Components', symbol: 'ALU', pins: [{ id: 'a', label: 'A', type: 'in', x: 10, y: 25 }, { id: 'b', label: 'B', type: 'in', x: 10, y: 50 }, { id: 'op', label: 'OP', type: 'in', x: 10, y: 75 }, { id: 'out', label: 'Y', type: 'out', x: 90, y: 50 }], w: 100, h: 100, type: 'alu' },
  49: { id: 49, name: 'Multiplexer (4-to-1)', role: 'Decoders / Data Selectors', symbol: 'MUX4', pins: [{ id: 'd0', label: 'D0', type: 'in', x: 10, y: 20 }, { id: 'd1', label: 'D1', type: 'in', x: 10, y: 40 }, { id: 'd2', label: 'D2', type: 'in', x: 10, y: 60 }, { id: 'd3', label: 'D3', type: 'in', x: 10, y: 80 }, { id: 's0', label: 'S0', type: 'in', x: 35, y: 95 }, { id: 's1', label: 'S1', type: 'in', x: 65, y: 95 }, { id: 'out', label: 'Y', type: 'out', x: 90, y: 50 }], w: 100, h: 105, type: 'mux4' },
  50: { id: 50, name: 'Controller Inverter', role: 'Misc Components', symbol: '▷○', pins: [{ id: 'in', label: 'IN', type: 'in', x: 10, y: 35 }, { id: 'out', label: 'OUT', type: 'out', x: 80, y: 35 }], w: 90, h: 70, type: 'not' },
  51: { id: 51, name: 'Test Bench Input', role: 'Misc Components', symbol: '▰', pins: [{ id: 'out', label: 'TEST', type: 'out', x: 70, y: 30 }], w: 80, h: 60, type: 'toggle', defaultState: 1 },
  52: { id: 52, name: 'Test Bench Output', role: 'Misc Components', symbol: '▰', pins: [{ id: 'in', label: 'TEST', type: 'in', x: 10, y: 30 }], w: 80, h: 60, type: 'output_terminal' },
  53: { id: 53, name: 'Force Gate', role: 'Misc Components', symbol: 'F', pins: [{ id: 'a', label: 'A', type: 'in', x: 10, y: 25 }, { id: 'f', label: 'FRC', type: 'in', x: 10, y: 55 }, { id: 'out', label: 'Y', type: 'out', x: 80, y: 40 }], w: 90, h: 80, type: 'force' },
};

// ─── INITIALIZATION ───
const canvas = document.getElementById('circuitCanvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
  const wrap = document.getElementById('canvasWrap');
  canvas.width = wrap.clientWidth;
  canvas.height = wrap.clientHeight;
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Load players catalog from server
fetch('/api/players')
  .then((r) => r.json())
  .then((data) => {
    allCatalog = Array.isArray(data) ? data : [];
    renderComponentDrawer();
  })
  .catch(() => {
    // Fallback to local definitions
    allCatalog = Object.values(COMPONENT_SPECS);
    renderComponentDrawer();
  });

// Socket.IO updates for live inventory
socket.on('init', ({ availableTeams, currentJoinedTeams }) => {
  const saved = JSON.parse(localStorage.getItem('playerJoined') || '{}');
  if (saved && saved.teamId) {
    socket.emit('reconnectGame', { token: saved.reconnectToken });
  }
});

socket.on('myTeam', ({ team }) => {
  if (team) {
    myTeam = team;
    document.getElementById('teamNameDisplay').textContent = team.name || team.short;
    document.getElementById('teamBudgetDisplay').textContent = `${team.budget} pts`;
    renderComponentDrawer();
  }
});

socket.on('playerSold', ({ player, soldTo }) => {
  if (myTeam && soldTo === myTeam.id) {
    myTeam.players = myTeam.players || [];
    myTeam.players.push(player);
    renderComponentDrawer();
  }
});

// ─── COMPONENT DRAWER RENDERING ───
function renderComponentDrawer() {
  const list = document.getElementById('componentList');
  if (!list) return;

  const category = document.getElementById('categoryFilter').value;
  const search = document.getElementById('componentSearch').value.toLowerCase().trim();

  // Calculate owned counts per component ID
  const ownedCounts = {};
  if (myTeam && Array.isArray(myTeam.players)) {
    myTeam.players.forEach((p) => {
      const id = Number(p.id);
      ownedCounts[id] = (ownedCounts[id] || 0) + 1;
    });
  }

  // Calculate currently placed counts on canvas
  const placedCounts = {};
  placedComponents.forEach((c) => {
    placedCounts[c.templateId] = (placedCounts[c.templateId] || 0) + 1;
  });

  list.innerHTML = '';
  let availableTotal = 0;

  allCatalog.forEach((comp) => {
    const spec = COMPONENT_SPECS[comp.id] || comp;
    if (category !== 'all' && comp.role !== category) return;
    if (search && !comp.name.toLowerCase().includes(search) && !(comp.role || '').toLowerCase().includes(search)) return;

    const owned = ownedCounts[comp.id] || 0;
    const placed = placedCounts[comp.id] || 0;
    const remaining = sandboxMode ? 99 : Math.max(0, owned - placed);

    const isLocked = !sandboxMode && remaining <= 0;
    if (!isLocked) availableTotal += remaining;

    const card = document.createElement('div');
    card.className = `comp-item-card ${isLocked ? 'locked' : ''}`;
    card.draggable = !isLocked;

    card.innerHTML = `
      <img src="/images/comp_${comp.id}.svg" class="comp-item-img" alt="${comp.name}" onerror="this.src='/images/comp_1.svg'" />
      <div class="comp-item-meta">
        <div class="comp-item-name">${comp.name}</div>
        <div class="comp-item-sub">
          <span>${comp.symbolName || comp.symbol || comp.role}</span>
          <span class="comp-qty-badge ${remaining === 0 ? 'zero' : ''}">${sandboxMode ? '∞' : `${remaining} left`}</span>
        </div>
      </div>
    `;

    if (!isLocked) {
      card.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', JSON.stringify({ compId: comp.id }));
      });
      card.addEventListener('click', () => {
        // Quick add to center of canvas
        const cx = (canvas.width / 2 - panOffset.x) / zoomLevel;
        const cy = (canvas.height / 2 - panOffset.y) / zoomLevel;
        addComponentToCanvas(comp.id, cx - 40, cy - 30);
      });
    }

    list.appendChild(card);
  });

  document.getElementById('drawerCount').textContent = sandboxMode ? 'Sandbox (All 53 Unlocked)' : `${availableTotal} Available`;
}

function filterComponents() {
  renderComponentDrawer();
}

function toggleSandboxMode() {
  sandboxMode = !sandboxMode;
  const badge = document.getElementById('modeBadge');
  const btn = document.getElementById('btnToggleSandbox');
  if (sandboxMode) {
    badge.textContent = 'Sandbox Mode (All Unlocked)';
    badge.className = 'sim-mode-badge sandbox';
    btn.textContent = '🔒 RESTRICT TO TEAM INVENTORY';
    showToast('Sandbox mode enabled: All 53 components unlocked!', 'info');
  } else {
    badge.textContent = 'Team Inventory Mode';
    badge.className = 'sim-mode-badge';
    btn.textContent = '🔓 UNLOCK ALL (SANDBOX)';
    showToast('Restricted to your bidded components.', 'info');
  }
  renderComponentDrawer();
}

// ─── DRAG & DROP ONTO CANVAS ───
const canvasWrap = document.getElementById('canvasWrap');

canvasWrap.addEventListener('dragover', (e) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
});

canvasWrap.addEventListener('drop', (e) => {
  e.preventDefault();
  try {
    const data = JSON.parse(e.dataTransfer.getData('text/plain'));
    if (data && data.compId) {
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left - panOffset.x) / zoomLevel;
      const y = (e.clientY - rect.top - panOffset.y) / zoomLevel;
      addComponentToCanvas(data.compId, x - 40, y - 30);
    }
  } catch (err) {}
});

function addComponentToCanvas(templateId, x, y) {
  const spec = COMPONENT_SPECS[templateId];
  if (!spec) return;

  const instance = {
    instanceId: nextCompId++,
    templateId: templateId,
    name: spec.name,
    role: spec.role,
    type: spec.type,
    color: spec.color,
    symbol: spec.symbol,
    label: spec.label || spec.name,
    x: Math.round(x / 10) * 10,
    y: Math.round(y / 10) * 10,
    w: spec.w || 90,
    h: spec.h || 70,
    pins: JSON.parse(JSON.stringify(spec.pins || [])),
    state: spec.defaultState !== undefined ? spec.defaultState : 0,
    pinStates: {},
    internal: {
      prevClk: 0,
      q: 0,
      counterVal: 0,
      motorAngle: 0,
      waveform: [],
    },
  };

  // Init pin states
  instance.pins.forEach((p) => {
    instance.pinStates[p.id] = p.type === 'out' && instance.state !== undefined ? instance.state : 0;
  });

  placedComponents.push(instance);
  renderComponentDrawer();
  updateHud();
  showToast(`Added ${instance.name}`, 'info', 1500);
}

// ─── LOGIC EVALUATION ENGINE ───
function evaluateCircuit() {
  // 1. Clock pulse generator
  clockTimer += 1;
  if (clockTimer % 30 === 0) {
    clockState = clockState === 1 ? 0 : 1;
  }

  // 2. Evaluate Sources & Generators
  placedComponents.forEach((comp) => {
    if (comp.type === 'vcc' || comp.type === 'const1') {
      comp.pinStates['out'] = 1;
    } else if (comp.type === 'gnd') {
      comp.pinStates['out'] = 0;
    } else if (comp.type === 'clock') {
      comp.pinStates['out'] = clockState;
    } else if (comp.type === 'toggle' || comp.type === 'push') {
      comp.pinStates['out'] = comp.state ? 1 : 0;
    }
  });

  // 3. Propagate Wires (from output pins to input pins)
  wires.forEach((wire) => {
    const fromComp = placedComponents.find((c) => c.instanceId === wire.fromCompId);
    if (!fromComp) return;
    const signal = fromComp.pinStates[wire.fromPinId] || 0;
    wire.state = signal;

    const toComp = placedComponents.find((c) => c.instanceId === wire.toCompId);
    if (toComp) {
      toComp.pinStates[wire.toPinId] = signal;
    }
  });

  // 4. Evaluate Gates, Decoders, Sequential & Arithmetic Units
  placedComponents.forEach((comp) => {
    const pins = comp.pinStates;

    switch (comp.type) {
      case 'and':
        pins['out'] = (pins['a'] === 1 && pins['b'] === 1) ? 1 : 0;
        break;
      case 'or':
        pins['out'] = (pins['a'] === 1 || pins['b'] === 1) ? 1 : 0;
        break;
      case 'not':
        pins['out'] = pins['a'] === 1 ? 0 : 1;
        break;
      case 'nand':
        pins['out'] = !(pins['a'] === 1 && pins['b'] === 1) ? 1 : 0;
        break;
      case 'nor':
        pins['out'] = !(pins['a'] === 1 || pins['b'] === 1) ? 1 : 0;
        break;
      case 'xor':
        pins['out'] = pins['a'] !== pins['b'] ? 1 : 0;
        break;
      case 'xnor':
        pins['out'] = pins['a'] === pins['b'] ? 1 : 0;
        break;
      case 'buffer':
        pins['out'] = pins['a'] || 0;
        break;
      case 'tristate':
        pins['out'] = pins['en'] === 1 ? (pins['a'] || 0) : 0;
        break;
      case 'force':
        pins['out'] = pins['f'] === 1 ? 1 : (pins['a'] || 0);
        break;
      case 'mux2':
        pins['out'] = pins['s'] === 1 ? (pins['d1'] || 0) : (pins['d0'] || 0);
        break;
      case 'mux4': {
        const sel = ((pins['s1'] || 0) << 1) | (pins['s0'] || 0);
        pins['out'] = pins[`d${sel}`] || 0;
        break;
      }
      case 'demux2':
        pins['y0'] = pins['s'] === 0 ? (pins['in'] || 0) : 0;
        pins['y1'] = pins['s'] === 1 ? (pins['in'] || 0) : 0;
        break;
      case 'dec24': {
        const val = ((pins['b'] || 0) << 1) | (pins['a'] || 0);
        pins['y0'] = val === 0 ? 1 : 0;
        pins['y1'] = val === 1 ? 1 : 0;
        pins['y2'] = val === 2 ? 1 : 0;
        pins['y3'] = val === 3 ? 1 : 0;
        break;
      }
      case 'penc42':
        if (pins['d3']) { pins['y1'] = 1; pins['y0'] = 1; }
        else if (pins['d2']) { pins['y1'] = 1; pins['y0'] = 0; }
        else if (pins['d1']) { pins['y1'] = 0; pins['y0'] = 1; }
        else { pins['y1'] = 0; pins['y0'] = 0; }
        break;
      case 'dff': {
        const clk = pins['clk'] || 0;
        if (clk === 1 && comp.internal.prevClk === 0) {
          comp.internal.q = pins['d'] || 0;
        }
        comp.internal.prevClk = clk;
        pins['q'] = comp.internal.q;
        pins['qbar'] = comp.internal.q ? 0 : 1;
        break;
      }
      case 'jkff': {
        const clk = pins['clk'] || 0;
        if (clk === 1 && comp.internal.prevClk === 0) {
          const j = pins['j'] || 0;
          const k = pins['k'] || 0;
          if (j === 1 && k === 0) comp.internal.q = 1;
          else if (j === 0 && k === 1) comp.internal.q = 0;
          else if (j === 1 && k === 1) comp.internal.q = comp.internal.q ? 0 : 1;
        }
        comp.internal.prevClk = clk;
        pins['q'] = comp.internal.q;
        pins['qbar'] = comp.internal.q ? 0 : 1;
        break;
      }
      case 'tff': {
        const clk = pins['clk'] || 0;
        if (clk === 1 && comp.internal.prevClk === 0) {
          if (pins['t'] === 1) comp.internal.q = comp.internal.q ? 0 : 1;
        }
        comp.internal.prevClk = clk;
        pins['q'] = comp.internal.q;
        pins['qbar'] = comp.internal.q ? 0 : 1;
        break;
      }
      case 'srff': {
        const clk = pins['clk'] || 0;
        if (clk === 1 && comp.internal.prevClk === 0) {
          if (pins['s'] === 1) comp.internal.q = 1;
          else if (pins['r'] === 1) comp.internal.q = 0;
        }
        comp.internal.prevClk = clk;
        pins['q'] = comp.internal.q;
        pins['qbar'] = comp.internal.q ? 0 : 1;
        break;
      }
      case 'counter': {
        const clk = pins['clk'] || 0;
        if (pins['rst'] === 1) {
          comp.internal.counterVal = 0;
        } else if (clk === 1 && comp.internal.prevClk === 0) {
          comp.internal.counterVal = (comp.internal.counterVal + 1) % 16;
        }
        comp.internal.prevClk = clk;
        pins['q0'] = (comp.internal.counterVal & 1) ? 1 : 0;
        pins['q1'] = (comp.internal.counterVal & 2) ? 1 : 0;
        pins['q2'] = (comp.internal.counterVal & 4) ? 1 : 0;
        pins['q3'] = (comp.internal.counterVal & 8) ? 1 : 0;
        break;
      }
      case 'random': {
        const clk = pins['clk'] || 0;
        if (clk === 1 && comp.internal.prevClk === 0) {
          comp.internal.q = Math.random() > 0.5 ? 1 : 0;
        }
        comp.internal.prevClk = clk;
        pins['out'] = comp.internal.q;
        break;
      }
      case 'motor': {
        const step = pins['step'] || 0;
        if (step === 1 && comp.internal.prevClk === 0) {
          const dir = pins['dir'] === 1 ? 1 : -1;
          comp.internal.motorAngle = (comp.internal.motorAngle + dir * 30) % 360;
        }
        comp.internal.prevClk = step;
        break;
      }
      case 'ha': {
        const a = pins['a'] || 0;
        const b = pins['b'] || 0;
        pins['s'] = a ^ b;
        pins['c'] = a & b;
        break;
      }
      case 'fa': {
        const a = pins['a'] || 0;
        const b = pins['b'] || 0;
        const cin = pins['cin'] || 0;
        const sum1 = a ^ b;
        pins['s'] = sum1 ^ cin;
        pins['cout'] = (a & b) | (sum1 & cin);
        break;
      }
      case 'cmp': {
        const a = pins['a'] || 0;
        const b = pins['b'] || 0;
        pins['eq'] = a === b ? 1 : 0;
        pins['gt'] = a > b ? 1 : 0;
        pins['lt'] = a < b ? 1 : 0;
        break;
      }
      case 'buzzer':
        if (pins['in'] === 1 && isRunning) {
          playBuzzerTone();
        }
        break;
      case 'probe':
        comp.internal.waveform.push(pins['in'] || 0);
        if (comp.internal.waveform.length > 30) comp.internal.waveform.shift();
        break;
      default:
        break;
    }
  });
}

function playBuzzerTone() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(880, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.05);
  } catch (e) {}
}

// ─── RENDERING CANVAS ───
function render() {
  if (isRunning) {
    evaluateCircuit();
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(panOffset.x, panOffset.y);
  ctx.scale(zoomLevel, zoomLevel);

  // 1. Draw Grid Background
  drawGrid();

  // 2. Draw Wires
  drawWires();

  // 3. Draw In-progress Wire
  if (wiringStartPin) {
    drawTempWire();
  }

  // 4. Draw Components
  placedComponents.forEach((comp) => {
    drawComponent(comp);
  });

  ctx.restore();

  requestAnimationFrame(render);
}

function drawGrid() {
  const gridSize = 20;
  const startX = -panOffset.x / zoomLevel;
  const startY = -panOffset.y / zoomLevel;
  const endX = startX + canvas.width / zoomLevel;
  const endY = startY + canvas.height / zoomLevel;

  ctx.strokeStyle = 'rgba(0, 229, 255, 0.04)';
  ctx.lineWidth = 1;

  ctx.beginPath();
  for (let x = Math.floor(startX / gridSize) * gridSize; x < endX; x += gridSize) {
    ctx.moveTo(x, startY);
    ctx.lineTo(x, endY);
  }
  for (let y = Math.floor(startY / gridSize) * gridSize; y < endY; y += gridSize) {
    ctx.moveTo(startX, y);
    ctx.lineTo(endX, y);
  }
  ctx.stroke();
}

function drawWires() {
  wires.forEach((wire) => {
    const fromComp = placedComponents.find((c) => c.instanceId === wire.fromCompId);
    const toComp = placedComponents.find((c) => c.instanceId === wire.toCompId);
    if (!fromComp || !toComp) return;

    const fromPin = fromComp.pins.find((p) => p.id === wire.fromPinId);
    const toPin = toComp.pins.find((p) => p.id === wire.toPinId);
    if (!fromPin || !toPin) return;

    const x1 = fromComp.x + fromPin.x;
    const y1 = fromComp.y + fromPin.y;
    const x2 = toComp.x + toPin.x;
    const y2 = toComp.y + toPin.y;

    const isHigh = wire.state === 1;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    const midX = (x1 + x2) / 2;
    ctx.bezierCurveTo(midX, y1, midX, y2, x2, y2);

    ctx.strokeStyle = isHigh ? '#00ff88' : '#334155';
    ctx.lineWidth = isHigh ? 3 : 2;

    if (isHigh) {
      ctx.shadowColor = '#00ff88';
      ctx.shadowBlur = 8;
    } else {
      ctx.shadowBlur = 0;
    }

    ctx.stroke();
    ctx.shadowBlur = 0;
  });
}

function drawTempWire() {
  const fromComp = placedComponents.find((c) => c.instanceId === wiringStartPin.compId);
  if (!fromComp) return;
  const pin = fromComp.pins.find((p) => p.id === wiringStartPin.pinId);
  if (!pin) return;

  const x1 = fromComp.x + pin.x;
  const y1 = fromComp.y + pin.y;
  const x2 = (currentMousePos.x - panOffset.x) / zoomLevel;
  const y2 = (currentMousePos.y - panOffset.y) / zoomLevel;

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  const midX = (x1 + x2) / 2;
  ctx.bezierCurveTo(midX, y1, midX, y2, x2, y2);
  ctx.strokeStyle = '#00e5ff';
  ctx.lineWidth = 2.5;
  ctx.setLineDash([6, 4]);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawComponent(comp) {
  const isSelected = selectedComponent === comp;

  // Box background
  ctx.fillStyle = isSelected ? 'rgba(15, 30, 55, 0.95)' : 'rgba(10, 18, 32, 0.9)';
  ctx.strokeStyle = isSelected ? '#00e5ff' : 'rgba(0, 229, 255, 0.3)';
  ctx.lineWidth = isSelected ? 2 : 1.2;

  if (isSelected) {
    ctx.shadowColor = '#00e5ff';
    ctx.shadowBlur = 10;
  }

  drawRoundedRect(ctx, comp.x, comp.y, comp.w, comp.h, 8);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Header Bar
  ctx.fillStyle = 'rgba(0, 229, 255, 0.08)';
  ctx.fillRect(comp.x, comp.y, comp.w, 18);

  // Component Title & Symbol
  ctx.fillStyle = '#94a3b8';
  ctx.font = '700 10px Rajdhani, sans-serif';
  ctx.fillText(comp.name.slice(0, 14).toUpperCase(), comp.x + 8, comp.y + 13);

  // Body content based on type
  renderComponentBody(comp);

  // Draw Pins
  comp.pins.forEach((pin) => {
    const px = comp.x + pin.x;
    const py = comp.y + pin.y;
    const pinVal = comp.pinStates[pin.id] || 0;
    const isHigh = pinVal === 1;

    // Pin circle
    ctx.beginPath();
    ctx.arc(px, py, 5, 0, Math.PI * 2);
    ctx.fillStyle = isHigh ? '#00ff88' : '#1e293b';
    ctx.strokeStyle = isHigh ? '#00ff88' : '#64748b';
    ctx.lineWidth = 1.5;

    if (isHigh) {
      ctx.shadowColor = '#00ff88';
      ctx.shadowBlur = 6;
    }
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Pin label
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '600 9px "Fira Code", monospace';
    const labelX = pin.type === 'in' ? px + 8 : px - 8;
    ctx.textAlign = pin.type === 'in' ? 'left' : 'right';
    ctx.fillText(pin.label, labelX, py + 3);
    ctx.textAlign = 'left';
  });
}

function renderComponentBody(comp) {
  const cx = comp.x + comp.w / 2;
  const cy = comp.y + comp.h / 2 + 6;

  switch (comp.type) {
    case 'toggle': {
      const isOn = comp.state === 1;
      ctx.fillStyle = isOn ? '#00ff88' : '#334155';
      ctx.beginPath();
      ctx.arc(cx - 6, cy, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = '700 12px "Fira Code", monospace';
      ctx.fillText(isOn ? '1' : '0', cx - 10, cy + 4);
      break;
    }
    case 'push': {
      const isPressed = comp.state === 1;
      ctx.fillStyle = isPressed ? '#ff3366' : '#991b1b';
      ctx.beginPath();
      ctx.arc(cx - 6, cy, 12, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'led': {
      const isOn = (comp.pinStates['in'] || 0) === 1;
      const col = comp.color || '#ff3366';
      ctx.beginPath();
      ctx.arc(cx, cy, 14, 0, Math.PI * 2);
      ctx.fillStyle = isOn ? col : '#1e293b';
      if (isOn) {
        ctx.shadowColor = col;
        ctx.shadowBlur = 18;
      }
      ctx.fill();
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.shadowBlur = 0;
      break;
    }
    case 'seven_segment': {
      draw7Segment(comp.x + 35, comp.y + 25, comp.pinStates);
      break;
    }
    case 'hex_display': {
      const val = ((comp.pinStates['d3'] || 0) << 3) | ((comp.pinStates['d2'] || 0) << 2) | ((comp.pinStates['d1'] || 0) << 1) | (comp.pinStates['d0'] || 0);
      ctx.fillStyle = '#00ff88';
      ctx.font = '700 28px "Fira Code", monospace';
      ctx.fillText(val.toString(16).toUpperCase(), cx - 8, cy + 12);
      break;
    }
    case 'motor': {
      ctx.save();
      ctx.translate(cx + 8, cy);
      ctx.rotate((comp.internal.motorAngle * Math.PI) / 180);
      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, Math.PI * 2);
      ctx.moveTo(-16, 0); ctx.lineTo(16, 0);
      ctx.moveTo(0, -16); ctx.lineTo(0, 16);
      ctx.stroke();
      ctx.restore();
      break;
    }
    case 'probe': {
      const arr = comp.internal.waveform || [];
      ctx.strokeStyle = '#00ff88';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      arr.forEach((v, i) => {
        const px = comp.x + 20 + i * 2;
        const py = comp.y + 45 - (v ? 16 : 0);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
      break;
    }
    default: {
      // Logic Gate Symbol text
      ctx.fillStyle = 'var(--neon-cyan)';
      ctx.font = '700 18px "Fira Code", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(comp.symbol || '', cx, cy + 4);
      ctx.textAlign = 'left';
      break;
    }
  }
}

function draw7Segment(x, y, pins) {
  const segs = {
    a: pins['a'],
    b: pins['b'],
    c: pins['c'],
    d: pins['d'],
    e: pins['e'],
    f: pins['f'],
    g: pins['g'],
  };

  const drawBar = (bx, by, bw, bh, on) => {
    ctx.fillStyle = on ? '#ff3366' : '#1e293b';
    if (on) {
      ctx.shadowColor = '#ff3366';
      ctx.shadowBlur = 6;
    }
    ctx.fillRect(bx, by, bw, bh);
    ctx.shadowBlur = 0;
  };

  drawBar(x + 5, y, 22, 4, segs.a);
  drawBar(x + 27, y + 4, 4, 22, segs.b);
  drawBar(x + 27, y + 30, 4, 22, segs.c);
  drawBar(x + 5, y + 52, 22, 4, segs.d);
  drawBar(x + 1, y + 30, 4, 22, segs.e);
  drawBar(x + 1, y + 4, 4, 22, segs.f);
  drawBar(x + 5, y + 26, 22, 4, segs.g);
}

function drawRoundedRect(c, x, y, width, height, radius) {
  c.beginPath();
  c.moveTo(x + radius, y);
  c.lineTo(x + width - radius, y);
  c.quadraticCurveTo(x + width, y, x + width, y + radius);
  c.lineTo(x + width, y + height - radius);
  c.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  c.lineTo(x + radius, y + height);
  c.quadraticCurveTo(x, y + height, x, y + height - radius);
  c.lineTo(x, y + radius);
  c.quadraticCurveTo(x, y, x + radius, y);
  c.closePath();
}

// ─── INTERACTION & EVENT LISTENERS ───
canvas.addEventListener('mousedown', (e) => {
  const rect = canvas.getBoundingClientRect();
  const mouseX = (e.clientX - rect.left - panOffset.x) / zoomLevel;
  const mouseY = (e.clientY - rect.top - panOffset.y) / zoomLevel;

  if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
    // Pan mode
    isPanning = true;
    startPan = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
    return;
  }

  // Check pin clicks for wiring
  for (let i = placedComponents.length - 1; i >= 0; i--) {
    const comp = placedComponents[i];
    for (const pin of comp.pins) {
      const px = comp.x + pin.x;
      const py = comp.y + pin.y;
      const dist = Math.hypot(mouseX - px, mouseY - py);
      if (dist <= 10) {
        if (!wiringStartPin) {
          wiringStartPin = { compId: comp.instanceId, pinId: pin.id, pinType: pin.type };
        } else {
          // Connect wires if different pin types (one in, one out)
          if (wiringStartPin.compId !== comp.instanceId && wiringStartPin.pinType !== pin.type) {
            const outPin = wiringStartPin.pinType === 'out' ? wiringStartPin : { compId: comp.instanceId, pinId: pin.id };
            const inPin = wiringStartPin.pinType === 'in' ? wiringStartPin : { compId: comp.instanceId, pinId: pin.id };

            // Remove any existing wire to the input pin (single driver rule)
            wires = wires.filter((w) => !(w.toCompId === inPin.compId && w.toPinId === inPin.pinId));

            wires.push({
              wireId: nextWireId++,
              fromCompId: outPin.compId,
              fromPinId: outPin.pinId,
              toCompId: inPin.compId,
              toPinId: inPin.pinId,
              state: 0,
            });

            showToast('Connected wire', 'info', 1000);
            updateHud();
          }
          wiringStartPin = null;
        }
        return;
      }
    }
  }

  // Check interactive component clicks (e.g. toggle switches / push buttons)
  for (let i = placedComponents.length - 1; i >= 0; i--) {
    const comp = placedComponents[i];
    if (mouseX >= comp.x && mouseX <= comp.x + comp.w && mouseY >= comp.y && mouseY <= comp.y + comp.h) {
      selectedComponent = comp;
      draggingComponent = comp;
      dragOffset = { x: mouseX - comp.x, y: mouseY - comp.y };

      if (comp.type === 'toggle') {
        comp.state = comp.state === 1 ? 0 : 1;
      } else if (comp.type === 'push') {
        comp.state = 1;
      }
      return;
    }
  }

  selectedComponent = null;
  wiringStartPin = null;
});

canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  currentMousePos = { x: e.clientX - rect.left, y: e.clientY - rect.top };

  if (isPanning) {
    panOffset.x = e.clientX - startPan.x;
    panOffset.y = e.clientY - startPan.y;
    return;
  }

  if (draggingComponent) {
    const mouseX = (currentMousePos.x - panOffset.x) / zoomLevel;
    const mouseY = (currentMousePos.y - panOffset.y) / zoomLevel;
    draggingComponent.x = Math.round((mouseX - dragOffset.x) / 10) * 10;
    draggingComponent.y = Math.round((mouseY - dragOffset.y) / 10) * 10;
  }
});

window.addEventListener('mouseup', () => {
  if (draggingComponent && draggingComponent.type === 'push') {
    draggingComponent.state = 0;
  }
  draggingComponent = null;
  isPanning = false;
});

// Right click context to delete wire or component
canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const mouseX = (e.clientX - rect.left - panOffset.x) / zoomLevel;
  const mouseY = (e.clientY - rect.top - panOffset.y) / zoomLevel;

  // Check component deletion
  for (let i = placedComponents.length - 1; i >= 0; i--) {
    const comp = placedComponents[i];
    if (mouseX >= comp.x && mouseX <= comp.x + comp.w && mouseY >= comp.y && mouseY <= comp.y + comp.h) {
      deleteComponent(comp.instanceId);
      return;
    }
  }

  // Check wire deletion
  for (let i = wires.length - 1; i >= 0; i--) {
    const wire = wires[i];
    const fromComp = placedComponents.find((c) => c.instanceId === wire.fromCompId);
    const toComp = placedComponents.find((c) => c.instanceId === wire.toCompId);
    if (!fromComp || !toComp) continue;
    const fromPin = fromComp.pins.find((p) => p.id === wire.fromPinId);
    const toPin = toComp.pins.find((p) => p.id === wire.toPinId);
    if (!fromPin || !toPin) continue;

    const midX = (fromComp.x + fromPin.x + toComp.x + toPin.x) / 2;
    const midY = (fromComp.y + fromPin.y + toComp.y + toPin.y) / 2;
    if (Math.hypot(mouseX - midX, mouseY - midY) <= 18) {
      wires.splice(i, 1);
      showToast('Deleted wire', 'info', 1000);
      updateHud();
      return;
    }
  }
});

// Zoom with mouse wheel
canvasWrap.addEventListener('wheel', (e) => {
  e.preventDefault();
  const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
  const newZoom = Math.min(2.5, Math.max(0.4, zoomLevel * zoomFactor));
  zoomLevel = Number(newZoom.toFixed(2));
  document.getElementById('hudZoomVal').textContent = `${Math.round(zoomLevel * 100)}%`;
}, { passive: false });

// Keyboard delete
window.addEventListener('keydown', (e) => {
  if ((e.key === 'Delete' || e.key === 'Backspace') && selectedComponent) {
    deleteComponent(selectedComponent.instanceId);
  }
});

function deleteComponent(instanceId) {
  placedComponents = placedComponents.filter((c) => c.instanceId !== instanceId);
  wires = wires.filter((w) => w.fromCompId !== instanceId && w.toCompId !== instanceId);
  selectedComponent = null;
  renderComponentDrawer();
  updateHud();
  showToast('Removed component', 'info', 1000);
}

// ─── TOOLBAR ACTIONS ───
function toggleSim() {
  isRunning = !isRunning;
  const icon = document.getElementById('playIcon');
  const text = document.getElementById('playText');
  const btn = document.getElementById('btnPlayPause');
  const status = document.getElementById('hudEngineStatus');

  if (isRunning) {
    icon.textContent = '⏸️';
    text.textContent = 'PAUSE';
    btn.classList.remove('active');
    status.textContent = '60Hz RUNNING';
  } else {
    icon.textContent = '▶️';
    text.textContent = 'RUN';
    btn.classList.add('active');
    status.textContent = 'PAUSED';
  }
}

function stepSim() {
  evaluateCircuit();
  showToast('Single cycle stepped', 'info', 800);
}

function resetStates() {
  placedComponents.forEach((c) => {
    c.state = c.defaultState !== undefined ? c.defaultState : 0;
    c.internal = { prevClk: 0, q: 0, counterVal: 0, motorAngle: 0, waveform: [] };
  });
  wires.forEach((w) => { w.state = 0; });
  showToast('Circuit states reset to 0', 'info', 1000);
}

function clearCanvasPrompt() {
  if (confirm('Clear all components and wires from the canvas?')) {
    placedComponents = [];
    wires = [];
    selectedComponent = null;
    wiringStartPin = null;
    renderComponentDrawer();
    updateHud();
    showToast('Canvas cleared', 'info', 1200);
  }
}

function exportCircuit() {
  const data = {
    version: 1,
    savedAt: Date.now(),
    components: placedComponents,
    wires: wires,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `logic_circuit_${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Circuit exported as JSON', 'info');
}

function loadCircuit(input) {
  const file = input.files && input.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (Array.isArray(data.components) && Array.isArray(data.wires)) {
        placedComponents = data.components;
        wires = data.wires;
        nextCompId = Math.max(...placedComponents.map((c) => c.instanceId), 0) + 1;
        nextWireId = Math.max(...wires.map((w) => w.wireId), 0) + 1;
        renderComponentDrawer();
        updateHud();
        showToast('Circuit loaded successfully!', 'info');
      } else {
        showToast('Invalid circuit file format', 'error');
      }
    } catch (err) {
      showToast('Failed to parse circuit file', 'error');
    }
  };
  reader.readAsText(file);
}

function updateHud() {
  document.getElementById('hudComponentsCount').textContent = placedComponents.length;
  document.getElementById('hudWiresCount').textContent = wires.length;
}

let toastTimer;
function showToast(msg, type = 'info', duration = 2500) {
  const toast = document.getElementById('simToast');
  if (!toast) return;
  toast.textContent = msg;
  toast.className = 'sim-toast show';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.className = 'sim-toast';
  }, duration);
}

// Start simulation loop
requestAnimationFrame(render);
