import { z } from "zod";

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
