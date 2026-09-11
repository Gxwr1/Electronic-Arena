const fs = require('fs');
const path = require('path');

const rawComponents = [
  // 1. INPUT COMPONENTS (8)
  { id: 1, name: "Input", symbolName: "Input terminal", symbol: "→", role: "Input", country: "Digital Input", basePrice: 4, description: "Provides an external 0 or 1 signal to the circuit", isCapped: false },
  { id: 2, name: "Button (Red)", symbolName: "Push-button switch", symbol: "—[SW]—", role: "Input", country: "Mechanical Switch", basePrice: 6, description: "Produces a signal when the button is pressed", isCapped: false },
  { id: 3, name: "Power (+V)", symbolName: "VCC / Power terminal", symbol: "+V", role: "Input", country: "Power Supply", basePrice: 8, description: "Supplies logic HIGH / positive voltage", isCapped: true },
  { id: 4, name: "Constant Value", symbolName: "Logic constant", symbol: "1", role: "Input", country: "Constant Source", basePrice: 5, description: "Permanently provides a logic HIGH (1)", isCapped: false },
  { id: 5, name: "Ground", symbolName: "GND terminal", symbol: "⏚", role: "Input", country: "Reference / Ground", basePrice: 3, description: "Circuit reference / logic LOW (0) and electrical ground", isCapped: false },
  { id: 6, name: "Stepper Motor", symbolName: "Stepper motor", symbol: "M", role: "Input", country: "Electromechanical", basePrice: 15, description: "Rotates by controlled discrete steps based on input pulses", isCapped: true },
  { id: 7, name: "Counter", symbolName: "Digital counter", symbol: "CTR", role: "Input", country: "Sequential Logic", basePrice: 12, description: "Counts incoming clock pulses and produces a binary output", isCapped: true },
  { id: 8, name: "Random", symbolName: "Random signal generator", symbol: "⚄", role: "Input", country: "Stochastic Signal", basePrice: 10, description: "Generates a random value/signal", isCapped: false },

  // 2. OUTPUT COMPONENTS (7)
  { id: 9, name: "RGB Light", symbolName: "RGB LED / RGB lamp", symbol: "RGB", role: "Output", country: "Visual Display", basePrice: 10, description: "Produces different colors by combining Red, Green and Blue", isCapped: false },
  { id: 10, name: "LED Light", symbolName: "LED", symbol: "▷|", role: "Output", country: "Visual Indicator", basePrice: 4, description: "Emits light when current flows through it", isCapped: false },
  { id: 11, name: "Variable LED", symbolName: "Variable / adjustable LED", symbol: "LED ↗", role: "Output", country: "Analog Visual", basePrice: 7, description: "LED whose brightness can be controlled", isCapped: false },
  { id: 12, name: "Hex Display", symbolName: "Hexadecimal display", symbol: "HEX", role: "Output", country: "Digital Display", basePrice: 15, description: "Displays hexadecimal values 0–F", isCapped: true },
  { id: 13, name: "Seven Segment Display", symbolName: "7-segment display", symbol: "7-SEG", role: "Output", country: "Numeric Display", basePrice: 8, description: "Uses seven segments to display digits and some letters", isCapped: false },
  { id: 14, name: "Sixteen Segment Display", symbolName: "16-segment display", symbol: "16-SEG", role: "Output", country: "Alphanumeric Display", basePrice: 12, description: "Uses sixteen segments to display a wider range of characters", isCapped: true },
  { id: 15, name: "RGB LED Matrix (5×5)", symbolName: "RGB LED matrix", symbol: "5×5 RGB", role: "Output", country: "Matrix Display", basePrice: 20, description: "25 RGB LEDs arranged as a matrix; each LED can display colors", isCapped: true },

  // 3. LOGIC GATES (7)
  { id: 16, name: "AND Gate", symbolName: "AND logic gate", symbol: "D-shaped +", role: "Logic Gates", country: "Combinational Logic", basePrice: 2, description: "Output = 1 only when ALL inputs are 1", isCapped: false },
  { id: 17, name: "OR Gate", symbolName: "OR logic gate", symbol: "Curved OR shape", role: "Logic Gates", country: "Combinational Logic", basePrice: 2, description: "Output = 1 when ANY input is 1", isCapped: false },
  { id: 18, name: "XOR Gate", symbolName: "Exclusive-OR", symbol: "OR + extra curved line", role: "Logic Gates", country: "Combinational Logic", basePrice: 3, description: "Output = 1 when inputs are DIFFERENT", isCapped: false },
  { id: 19, name: "NAND Gate", symbolName: "NOT-AND", symbol: "AND + ○", role: "Logic Gates", country: "Universal Gate", basePrice: 3, description: "Inverted AND; output = 0 only when all inputs are 1", isCapped: false },
  { id: 20, name: "NOR Gate", symbolName: "NOT-OR", symbol: "OR + ○", role: "Logic Gates", country: "Universal Gate", basePrice: 3, description: "Inverted OR; output = 1 only when all inputs are 0", isCapped: false },
  { id: 21, name: "XNOR Gate", symbolName: "Exclusive-NOR", symbol: "XOR + ○", role: "Logic Gates", country: "Equivalence Gate", basePrice: 4, description: "Output = 1 when inputs are the SAME", isCapped: false },
  { id: 22, name: "NOT Gate", symbolName: "Inverter", symbol: "▷○", role: "Logic Gates", country: "Logic Inverter", basePrice: 2, description: "Reverses the signal: 0 → 1, 1 → 0", isCapped: false },

  // 4. DECODERS / DATA SELECTORS (6)
  { id: 23, name: "Multiplexer (2:1)", symbolName: "MUX / Data Selector", symbol: "MUX", role: "Decoders / Data Selectors", country: "Data Routing", basePrice: 12, description: "Selects 1 of 2 inputs and sends it to one output", isCapped: true },
  { id: 24, name: "Demultiplexer (1:2)", symbolName: "DEMUX / Data Distributor", symbol: "DEMUX", role: "Decoders / Data Selectors", country: "Data Distribution", basePrice: 12, description: "Takes 1 input and sends it to 1 of 2 outputs", isCapped: true },
  { id: 25, name: "Bit Selector", symbolName: "Bit selector", symbol: "SEL", role: "Decoders / Data Selectors", country: "Bit Level Selection", basePrice: 8, description: "Selects a particular bit/data line", isCapped: false },
  { id: 26, name: "MSB / LSB Indicator", symbolName: "Bit significance indicator", symbol: "MSB / LSB", role: "Decoders / Data Selectors", country: "Bit Significance", basePrice: 3, description: "Identifies the Most Significant Bit and Least Significant Bit", isCapped: false },
  { id: 27, name: "Priority Encoder (4:2)", symbolName: "Priority encoder", symbol: "PRI ENC", role: "Decoders / Data Selectors", country: "Binary Encoding", basePrice: 10, description: "Converts 4 inputs into a 2-bit binary code, prioritizing highest-priority active input", isCapped: false },
  { id: 28, name: "Decoder (2:4)", symbolName: "2-to-4 decoder", symbol: "DEC", role: "Decoders / Data Selectors", country: "Binary Decoding", basePrice: 8, description: "Converts 2 binary input bits into 4 possible outputs", isCapped: false },

  // 5. SEQUENTIAL ELEMENTS (9)
  { id: 29, name: "D Flip-Flop", symbolName: "D-type flip-flop", symbol: "D → Q", role: "Sequential Elements", country: "Edge-Triggered", basePrice: 15, description: "Stores 1 bit; Q follows D on the active clock edge", isCapped: true },
  { id: 30, name: "D Latch", symbolName: "D-type latch", symbol: "D + EN → Q", role: "Sequential Elements", country: "Level-Sensitive", basePrice: 12, description: "Stores data while controlled by an Enable signal", isCapped: true },
  { id: 31, name: "T Flip-Flop", symbolName: "Toggle flip-flop", symbol: "T → Q", role: "Sequential Elements", country: "Edge-Triggered", basePrice: 15, description: "Toggles output when T is active and a clock edge occurs", isCapped: true },
  { id: 32, name: "JK Flip-Flop", symbolName: "JK flip-flop", symbol: "J,K → Q", role: "Sequential Elements", country: "Universal Flip-Flop", basePrice: 18, description: "Versatile flip-flop; J=K=1 toggles the output", isCapped: true },
  { id: 33, name: "SR Flip-Flop", symbolName: "Set-Reset flip-flop", symbol: "S,R → Q", role: "Sequential Elements", country: "Bistable Multivibrator", basePrice: 15, description: "S sets Q=1 and R resets Q=0", isCapped: true },
  { id: 34, name: "SR Latch", symbolName: "Set-Reset latch", symbol: "S,R → Q", role: "Sequential Elements", country: "Asynchronous Latch", basePrice: 10, description: "Basic memory element controlled by Set and Reset", isCapped: false },
  { id: 35, name: "Keyboard (4×4)", symbolName: "4×4 keypad matrix", symbol: "4×4", role: "Sequential Elements", country: "Matrix Input", basePrice: 12, description: "Provides 16 button/key inputs", isCapped: true },
  { id: 36, name: "Clock", symbolName: "Clock generator", symbol: "CLK", role: "Sequential Elements", country: "Oscillator Source", basePrice: 6, description: "Produces periodic pulses used to synchronize sequential circuits", isCapped: false },
  { id: 37, name: "ROM (8×8)", symbolName: "Read-Only Memory", symbol: "ROM", role: "Sequential Elements", country: "Non-Volatile Memory", basePrice: 18, description: "Stores predefined data; 8×8 = 64 memory locations/bits", isCapped: true },

  // 6. ANNOTATION (4)
  { id: 38, name: "Rectangle", symbolName: "Rectangle annotation", symbol: "□", role: "Annotation", country: "Schematic Markup", basePrice: 2, description: "Draws a rectangular annotation box", isCapped: false },
  { id: 39, name: "Arrow", symbolName: "Arrow annotation", symbol: "→", role: "Annotation", country: "Directional Vector", basePrice: 2, description: "Shows direction or points to a circuit element", isCapped: false },
  { id: 40, name: "Image Annotation", symbolName: "Image object", symbol: "🖼", role: "Annotation", country: "Graphic Object", basePrice: 3, description: "Places an image into the circuit diagram", isCapped: false },
  { id: 41, name: "Text", symbolName: "Text annotation", symbol: "T", role: "Annotation", country: "Label / Comment", basePrice: 2, description: "Adds text/labels to the circuit", isCapped: false },

  // 7. MISC COMPONENTS (12)
  { id: 42, name: "Two's Complement", symbolName: "2's complement block", symbol: "2's COMP", role: "Misc Components", country: "Arithmetic Logic", basePrice: 6, description: "Performs/treats a binary value using two's-complement representation", isCapped: false },
  { id: 43, name: "Flag", symbolName: "Flag indicator", symbol: "⚑", role: "Misc Components", country: "Status Register", basePrice: 2, description: "Indicates a particular condition/status in the circuit", isCapped: false },
  { id: 44, name: "Splitter", symbolName: "Signal splitter", symbol: "1 → 2+", role: "Misc Components", country: "Bus / Routing", basePrice: 3, description: "Splits one signal into multiple signal paths", isCapped: false },
  { id: 45, name: "Adder", symbolName: "Binary adder", symbol: "+", role: "Misc Components", country: "Arithmetic Unit", basePrice: 10, description: "Adds binary values", isCapped: false },
  { id: 46, name: "ALU", symbolName: "Arithmetic Logic Unit", symbol: "ALU", role: "Misc Components", country: "Processor Core", basePrice: 25, description: "Performs arithmetic and logical operations", isCapped: true },
  { id: 47, name: "Tristate Flip-Flop", symbolName: "Tri-state buffer/driver", symbol: "▷ + EN", role: "Misc Components", country: "Bus Driver", basePrice: 14, description: "Output can be 0, 1, or high-impedance (Z) depending on enable", isCapped: true },
  { id: 48, name: "Tunnel", symbolName: "Tunnel connection", symbol: "○", role: "Misc Components", country: "Net Label", basePrice: 4, description: "Connects signals without drawing a physical wire between locations", isCapped: false },
  { id: 49, name: "Buffer", symbolName: "Logic buffer", symbol: "▷", role: "Misc Components", country: "Signal Conditioning", basePrice: 3, description: "Passes the input to output without changing its logic value", isCapped: false },
  { id: 50, name: "Controller Inverter", symbolName: "Inverting controller", symbol: "▷○", role: "Misc Components", country: "Control Logic", basePrice: 4, description: "Produces the inverted version of the input/control signal", isCapped: false },
  { id: 51, name: "Test Bench Input", symbolName: "Test input", symbol: "▰", role: "Misc Components", country: "Test & Verification", basePrice: 5, description: "Provides a test signal to the circuit", isCapped: false },
  { id: 52, name: "Test Bench Output", symbolName: "Test output", symbol: "▰", role: "Misc Components", country: "Test & Verification", basePrice: 5, description: "Monitors/displays a circuit output during testing", isCapped: false },
  { id: 53, name: "Force Gate", symbolName: "Force gate", symbol: "F", role: "Misc Components", country: "Signal Override", basePrice: 9, description: "Forces/overrides a signal according to the gate's control behavior", isCapped: false }
];

const components = rawComponents.map(c => ({
  ...c,
  specs: `${c.symbolName} [Symbol: ${c.symbol}] • ${c.description}`,
  image: `/images/comp_${c.id}.svg`
}));

// Function to generate clean vector schematic SVGs for each logic component
function generateComponentSvg(c) {
  const roleColors = {
    'Input': '#00e5ff',
    'Output': '#00ff88',
    'Logic Gates': '#ffb700',
    'Decoders / Data Selectors': '#a855f7',
    'Sequential Elements': '#ff3366',
    'Annotation': '#94a3b8',
    'Misc Components': '#38bdf8'
  };

  const accentColor = roleColors[c.role] || '#00e5ff';
  const cleanSymbol = c.symbol.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const cleanName = c.name.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const cleanSymbolName = c.symbolName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="420" viewBox="0 0 360 420">
  <defs>
    <linearGradient id="bgGlow" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#141c2e"/>
      <stop offset="100%" stop-color="#090d16"/>
    </linearGradient>
    <linearGradient id="accentGlow" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${accentColor}"/>
      <stop offset="100%" stop-color="#ffffff"/>
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="6" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <!-- Outer Card Frame -->
  <rect x="2" y="2" width="356" height="416" rx="16" fill="url(#bgGlow)" stroke="${accentColor}" stroke-width="2" stroke-opacity="0.6"/>
  <rect x="10" y="10" width="340" height="400" rx="10" fill="none" stroke="#ffffff" stroke-width="0.5" stroke-opacity="0.1"/>

  <!-- Header Category Badge -->
  <rect x="24" y="20" width="312" height="30" rx="6" fill="${accentColor}" fill-opacity="0.12" stroke="${accentColor}" stroke-width="1" stroke-opacity="0.4"/>
  <text x="180" y="40" text-anchor="middle" fill="${accentColor}" font-family="'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="bold" letter-spacing="1.5">
    ${c.role.toUpperCase()} • BASE: ${c.basePrice} PTS
  </text>

  <!-- Center Schematic Symbol Display Area -->
  <rect x="30" y="65" width="300" height="210" rx="12" fill="#060910" stroke="${accentColor}" stroke-width="1" stroke-opacity="0.3"/>
  
  <!-- Subtle Grid lines in schematic display -->
  <line x1="30" y1="170" x2="330" y2="170" stroke="#ffffff" stroke-width="0.5" stroke-opacity="0.08" stroke-dasharray="4 4"/>
  <line x1="180" y1="65" x2="180" y2="275" stroke="#ffffff" stroke-width="0.5" stroke-opacity="0.08" stroke-dasharray="4 4"/>

  <!-- Symbol Graphic -->
  <circle cx="180" cy="170" r="64" fill="${accentColor}" fill-opacity="0.05" stroke="${accentColor}" stroke-width="1.5" stroke-opacity="0.3"/>
  <text x="180" y="182" text-anchor="middle" fill="#ffffff" font-family="'Courier New', monospace, sans-serif" font-size="34" font-weight="900" filter="url(#glow)">
    ${cleanSymbol}
  </text>

  <!-- Component Name & Symbol Name Tag -->
  <text x="180" y="315" text-anchor="middle" fill="#ffffff" font-family="'Segoe UI', Roboto, sans-serif" font-size="20" font-weight="bold">
    ${cleanName}
  </text>
  <text x="180" y="340" text-anchor="middle" fill="${accentColor}" font-family="'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="600">
    Symbol: ${cleanSymbolName}
  </text>

  <!-- Footer ID & Specs pill -->
  <rect x="40" y="365" width="280" height="32" rx="8" fill="#121a2c" stroke="#ffffff" stroke-width="0.5" stroke-opacity="0.15"/>
  <text x="180" y="386" text-anchor="middle" fill="#94a3b8" font-family="'Segoe UI', Roboto, sans-serif" font-size="11">
    Logic Symbol ID #${c.id} • ${c.country}
  </text>
</svg>`;
}

const storageDir = path.join(__dirname, 'storage', 'images');
const publicDir = path.join(__dirname, 'public', 'images');

if (!fs.existsSync(storageDir)) fs.mkdirSync(storageDir, { recursive: true });
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

components.forEach(c => {
  const svg = generateComponentSvg(c);
  fs.writeFileSync(path.join(storageDir, `comp_${c.id}.svg`), svg, 'utf8');
  fs.writeFileSync(path.join(publicDir, `comp_${c.id}.svg`), svg, 'utf8');
});

const playersFileContent = `const players = ${JSON.stringify(components, null, 2)};\n\nmodule.exports = players;\n`;
fs.writeFileSync(path.join(__dirname, 'data', 'players.js'), playersFileContent, 'utf8');

console.log(`Successfully generated ${components.length} logic circuit components and SVG symbols!`);
