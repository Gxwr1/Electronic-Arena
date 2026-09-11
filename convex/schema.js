import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  auction_state: defineTable({
    key: v.string(),
    data: v.any(),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),

  teams: defineTable({
    teamId: v.string(),
    name: v.string(),
    short: v.string(),
    leader: v.optional(v.string()),
    members: v.optional(v.array(v.string())),
    color: v.optional(v.string()),
    icon: v.optional(v.string()),
    logo: v.optional(v.string()),
    password: v.optional(v.string()),
    budget: v.number(),
    verified: v.boolean(),
    players: v.optional(v.any()),
    playingXI: v.optional(v.any()),
    updatedAt: v.number(),
  }).index("by_teamId", ["teamId"]),
});
