import { type BitcoinPrice, type HistoricalData, type CryptoPrice, type InsertPriceAlert, type PriceAlert, priceAlerts, type InsertPollVote, type PollVote, pollVotes } from "@shared/schema";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, sql as drizzleSql } from "drizzle-orm";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

export interface IStorage {
  getCurrentPrice(): Promise<BitcoinPrice | undefined>;
  setCurrentPrice(price: BitcoinPrice): Promise<void>;
  getHistoricalData(timeRange: string): Promise<HistoricalData[]>;
  setHistoricalData(timeRange: string, data: HistoricalData[]): Promise<void>;
  
  getMultiCryptoPrices(): Promise<CryptoPrice[]>;
  setMultiCryptoPrices(prices: CryptoPrice[]): Promise<void>;
  
  createPriceAlert(alert: InsertPriceAlert): Promise<PriceAlert>;
  getPriceAlerts(): Promise<PriceAlert[]>;
  deletePriceAlert(id: number): Promise<void>;
  updatePriceAlert(id: number, triggered: boolean): Promise<void>;
  
  createPollVote(vote: InsertPollVote): Promise<PollVote>;
  getPollResults(): Promise<{ prediction: string; count: number }[]>;
}

export class MemStorage implements IStorage {
  private currentPrice: BitcoinPrice | undefined;
  private historicalData: Map<string, HistoricalData[]>;
  private multiCryptoPrices: CryptoPrice[];

  constructor() {
    this.currentPrice = undefined;
    this.historicalData = new Map();
    this.multiCryptoPrices = [];
  }

  async getCurrentPrice(): Promise<BitcoinPrice | undefined> {
    return this.currentPrice;
  }

  async setCurrentPrice(price: BitcoinPrice): Promise<void> {
    this.currentPrice = price;
  }

  async getHistoricalData(timeRange: string): Promise<HistoricalData[]> {
    return this.historicalData.get(timeRange) || [];
  }

  async setHistoricalData(timeRange: string, data: HistoricalData[]): Promise<void> {
    this.historicalData.set(timeRange, data);
  }

  async getMultiCryptoPrices(): Promise<CryptoPrice[]> {
    return this.multiCryptoPrices;
  }

  async setMultiCryptoPrices(prices: CryptoPrice[]): Promise<void> {
    this.multiCryptoPrices = prices;
  }

  async createPriceAlert(alert: InsertPriceAlert): Promise<PriceAlert> {
    const [newAlert] = await db.insert(priceAlerts).values(alert).returning();
    return newAlert;
  }

  async getPriceAlerts(): Promise<PriceAlert[]> {
    return await db.select().from(priceAlerts).orderBy(priceAlerts.createdAt);
  }

  async deletePriceAlert(id: number): Promise<void> {
    await db.delete(priceAlerts).where(eq(priceAlerts.id, id));
  }

  async updatePriceAlert(id: number, triggered: boolean): Promise<void> {
    await db.update(priceAlerts).set({ triggered }).where(eq(priceAlerts.id, id));
  }

  async createPollVote(vote: InsertPollVote): Promise<PollVote> {
    const [newVote] = await db.insert(pollVotes).values(vote).returning();
    return newVote;
  }

  async getPollResults(): Promise<{ prediction: string; count: number }[]> {
    const results = await db
      .select({
        prediction: pollVotes.prediction,
        count: drizzleSql<number>`count(*)::int`,
      })
      .from(pollVotes)
      .groupBy(pollVotes.prediction);
    
    return results;
  }
}

export const storage = new MemStorage();
