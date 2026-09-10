import { type BitcoinPrice, type HistoricalData, type CryptoPrice, type InsertPollVote, type PollVote, pollVotes, type InsertEmailSubscription, type EmailSubscription, emailSubscriptions, predictionAccounts, blockLocks, type PredictionAccount, type BlockLock } from "@shared/schema";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, sql as drizzleSql } from "drizzle-orm";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

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
  findOrCreatePredictionAccount(clerkUserId: string): Promise<PredictionAccount>;
  getPredictionAccount(clerkUserId: string): Promise<PredictionAccount | undefined>;
  getBlockLockForAccount(accountId: number): Promise<BlockLock | undefined>;
  getPublicBlockLocks(): Promise<number[]>;
  createBlockLock(accountId: number, input: Omit<BlockLock, "id" | "accountId" | "lockedAt">): Promise<BlockLock>;
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

  async findOrCreatePredictionAccount(clerkUserId: string): Promise<PredictionAccount> {
    await db.insert(predictionAccounts).values({ clerkUserId }).onConflictDoNothing();
    const [account] = await db.select().from(predictionAccounts).where(eq(predictionAccounts.clerkUserId, clerkUserId)).limit(1);
    if (!account) throw new Error("Unable to create prediction account");
    return account;
  }

  async getPredictionAccount(clerkUserId: string): Promise<PredictionAccount | undefined> {
    const [account] = await db.select().from(predictionAccounts).where(eq(predictionAccounts.clerkUserId, clerkUserId)).limit(1);
    return account;
  }

  async getBlockLockForAccount(accountId: number): Promise<BlockLock | undefined> {
    const [lock] = await db.select().from(blockLocks).where(eq(blockLocks.accountId, accountId)).limit(1);
    return lock;
  }

  async getPublicBlockLocks(): Promise<number[]> {
    const locks = await db.select({ blockHeight: blockLocks.blockHeight }).from(blockLocks);
    return locks.map((lock) => lock.blockHeight);
  }

  async createBlockLock(accountId: number, input: Omit<BlockLock, "id" | "accountId" | "lockedAt">): Promise<BlockLock> {
    const [lock] = await db.insert(blockLocks).values({ accountId, ...input }).returning();
    return lock;
  }
}

export const storage = new MemStorage();
