import { type BitcoinPrice, type HistoricalData } from "@shared/schema";

export interface IStorage {
  getCurrentPrice(): Promise<BitcoinPrice | undefined>;
  setCurrentPrice(price: BitcoinPrice): Promise<void>;
  getHistoricalData(timeRange: string): Promise<HistoricalData[]>;
  setHistoricalData(timeRange: string, data: HistoricalData[]): Promise<void>;
}

export class MemStorage implements IStorage {
  private currentPrice: BitcoinPrice | undefined;
  private historicalData: Map<string, HistoricalData[]>;

  constructor() {
    this.currentPrice = undefined;
    this.historicalData = new Map();
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
}

export const storage = new MemStorage();
