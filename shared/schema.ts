import { z } from "zod";
import { pgTable, serial, numeric, boolean, timestamp } from "drizzle-orm/pg-core";
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

export const historicalDataSchema = z.object({
  timestamp: z.number(),
  price: z.number(),
});

export const timeRangeSchema = z.enum(['24h', '7d', '30d', '1y', 'all']);

export type BitcoinPrice = z.infer<typeof bitcoinPriceSchema>;
export type HistoricalData = z.infer<typeof historicalDataSchema>;
export type TimeRange = z.infer<typeof timeRangeSchema>;

export const priceAlerts = pgTable("price_alerts", {
  id: serial("id").primaryKey(),
  targetPrice: numeric("target_price", { precision: 10, scale: 2 }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
  triggered: boolean("triggered").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPriceAlertSchema = createInsertSchema(priceAlerts).omit({
  id: true,
  createdAt: true,
});

export type InsertPriceAlert = z.infer<typeof insertPriceAlertSchema>;
export type PriceAlert = typeof priceAlerts.$inferSelect;
