import { type BitcoinPrice, type HistoricalData, type CryptoPrice, type InsertPollVote, type PollVote, pollVotes, type InsertEmailSubscription, type EmailSubscription, emailSubscriptions } from "@shared/schema";
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
  
  createPollVote(vote: InsertPollVote): Promise<PollVote>;
  getPollResults(): Promise<{ prediction: string; count: number }[]>;
  
  createEmailSubscription(subscription: InsertEmailSubscription): Promise<EmailSubscription>;
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

  async createEmailSubscription(subscription: InsertEmailSubscription): Promise<EmailSubscription> {
    const [newSubscription] = await db.insert(emailSubscriptions).values(subscription).returning();
    return newSubscription;
  }
}

export const storage = new MemStorage();
