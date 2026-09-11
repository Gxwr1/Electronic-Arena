import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getAuctionState = query({
  args: { key: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const key = args.key || "current_game";
    const record = await ctx.db
      .query("auction_state")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();
    return record ? record.data : null;
  },
});

export const saveAuctionState = mutation({
  args: { key: v.optional(v.string()), data: v.any() },
  handler: async (ctx, args) => {
    const key = args.key || "current_game";
    const existing = await ctx.db
      .query("auction_state")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        data: args.data,
        updatedAt: Date.now(),
      });
      return existing._id;
    } else {
      return await ctx.db.insert("auction_state", {
        key,
        data: args.data,
        updatedAt: Date.now(),
      });
    }
  },
});

export const getTeams = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("teams").collect();
  },
});

export const saveTeam = mutation({
  args: { team: v.any() },
  handler: async (ctx, args) => {
    const team = args.team;
    if (!team || !team.id) return null;
    const existing = await ctx.db
      .query("teams")
      .withIndex("by_teamId", (q) => q.eq("teamId", team.id))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        ...team,
        teamId: team.id,
        updatedAt: Date.now(),
      });
      return existing._id;
    } else {
      return await ctx.db.insert("teams", {
        ...team,
        teamId: team.id,
        updatedAt: Date.now(),
      });
    }
  },
});

export const deleteTeam = mutation({
  args: { teamId: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("teams")
      .withIndex("by_teamId", (q) => q.eq("teamId", args.teamId))
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
      return true;
    }
    return false;
  },
});
