import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const CONVEX_URL = "https://dapper-akita-326.convex.cloud";
const client = new ConvexHttpClient(CONVEX_URL);

async function runTest() {
  console.log("🧪 Testing Convex Serverless React Backend Direct Mutations...");

  // 1. Reset auction
  console.log("1. Resetting auction state...");
  await client.mutation(api.auction.resetAuction, { adminPass: "aiml" });
  console.log("  ✅ Reset successful");

  // 2. Register team 1
  const t1Name = "Vite Logic Alpha " + Date.now();
  console.log(`2. Registering Team: ${t1Name}...`);
  const t1Res = await client.mutation(api.auction.registerTeam, {
    name: t1Name,
    leader: "Alice Leader",
    members: ["Alice Leader", "Bob", "Charlie", "David", "Eve"],
    password: "pass_" + Date.now(),
  });
  console.log(`  ✅ Registered Team 1 ID: ${t1Res.teamId}`);

  // 3. Register team 2
  const t2Name = "Vite Circuit Beta " + Date.now();
  console.log(`3. Registering Team: ${t2Name}...`);
  const t2Pass = "pass_beta_" + Date.now();
  const t2Res = await client.mutation(api.auction.registerTeam, {
    name: t2Name,
    leader: "Frank Leader",
    members: ["Frank Leader", "Grace"],
    password: t2Pass,
  });
  console.log(`  ✅ Registered Team 2 ID: ${t2Res.teamId}`);

  // 4. Verify teams by admin
  console.log("4. Admin approving both teams...");
  await client.mutation(api.auction.verifyTeam, { teamId: t1Res.teamId, verified: true, adminPass: "aiml" });
  await client.mutation(api.auction.verifyTeam, { teamId: t2Res.teamId, verified: true, adminPass: "aiml" });
  console.log("  ✅ Both teams approved");

  // 5. Start auction
  console.log("5. Starting auction with 53 components...");
  const startRes = await client.mutation(api.auction.startAuction, { adminPass: "aiml" });
  console.log(`  ✅ Auction started. Current component: #${startRes.gameState.currentPlayer.id} ${startRes.gameState.currentPlayer.name} (${startRes.gameState.currentBid} pts)`);

  // 6. Quick bid +1 pt by Team 1
  console.log("6. Team 1 placing +1 pt quick bid...");
  const bid1 = await client.mutation(api.auction.placeBid, {
    teamId: t1Res.teamId,
    password: t1Res.team.password,
    increment: 1,
  });
  console.log(`  ✅ Team 1 bid: ${bid1.bid} pts`);

  // 7. Quick bid +5 pts by Team 2
  console.log("7. Team 2 placing +5 pts quick bid...");
  const bid2 = await client.mutation(api.auction.placeBid, {
    teamId: t2Res.teamId,
    password: t2Pass,
    increment: 5,
  });
  console.log(`  ✅ Team 2 counter-bid: ${bid2.bid} pts`);

  // 8. Sell component to Team 2
  console.log("8. Admin confirming component sale...");
  const sellRes = await client.mutation(api.auction.sellComponent, { adminPass: "aiml" });
  console.log(`  ✅ Component sold to: ${sellRes.soldItem.teamName} for ${sellRes.soldItem.soldPrice} pts`);

  // 9. Stop auction
  console.log("9. Concluding auction...");
  await client.mutation(api.auction.stopAuction, { adminPass: "aiml" });
  console.log("  ✅ Auction concluded");

  console.log("\n🎉 ALL CONVEX DIRECT SERVERLESS TESTS PASSED WITH 100% SUCCESS!\n");
}

runTest().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
