import { z } from "zod";
import { pgTable, serial, integer, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const bitcoinPriceSchema = z.object({
  price: z.number(),
  change24h: z.number(),
  marketCap: z.number(),
  volume24h: z.number(),
  circulatingSupply: z.number(),
  allTimeHigh: z.number(),
  timestamp: z.number(),
});

export const cryptoPriceSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  name: z.string(),
  price: z.number(),
  change24h: z.number(),
  marketCap: z.number(),
  distanceToMillion: z.number(),
  percentToMillion: z.number(),
  timestamp: z.number(),
});

export const historicalDataSchema = z.object({
  timestamp: z.number(),
  price: z.number(),
});

export const timeRangeSchema = z.enum(['24h', '7d', '30d', '1y', 'all']);

export type BitcoinPrice = z.infer<typeof bitcoinPriceSchema>;
export type CryptoPrice = z.infer<typeof cryptoPriceSchema>;
export type HistoricalData = z.infer<typeof historicalDataSchema>;
export type TimeRange = z.infer<typeof timeRangeSchema>;

export const pollVotes = pgTable("poll_votes", {
  id: serial("id").primaryKey(),
  prediction: varchar("prediction", { length: 50 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const pollPredictionSchema = z.enum(["2025", "2026", "2027", "2028", "2029", "2030", "2030+", "Never"]);

export const insertPollVoteSchema = createInsertSchema(pollVotes).omit({
  id: true,
  createdAt: true,
}).extend({
  prediction: pollPredictionSchema,
});

export type InsertPollVote = z.infer<typeof insertPollVoteSchema>;
export type PollVote = typeof pollVotes.$inferSelect;

export const emailSubscriptions = pgTable("email_subscriptions", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertEmailSubscriptionSchema = createInsertSchema(emailSubscriptions).omit({
  id: true,
  createdAt: true,
}).extend({
  email: z.string().email("Please enter a valid email address"),
});

export type InsertEmailSubscription = z.infer<typeof insertEmailSubscriptionSchema>;
export type EmailSubscription = typeof emailSubscriptions.$inferSelect;

export const predictionAccounts = pgTable("prediction_accounts", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).unique(),
  clerkUserId: varchar("clerk_user_id", { length: 255 }).notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const blockLocks = pgTable("block_locks", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").notNull().unique().references(() => predictionAccounts.id),
  blockHeight: integer("block_height").notNull().unique(),
  estimatedArrival: varchar("estimated_arrival", { length: 80 }).notNull(),
  fiftyRange: varchar("fifty_range", { length: 120 }).notNull(),
  eightyRange: varchar("eighty_range", { length: 120 }).notNull(),
  lockedAt: timestamp("locked_at").notNull().defaultNow(),
});

export type PredictionAccount = typeof predictionAccounts.$inferSelect;
export type BlockLock = typeof blockLocks.$inferSelect;

export const lockBlockSchema = z.object({
  blockHeight: z.number().int().min(914_280).max(1_509_144),
  estimatedArrival: z.string().trim().min(1).max(80),
  fiftyRange: z.string().trim().min(1).max(120),
  eightyRange: z.string().trim().min(1).max(120),
});
