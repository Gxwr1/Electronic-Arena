# Electronic-Arena ⚡

Real-time Multiplayer **Digital Logic Circuit Component Auction & Interactive Online Circuit Simulator** for hackathons, engineering competitions, and digital electronics labs.

---

## 🚀 Quick Start

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the server:
   ```bash
   npm start
   ```

3. Open in your browser:
   - **Participant Bidding Arena**: [http://localhost:3000](http://localhost:3000)
   - **Interactive Circuit Simulator**: [http://localhost:3000/simulator](http://localhost:3000/simulator)
   - **Audience Stage Observatory**: [http://localhost:3000/audience](http://localhost:3000/audience)
   - **Admin Control Suite**: [http://localhost:3000/admin.html](http://localhost:3000/admin.html) *(Password: `aiml`)*

---

## ⚡ Key Features

- **53 Logic Circuit Components & Schematics**:
  - Comprehensive library across 7 digital electronics categories: *Input*, *Output*, *Logic Gates*, *Decoders / Data Selectors*, *Sequential Elements*, *Annotation & Probes*, and *Misc / Arithmetic Components*.
  - Clean vector schematic SVGs for each component with exact symbols and representation.
- **Dynamic Team Registration & Admin Approval**:
  - Teams register dynamically with Team Name, Logo Upload, Leader, and up to 4 Teammates (5 members max).
  - Starts with 0 default teams and a fixed **500 points (`pts`)** budget.
  - Verification workflow requiring Admin approval before live bidding is unlocked.
- **Multiplayer Auction Interface**:
  - Strictly **`+1 pt`**, **`+2 pts`**, and **`+5 pts`** quick bidding increments.
  - Real-time countdown timer with Web Audio synthesized sound effects.
  - Live activity feed and component spotlights.
- **Online Digital Circuit Simulator**:
  - Built-in 60Hz digital logic simulation engine with glowing wires (HIGH = neon green `#00ff88`, LOW = dark slate `#334155`).
  - **Component Inventory Rule**: Teams can only build circuits with the components they have won during the auction (with an optional Sandbox Mode toggle).
  - Interactive switches, push-buttons, clock pulses, logic gates, flip-flops, multiplexers, decoders, 7-segment displays, and audio buzzers.
  - Circuit JSON Save / Load, step simulation, and schematic export.

---

## 🛡️ Admin Suite

- **Admin Login**: `http://localhost:3000/admin.html` *(Default password: `aiml`)*
- **Admin 1 (Controls)**: Orchestrate auction flow, approve/verify registered teams, manage budgets and passcodes.
- **Admin 2 (Component Catalog)**: Manage 53 logic components and custom queue decks.
- **Admin 3 (Results)**: Reveal prize standings and top team rankings.
- **Admin 4 (Technical Reports)**: Real-time budget analytics, category breakdown, CSV export, and PDF printable reports.

---

## 🧪 Testing

Run smoke and multiplayer socket test suites:
```bash
npm run test:smoke
node test/socket-test.js
```
