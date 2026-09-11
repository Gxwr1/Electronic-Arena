import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

const ADMIN_PASSWORD = "aiml";
const INITIAL_BUDGET = 500;
const BID_TIMER_SECONDS = 15;

const DEFAULT_COMPONENTS = [
  { id: 1, name: "Input", symbolName: "Input terminal", symbol: "→", role: "Input", country: "Digital Input", basePrice: 4, description: "Provides an external 0 or 1 signal to the circuit", isCapped: false, image: "/images/comp_1.svg" },
  { id: 2, name: "Button (Red)", symbolName: "Push-button switch", symbol: "—[SW]—", role: "Input", country: "Mechanical Switch", basePrice: 6, description: "Produces a signal when the button is pressed", isCapped: false, image: "/images/comp_2.svg" },
  { id: 3, name: "Power (+V)", symbolName: "VCC / Power terminal", symbol: "+V", role: "Input", country: "Power Supply", basePrice: 8, description: "Supplies logic HIGH / positive voltage", isCapped: true, image: "/images/comp_3.svg" },
  { id: 4, name: "Constant Value", symbolName: "Logic constant", symbol: "1", role: "Input", country: "Constant Source", basePrice: 5, description: "Permanently provides a logic HIGH (1)", isCapped: false, image: "/images/comp_4.svg" },
  { id: 5, name: "Ground", symbolName: "GND terminal", symbol: "⏚", role: "Input", country: "Reference / Ground", basePrice: 3, description: "Circuit reference / logic LOW (0) and electrical ground", isCapped: false, image: "/images/comp_5.svg" },
  { id: 6, name: "Stepper Motor", symbolName: "Stepper motor", symbol: "M", role: "Input", country: "Electromechanical", basePrice: 15, description: "Rotates by controlled discrete steps based on input pulses", isCapped: true, image: "/images/comp_6.svg" },
  { id: 7, name: "Counter", symbolName: "Digital counter", symbol: "CTR", role: "Input", country: "Sequential Logic", basePrice: 12, description: "Counts incoming clock pulses and produces a binary output", isCapped: true, image: "/images/comp_7.svg" },
  { id: 8, name: "Random", symbolName: "Random signal generator", symbol: "⚄", role: "Input", country: "Stochastic Signal", basePrice: 10, description: "Generates a random value/signal", isCapped: false, image: "/images/comp_8.svg" },
  { id: 9, name: "RGB Light", symbolName: "RGB LED / RGB lamp", symbol: "RGB", role: "Output", country: "Visual Display", basePrice: 10, description: "Produces different colors by combining Red, Green and Blue", isCapped: false, image: "/images/comp_9.svg" },
  { id: 10, name: "LED Light", symbolName: "LED", symbol: "▷|", role: "Output", country: "Visual Indicator", basePrice: 4, description: "Emits light when current flows through it", isCapped: false, image: "/images/comp_10.svg" },
  { id: 11, name: "Variable LED", symbolName: "Variable / adjustable LED", symbol: "LED ↗", role: "Output", country: "Analog Visual", basePrice: 7, description: "LED whose brightness can be controlled", isCapped: false, image: "/images/comp_11.svg" },
  { id: 12, name: "Hex Display", symbolName: "Hexadecimal display", symbol: "HEX", role: "Output", country: "Digital Display", basePrice: 15, description: "Displays hexadecimal values 0–F", isCapped: true, image: "/images/comp_12.svg" },
  { id: 13, name: "Seven Segment Display", symbolName: "7-segment display", symbol: "7-SEG", role: "Output", country: "Numeric Display", basePrice: 8, description: "Uses seven segments to display digits and some letters", isCapped: false, image: "/images/comp_13.svg" },
  { id: 14, name: "Sixteen Segment Display", symbolName: "16-segment display", symbol: "16-SEG", role: "Output", country: "Alphanumeric Display", basePrice: 12, description: "Uses sixteen segments to display a wider range of characters", isCapped: true, image: "/images/comp_14.svg" },
  { id: 15, name: "RGB LED Matrix (5×5)", symbolName: "RGB LED matrix", symbol: "5×5 RGB", role: "Output", country: "Matrix Display", basePrice: 20, description: "25 RGB LEDs arranged as a matrix", isCapped: true, image: "/images/comp_15.svg" },
  { id: 16, name: "AND Gate", symbolName: "AND logic gate", symbol: "D-shaped +", role: "Logic Gates", country: "Combinational Logic", basePrice: 2, description: "Output = 1 only when ALL inputs are 1", isCapped: false, image: "/images/comp_16.svg" },
  { id: 17, name: "OR Gate", symbolName: "OR logic gate", symbol: "Curved OR shape", role: "Logic Gates", country: "Combinational Logic", basePrice: 2, description: "Output = 1 when ANY input is 1", isCapped: false, image: "/images/comp_17.svg" },
  { id: 18, name: "XOR Gate", symbolName: "Exclusive-OR", symbol: "OR + extra curved line", role: "Logic Gates", country: "Combinational Logic", basePrice: 3, description: "Output = 1 when inputs are DIFFERENT", isCapped: false, image: "/images/comp_18.svg" },
  { id: 19, name: "NAND Gate", symbolName: "NOT-AND", symbol: "AND + ○", role: "Logic Gates", country: "Universal Gate", basePrice: 3, description: "Inverted AND; output = 0 only when all inputs are 1", isCapped: false, image: "/images/comp_19.svg" },
  { id: 20, name: "NOR Gate", symbolName: "NOT-OR", symbol: "OR + ○", role: "Logic Gates", country: "Universal Gate", basePrice: 3, description: "Inverted OR; output = 1 only when all inputs are 0", isCapped: false, image: "/images/comp_20.svg" },
  { id: 21, name: "XNOR Gate", symbolName: "Exclusive-NOR", symbol: "XOR + ○", role: "Logic Gates", country: "Equivalence Gate", basePrice: 4, description: "Output = 1 when inputs are the SAME", isCapped: false, image: "/images/comp_21.svg" },
  { id: 22, name: "NOT Gate", symbolName: "Inverter", symbol: "▷○", role: "Logic Gates", country: "Logic Inverter", basePrice: 2, description: "Reverses the signal: 0 → 1, 1 → 0", isCapped: false, image: "/images/comp_22.svg" },
  { id: 23, name: "Multiplexer (2:1)", symbolName: "MUX / Data Selector", symbol: "MUX", role: "Decoders / Data Selectors", country: "Data Routing", basePrice: 12, description: "Selects 1 of 2 inputs and sends it to one output", isCapped: true, image: "/images/comp_23.svg" },
  { id: 24, name: "Demultiplexer (1:2)", symbolName: "DEMUX / Data Distributor", symbol: "DEMUX", role: "Decoders / Data Selectors", country: "Data Distribution", basePrice: 12, description: "Takes 1 input and sends it to 1 of 2 outputs", isCapped: true, image: "/images/comp_24.svg" },
  { id: 25, name: "Bit Selector", symbolName: "Bit selector", symbol: "SEL", role: "Decoders / Data Selectors", country: "Bit Level Selection", basePrice: 8, description: "Selects a particular bit/data line", isCapped: false, image: "/images/comp_25.svg" },
  { id: 26, name: "MSB / LSB Indicator", symbolName: "Bit significance indicator", symbol: "MSB / LSB", role: "Decoders / Data Selectors", country: "Bit Significance", basePrice: 3, description: "Identifies the Most Significant Bit and Least Significant Bit", isCapped: false, image: "/images/comp_26.svg" },
  { id: 27, name: "Priority Encoder (4:2)", symbolName: "Priority encoder", symbol: "PRI ENC", role: "Decoders / Data Selectors", country: "Binary Encoding", basePrice: 10, description: "Converts 4 inputs into a 2-bit binary code", isCapped: false, image: "/images/comp_27.svg" },
  { id: 28, name: "Decoder (2:4)", symbolName: "2-to-4 decoder", symbol: "DEC", role: "Decoders / Data Selectors", country: "Binary Decoding", basePrice: 8, description: "Converts 2 binary input bits into 4 outputs", isCapped: false, image: "/images/comp_28.svg" },
  { id: 29, name: "D Flip-Flop", symbolName: "D-type flip-flop", symbol: "D → Q", role: "Sequential Elements", country: "Edge-Triggered", basePrice: 15, description: "Stores 1 bit; Q follows D on clock edge", isCapped: true, image: "/images/comp_29.svg" },
  { id: 30, name: "D Latch", symbolName: "D-type latch", symbol: "D + EN → Q", role: "Sequential Elements", country: "Level-Sensitive", basePrice: 12, description: "Stores data while controlled by Enable", isCapped: true, image: "/images/comp_30.svg" },
  { id: 31, name: "T Flip-Flop", symbolName: "Toggle flip-flop", symbol: "T → Q", role: "Sequential Elements", country: "Edge-Triggered", basePrice: 15, description: "Toggles output when T is active", isCapped: true, image: "/images/comp_31.svg" },
  { id: 32, name: "JK Flip-Flop", symbolName: "JK flip-flop", symbol: "J,K → Q", role: "Sequential Elements", country: "Universal Flip-Flop", basePrice: 18, description: "Versatile flip-flop; J=K=1 toggles output", isCapped: true, image: "/images/comp_32.svg" },
  { id: 33, name: "SR Flip-Flop", symbolName: "Set-Reset flip-flop", symbol: "S,R → Q", role: "Sequential Elements", country: "Bistable Multivibrator", basePrice: 15, description: "S sets Q=1 and R resets Q=0", isCapped: true, image: "/images/comp_33.svg" },
  { id: 34, name: "SR Latch", symbolName: "Set-Reset latch", symbol: "S,R → Q", role: "Sequential Elements", country: "Asynchronous Latch", basePrice: 10, description: "Basic memory element controlled by Set and Reset", isCapped: false, image: "/images/comp_34.svg" },
  { id: 35, name: "Keyboard (4×4)", symbolName: "4×4 keypad matrix", symbol: "4×4", role: "Sequential Elements", country: "Matrix Input", basePrice: 12, description: "Provides 16 button/key inputs", isCapped: true, image: "/images/comp_35.svg" },
  { id: 36, name: "Clock", symbolName: "Clock generator", symbol: "CLK", role: "Sequential Elements", country: "Oscillator Source", basePrice: 6, description: "Produces periodic synchronization pulses", isCapped: false, image: "/images/comp_36.svg" },
  { id: 37, name: "ROM (8×8)", symbolName: "Read-Only Memory", symbol: "ROM", role: "Sequential Elements", country: "Non-Volatile Memory", basePrice: 18, description: "Stores predefined data; 64 memory locations", isCapped: true, image: "/images/comp_37.svg" },
  { id: 38, name: "Rectangle", symbolName: "Rectangle annotation", symbol: "□", role: "Annotation", country: "Schematic Markup", basePrice: 2, description: "Draws a rectangular annotation box", isCapped: false, image: "/images/comp_38.svg" },
  { id: 39, name: "Arrow", symbolName: "Arrow annotation", symbol: "→", role: "Annotation", country: "Directional Vector", basePrice: 2, description: "Shows direction or points to element", isCapped: false, image: "/images/comp_39.svg" },
  { id: 40, name: "Image Annotation", symbolName: "Image object", symbol: "🖼", role: "Annotation", country: "Graphic Object", basePrice: 3, description: "Places an image into diagram", isCapped: false, image: "/images/comp_40.svg" },
  { id: 41, name: "Text", symbolName: "Text annotation", symbol: "T", role: "Annotation", country: "Label / Comment", basePrice: 2, description: "Adds text/labels to circuit", isCapped: false, image: "/images/comp_41.svg" },
  { id: 42, name: "Two's Complement", symbolName: "2's complement block", symbol: "2's COMP", role: "Misc Components", country: "Arithmetic Logic", basePrice: 6, description: "Performs binary two's-complement arithmetic", isCapped: false, image: "/images/comp_42.svg" },
  { id: 43, name: "Flag", symbolName: "Flag indicator", symbol: "⚑", role: "Misc Components", country: "Status Register", basePrice: 2, description: "Indicates status condition", isCapped: false, image: "/images/comp_43.svg" },
  { id: 44, name: "Splitter", symbolName: "Signal splitter", symbol: "1 → 2+", role: "Misc Components", country: "Bus / Routing", basePrice: 3, description: "Splits one signal into multiple paths", isCapped: false, image: "/images/comp_44.svg" },
  { id: 45, name: "Adder", symbolName: "Binary adder", symbol: "+", role: "Misc Components", country: "Arithmetic Unit", basePrice: 10, description: "Adds binary values", isCapped: false, image: "/images/comp_45.svg" },
  { id: 46, name: "ALU", symbolName: "Arithmetic Logic Unit", symbol: "ALU", role: "Misc Components", country: "Processor Core", basePrice: 25, description: "Performs arithmetic and logical operations", isCapped: true, image: "/images/comp_46.svg" },
  { id: 47, name: "Tristate Flip-Flop", symbolName: "Tri-state buffer/driver", symbol: "▷ + EN", role: "Misc Components", country: "Bus Driver", basePrice: 14, description: "Output can be 0, 1, or High-Z", isCapped: true, image: "/images/comp_47.svg" },
  { id: 48, name: "Tunnel", symbolName: "Tunnel connection", symbol: "○", role: "Misc Components", country: "Net Label", basePrice: 4, description: "Connects signals wirelessly by label", isCapped: false, image: "/images/comp_48.svg" },
  { id: 49, name: "Buffer", symbolName: "Logic buffer", symbol: "▷", role: "Misc Components", country: "Signal Conditioning", basePrice: 3, description: "Passes signal without modification", isCapped: false, image: "/images/comp_49.svg" },
  { id: 50, name: "Controller Inverter", symbolName: "Inverting controller", symbol: "▷○", role: "Misc Components", country: "Control Logic", basePrice: 4, description: "Inverted control driver", isCapped: false, image: "/images/comp_50.svg" },
  { id: 51, name: "Test Bench Input", symbolName: "Test input", symbol: "▰", role: "Misc Components", country: "Test & Verification", basePrice: 5, description: "Provides stimulus input", isCapped: false, image: "/images/comp_51.svg" },
  { id: 52, name: "Test Bench Output", symbolName: "Test output", symbol: "▰", role: "Misc Components", country: "Test & Verification", basePrice: 5, description: "Monitors test responses", isCapped: false, image: "/images/comp_52.svg" },
  { id: 53, name: "Force Gate", symbolName: "Force gate", symbol: "F", role: "Misc Components", country: "Signal Override", basePrice: 9, description: "Forces/overrides signal", isCapped: false, image: "/images/comp_53.svg" },
];

function getInitialState() {
  return {
    phase: "lobby",
    currentPlayer: null,
    currentBid: 0,
    currentBidder: null,
    timerSeconds: BID_TIMER_SECONDS,
    auctionQueue: [],
    soldHistory: [],
    unsoldPlayers: [],
    lastSoldEvent: null,
    feed: [
      { id: "init", text: "⚡ Logic Circuit Arena initialized. Teams can register in lobby.", time: Date.now(), type: "info" }
    ],
    lastAction: null,
  };
}

export const getAuctionState = query({
  args: { key: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const key = args.key || "current_game";
    const record = await ctx.db
      .query("auction_state")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();
    return record ? record.data : getInitialState();
  },
});

export const getTeams = query({
  args: {},
  handler: async (ctx) => {
    const records = await ctx.db.query("teams").collect();
    const map = {};
    for (const r of records) {
      map[r.teamId] = {
        id: r.teamId,
        name: r.name,
        short: r.short || r.name,
        leader: r.leader || "",
        members: r.members || [],
        color: r.color || "#00e5ff",
        icon: r.icon || "⚡",
        logo: r.logo || "",
        password: r.password || "",
        budget: r.budget ?? INITIAL_BUDGET,
        verified: Boolean(r.verified),
        players: r.players || [],
        playingXI: r.playingXI || [],
      };
    }
    return map;
  },
});

export const registerTeam = mutation({
  args: {
    name: v.string(),
    short: v.optional(v.string()),
    leader: v.optional(v.string()),
    members: v.optional(v.array(v.string())),
    logo: v.optional(v.string()),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const cleanName = args.name.trim();
    const cleanPass = args.password.trim();

    if (!cleanName) throw new Error("Team name is required");
    if (!cleanPass) throw new Error("Team passcode is required");

    const existingTeams = await ctx.db.query("teams").collect();
    const nameConflict = existingTeams.some(
      (t) => t.name.toLowerCase() === cleanName.toLowerCase()
    );
    if (nameConflict) throw new Error("A team with this name is already registered");

    const passConflict = existingTeams.some((t) => t.password === cleanPass);
    if (passConflict) throw new Error("This passcode PIN is already in use by another team");

    const teamId = "team_" + Math.random().toString(36).substring(2, 9);
    const short = (args.short || cleanName.substring(0, 10)).toUpperCase();
    const members = Array.isArray(args.members) && args.members.length ? args.members.slice(0, 5) : [args.leader || cleanName];
    const leader = args.leader || members[0] || cleanName;

    const colors = ["#00e5ff", "#00ff88", "#ffd700", "#ff007f", "#a855f7", "#ff7a00", "#38bdf8", "#4ade80"];
    const color = colors[existingTeams.length % colors.length];

    const newTeam = {
      teamId,
      name: cleanName,
      short,
      leader,
      members,
      color,
      icon: "⚡",
      logo: args.logo || "",
      password: cleanPass,
      budget: INITIAL_BUDGET,
      verified: false,
      players: [],
      playingXI: [],
      updatedAt: Date.now(),
    };

    await ctx.db.insert("teams", newTeam);

    // Add feed item to state
    const stateRecord = await ctx.db.query("auction_state").withIndex("by_key", (q) => q.eq("key", "current_game")).first();
    const currentState = stateRecord ? stateRecord.data : getInitialState();
    const feed = currentState.feed || [];
    feed.unshift({
      id: "reg_" + Date.now(),
      text: `👥 Team Registered: ${cleanName} (${members.length} members) — Pending Host Approval`,
      time: Date.now(),
      type: "info",
    });

    if (stateRecord) {
      await ctx.db.patch(stateRecord._id, { data: { ...currentState, feed: feed.slice(0, 50) }, updatedAt: Date.now() });
    }

    return { success: true, teamId, team: newTeam };
  },
});

export const verifyTeam = mutation({
  args: {
    teamId: v.string(),
    verified: v.boolean(),
    adminPass: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.adminPass !== ADMIN_PASSWORD) throw new Error("Unauthorized admin credentials");

    const team = await ctx.db.query("teams").withIndex("by_teamId", (q) => q.eq("teamId", args.teamId)).first();
    if (!team) throw new Error("Team not found");

    await ctx.db.patch(team._id, { verified: args.verified, updatedAt: Date.now() });

    const stateRecord = await ctx.db.query("auction_state").withIndex("by_key", (q) => q.eq("key", "current_game")).first();
    const currentState = stateRecord ? stateRecord.data : getInitialState();
    const feed = currentState.feed || [];
    feed.unshift({
      id: "v_" + Date.now(),
      text: args.verified
        ? `✅ Host APPROVED team: ${team.name} for bidding`
        : `⚠️ Host REVOKED approval for team: ${team.name}`,
      time: Date.now(),
      type: args.verified ? "win" : "lost",
    });

    if (stateRecord) {
      await ctx.db.patch(stateRecord._id, { data: { ...currentState, feed: feed.slice(0, 50) }, updatedAt: Date.now() });
    }

    return { success: true, verified: args.verified };
  },
});

export const verifyAllTeams = mutation({
  args: {
    verified: v.boolean(),
    adminPass: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.adminPass !== ADMIN_PASSWORD) throw new Error("Unauthorized admin credentials");

    const allTeams = await ctx.db.query("teams").collect();
    for (const t of allTeams) {
      await ctx.db.patch(t._id, { verified: args.verified, updatedAt: Date.now() });
    }

    return { success: true, count: allTeams.length };
  },
});

export const updateTeamBudget = mutation({
  args: {
    teamId: v.string(),
    budget: v.number(),
    adminPass: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.adminPass !== ADMIN_PASSWORD) throw new Error("Unauthorized admin credentials");

    const team = await ctx.db.query("teams").withIndex("by_teamId", (q) => q.eq("teamId", args.teamId)).first();
    if (!team) throw new Error("Team not found");

    await ctx.db.patch(team._id, { budget: args.budget, updatedAt: Date.now() });
    return { success: true, budget: args.budget };
  },
});

export const deleteTeam = mutation({
  args: {
    teamId: v.string(),
    adminPass: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.adminPass !== ADMIN_PASSWORD) throw new Error("Unauthorized admin credentials");

    const team = await ctx.db.query("teams").withIndex("by_teamId", (q) => q.eq("teamId", args.teamId)).first();
    if (team) {
      await ctx.db.delete(team._id);
      return { success: true };
    }
    return { success: false };
  },
});

export const startAuction = mutation({
  args: {
    adminPass: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.adminPass !== ADMIN_PASSWORD) throw new Error("Unauthorized admin credentials");

    // Shuffle 53 components for auction queue
    const queue = [...DEFAULT_COMPONENTS].sort(() => Math.random() - 0.5);
    const firstComponent = queue[0];
    const remainingQueue = queue.slice(1);

    const newState = {
      phase: "auction",
      currentPlayer: firstComponent,
      currentBid: firstComponent.basePrice,
      currentBidder: null,
      timerSeconds: BID_TIMER_SECONDS,
      auctionQueue: remainingQueue,
      soldHistory: [],
      unsoldPlayers: [],
      lastSoldEvent: null,
      feed: [
        { id: "start_" + Date.now(), text: `🚀 AUCTION STARTED! Spotlight on #${firstComponent.id}: ${firstComponent.name} (${firstComponent.basePrice} pts)`, time: Date.now(), type: "info" }
      ],
      lastAction: "started",
    };

    const stateRecord = await ctx.db.query("auction_state").withIndex("by_key", (q) => q.eq("key", "current_game")).first();
    if (stateRecord) {
      await ctx.db.patch(stateRecord._id, { data: newState, updatedAt: Date.now() });
    } else {
      await ctx.db.insert("auction_state", { key: "current_game", data: newState, updatedAt: Date.now() });
    }

    return { success: true, gameState: newState };
  },
});

export const placeBid = mutation({
  args: {
    teamId: v.string(),
    password: v.string(),
    increment: v.optional(v.number()),
    amount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const team = await ctx.db.query("teams").withIndex("by_teamId", (q) => q.eq("teamId", args.teamId)).first();
    if (!team || team.password !== args.password) throw new Error("Invalid team credentials");
    if (!team.verified) throw new Error("Team is pending host approval before bidding is enabled");

    const stateRecord = await ctx.db.query("auction_state").withIndex("by_key", (q) => q.eq("key", "current_game")).first();
    if (!stateRecord || stateRecord.data.phase !== "auction") throw new Error("Auction is not currently active");

    const state = stateRecord.data;
    if (!state.currentPlayer) throw new Error("No component currently on the auction stage");

    let bidAmount = 0;
    if (args.increment) {
      bidAmount = state.currentBid + args.increment;
    } else if (args.amount) {
      bidAmount = args.amount;
    }

    if (bidAmount <= state.currentBid) {
      throw new Error(`Bid must be strictly higher than current bid of ${state.currentBid} pts`);
    }

    if (bidAmount > team.budget) {
      throw new Error(`Insufficient budget! Your team has ${team.budget} pts remaining`);
    }

    const squad = team.players || [];
    if (squad.length >= 30) {
      throw new Error("Squad limit reached (30 components max)");
    }

    state.currentBid = bidAmount;
    state.currentBidder = team.teamId;
    state.timerSeconds = BID_TIMER_SECONDS;

    const feed = state.feed || [];
    feed.unshift({
      id: "bid_" + Date.now(),
      text: `⚡ ${team.name} bid ${bidAmount} pts for ${state.currentPlayer.name}`,
      time: Date.now(),
      type: "bid",
    });
    state.feed = feed.slice(0, 50);

    await ctx.db.patch(stateRecord._id, { data: state, updatedAt: Date.now() });

    return { success: true, bid: bidAmount, bidder: team.name };
  },
});

export const autoResolveTimer = mutation({
  args: {},
  handler: async (ctx) => {
    const stateRecord = await ctx.db.query("auction_state").withIndex("by_key", (q) => q.eq("key", "current_game")).first();
    if (!stateRecord) return { success: false, reason: "No state" };

    const state = stateRecord.data;
    if (state.phase !== "auction" || !state.currentPlayer) {
      return { success: false, reason: "Auction not active" };
    }

    const currentComp = state.currentPlayer;
    const winnerId = state.currentBidder;

    if (winnerId) {
      // Award component to leading bidder
      const winnerTeam = await ctx.db.query("teams").withIndex("by_teamId", (q) => q.eq("teamId", winnerId)).first();
      const soldItem = {
        ...currentComp,
        soldPrice: state.currentBid,
        soldTo: winnerId,
        teamName: winnerTeam ? winnerTeam.name : "Winner",
        teamLogo: winnerTeam ? winnerTeam.logo : "",
        soldAt: Date.now(),
      };

      if (winnerTeam) {
        const newBudget = Math.max(0, winnerTeam.budget - state.currentBid);
        const players = winnerTeam.players || [];
        players.push(soldItem);
        await ctx.db.patch(winnerTeam._id, { budget: newBudget, players, updatedAt: Date.now() });
      }

      state.soldHistory = state.soldHistory || [];
      state.soldHistory.push(soldItem);

      state.lastSoldEvent = {
        id: "ev_" + Date.now(),
        winnerId: winnerId,
        winnerName: winnerTeam ? winnerTeam.name : "Winner",
        winnerLogo: winnerTeam ? winnerTeam.logo : "",
        componentName: currentComp.name,
        componentImage: currentComp.image,
        soldPrice: state.currentBid,
        isUnsold: false,
        timestamp: Date.now(),
      };

      const feed = state.feed || [];
      feed.unshift({
        id: "sold_" + Date.now(),
        text: `🏆 SOLD! ${soldItem.name} awarded to ${winnerTeam ? winnerTeam.name : winnerId} for ${state.currentBid} pts`,
        time: Date.now(),
        type: "sold",
      });
      state.feed = feed.slice(0, 50);
    } else {
      // Mark unsold
      state.unsoldPlayers = state.unsoldPlayers || [];
      state.unsoldPlayers.push({ ...currentComp, unsoldAt: Date.now() });

      state.lastSoldEvent = {
        id: "ev_" + Date.now(),
        winnerId: null,
        winnerName: null,
        componentName: currentComp.name,
        componentImage: currentComp.image,
        soldPrice: currentComp.basePrice,
        isUnsold: true,
        timestamp: Date.now(),
      };

      const feed = state.feed || [];
      feed.unshift({
        id: "unsold_" + Date.now(),
        text: `❌ UNSOLD: ${currentComp.name} passed with 0 bids`,
        time: Date.now(),
        type: "lost",
      });
      state.feed = feed.slice(0, 50);
    }

    // Advance queue
    const queue = state.auctionQueue || [];
    if (queue.length > 0) {
      const nextItem = queue[0];
      state.currentPlayer = nextItem;
      state.currentBid = nextItem.basePrice;
      state.currentBidder = null;
      state.timerSeconds = BID_TIMER_SECONDS;
      state.auctionQueue = queue.slice(1);
    } else {
      state.currentPlayer = null;
      state.phase = "finished";
    }

    await ctx.db.patch(stateRecord._id, { data: state, updatedAt: Date.now() });
    return { success: true, lastSoldEvent: state.lastSoldEvent };
  },
});

export const sellComponent = mutation({
  args: {
    adminPass: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.adminPass !== ADMIN_PASSWORD) throw new Error("Unauthorized admin credentials");

    const stateRecord = await ctx.db.query("auction_state").withIndex("by_key", (q) => q.eq("key", "current_game")).first();
    if (!stateRecord) throw new Error("Game state not found");

    const state = stateRecord.data;
    if (!state.currentPlayer) throw new Error("No active component to sell");

    const winnerId = state.currentBidder;
    let winnerTeam = null;

    if (winnerId) {
      winnerTeam = await ctx.db.query("teams").withIndex("by_teamId", (q) => q.eq("teamId", winnerId)).first();
    }

    const soldItem = {
      ...state.currentPlayer,
      soldPrice: state.currentBid,
      soldTo: winnerId || null,
      teamName: winnerTeam ? winnerTeam.name : "Winner",
      teamLogo: winnerTeam ? winnerTeam.logo : "",
      soldAt: Date.now(),
    };

    if (winnerTeam) {
      const newBudget = Math.max(0, winnerTeam.budget - state.currentBid);
      const players = winnerTeam.players || [];
      players.push(soldItem);
      await ctx.db.patch(winnerTeam._id, { budget: newBudget, players, updatedAt: Date.now() });
    }

    state.soldHistory = state.soldHistory || [];
    state.soldHistory.push(soldItem);

    state.lastSoldEvent = {
      id: "ev_" + Date.now(),
      winnerId: winnerId || null,
      winnerName: winnerTeam ? winnerTeam.name : "Winner",
      winnerLogo: winnerTeam ? winnerTeam.logo : "",
      componentName: state.currentPlayer.name,
      componentImage: state.currentPlayer.image,
      soldPrice: state.currentBid,
      isUnsold: false,
      timestamp: Date.now(),
    };

    const feed = state.feed || [];
    feed.unshift({
      id: "sold_" + Date.now(),
      text: winnerTeam
        ? `🏆 SOLD! ${soldItem.name} awarded to ${winnerTeam.name} for ${state.currentBid} pts`
        : `✅ Sold ${soldItem.name} for ${state.currentBid} pts`,
      time: Date.now(),
      type: "sold",
    });

    // Advance queue
    const queue = state.auctionQueue || [];
    if (queue.length > 0) {
      const nextItem = queue[0];
      state.currentPlayer = nextItem;
      state.currentBid = nextItem.basePrice;
      state.currentBidder = null;
      state.timerSeconds = BID_TIMER_SECONDS;
      state.auctionQueue = queue.slice(1);
    } else {
      state.currentPlayer = null;
      state.phase = "finished";
    }

    state.feed = feed.slice(0, 50);
    await ctx.db.patch(stateRecord._id, { data: state, updatedAt: Date.now() });

    return { success: true, soldItem };
  },
});

export const markUnsold = mutation({
  args: {
    adminPass: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.adminPass !== ADMIN_PASSWORD) throw new Error("Unauthorized admin credentials");

    const stateRecord = await ctx.db.query("auction_state").withIndex("by_key", (q) => q.eq("key", "current_game")).first();
    if (!stateRecord) throw new Error("Game state not found");

    const state = stateRecord.data;
    if (!state.currentPlayer) throw new Error("No active component");

    state.unsoldPlayers = state.unsoldPlayers || [];
    state.unsoldPlayers.push({ ...state.currentPlayer, unsoldAt: Date.now() });

    state.lastSoldEvent = {
      id: "ev_" + Date.now(),
      winnerId: null,
      winnerName: null,
      componentName: state.currentPlayer.name,
      componentImage: state.currentPlayer.image,
      soldPrice: state.currentPlayer.basePrice,
      isUnsold: true,
      timestamp: Date.now(),
    };

    const feed = state.feed || [];
    feed.unshift({
      id: "unsold_" + Date.now(),
      text: `❌ UNSOLD: ${state.currentPlayer.name} passed with 0 bids`,
      time: Date.now(),
      type: "lost",
    });

    // Advance queue
    const queue = state.auctionQueue || [];
    if (queue.length > 0) {
      const nextItem = queue[0];
      state.currentPlayer = nextItem;
      state.currentBid = nextItem.basePrice;
      state.currentBidder = null;
      state.timerSeconds = BID_TIMER_SECONDS;
      state.auctionQueue = queue.slice(1);
    } else {
      state.currentPlayer = null;
      state.phase = "finished";
    }

    state.feed = feed.slice(0, 50);
    await ctx.db.patch(stateRecord._id, { data: state, updatedAt: Date.now() });

    return { success: true };
  },
});

export const pauseAuction = mutation({
  args: { adminPass: v.string() },
  handler: async (ctx, args) => {
    if (args.adminPass !== ADMIN_PASSWORD) throw new Error("Unauthorized admin credentials");
    const stateRecord = await ctx.db.query("auction_state").withIndex("by_key", (q) => q.eq("key", "current_game")).first();
    if (!stateRecord) return;
    const state = stateRecord.data;
    state.phase = "paused";
    await ctx.db.patch(stateRecord._id, { data: state, updatedAt: Date.now() });
    return { success: true };
  },
});

export const resumeAuction = mutation({
  args: { adminPass: v.string() },
  handler: async (ctx, args) => {
    if (args.adminPass !== ADMIN_PASSWORD) throw new Error("Unauthorized admin credentials");
    const stateRecord = await ctx.db.query("auction_state").withIndex("by_key", (q) => q.eq("key", "current_game")).first();
    if (!stateRecord) return;
    const state = stateRecord.data;
    state.phase = "auction";
    await ctx.db.patch(stateRecord._id, { data: state, updatedAt: Date.now() });
    return { success: true };
  },
});

export const stopAuction = mutation({
  args: { adminPass: v.string() },
  handler: async (ctx, args) => {
    if (args.adminPass !== ADMIN_PASSWORD) throw new Error("Unauthorized admin credentials");
    const stateRecord = await ctx.db.query("auction_state").withIndex("by_key", (q) => q.eq("key", "current_game")).first();
    if (!stateRecord) return;
    const state = stateRecord.data;
    state.phase = "finished";
    await ctx.db.patch(stateRecord._id, { data: state, updatedAt: Date.now() });
    return { success: true };
  },
});

export const nextComponent = mutation({
  args: { adminPass: v.string() },
  handler: async (ctx, args) => {
    if (args.adminPass !== ADMIN_PASSWORD) throw new Error("Unauthorized admin credentials");
    const stateRecord = await ctx.db.query("auction_state").withIndex("by_key", (q) => q.eq("key", "current_game")).first();
    if (!stateRecord) throw new Error("Game state not found");
    const state = stateRecord.data;
    if (!state.currentPlayer) throw new Error("No active component");

    const currentComp = state.currentPlayer;
    const queue = state.auctionQueue || [];
    queue.push(currentComp);

    if (queue.length > 0) {
      const nextItem = queue.shift();
      state.currentPlayer = nextItem;
      state.currentBid = nextItem.basePrice;
      state.currentBidder = null;
      state.timerSeconds = BID_TIMER_SECONDS;
      state.auctionQueue = queue;
    }

    const feed = state.feed || [];
    feed.unshift({
      id: "next_" + Date.now(),
      text: `⏭️ Admin skipped #${currentComp.id} ${currentComp.name} to end of queue. Next: #${state.currentPlayer?.id || ''} ${state.currentPlayer?.name || ''}`,
      time: Date.now(),
      type: "info",
    });
    state.feed = feed.slice(0, 50);

    await ctx.db.patch(stateRecord._id, { data: state, updatedAt: Date.now() });
    return { success: true, next: state.currentPlayer };
  },
});

export const resetAuction = mutation({
  args: { adminPass: v.string() },
  handler: async (ctx, args) => {
    if (args.adminPass !== ADMIN_PASSWORD) throw new Error("Unauthorized admin credentials");
    const stateRecord = await ctx.db.query("auction_state").withIndex("by_key", (q) => q.eq("key", "current_game")).first();
    const cleanState = getInitialState();
    if (stateRecord) {
      await ctx.db.patch(stateRecord._id, { data: cleanState, updatedAt: Date.now() });
    } else {
      await ctx.db.insert("auction_state", { key: "current_game", data: cleanState, updatedAt: Date.now() });
    }

    // Reset all team budgets back to 500 and clear acquired items
    const allTeams = await ctx.db.query("teams").collect();
    for (const t of allTeams) {
      await ctx.db.patch(t._id, { budget: INITIAL_BUDGET, players: [], playingXI: [], updatedAt: Date.now() });
    }

    return { success: true };
  },
});
