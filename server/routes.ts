import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { bitcoinPriceSchema, timeRangeSchema } from "@shared/schema";

const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY || process.env.API_KEY;

interface CoinGeckoPrice {
  bitcoin: {
    usd: number;
    usd_24h_change: number;
    usd_market_cap: number;
    usd_24h_vol: number;
  };
}

interface CoinGeckoHistorical {
  prices: [number, number][];
}

async function fetchBitcoinPrice() {
  try {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
    };
    
    if (COINGECKO_API_KEY) {
      headers['x-cg-demo-api-key'] = COINGECKO_API_KEY;
    }

    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true',
      { headers }
    );

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data: CoinGeckoPrice = await response.json();
    
    // Fetch additional data for circulating supply and ATH
    const coinResponse = await fetch(
      'https://api.coingecko.com/api/v3/coins/bitcoin',
      { headers }
    );

    if (!coinResponse.ok) {
      throw new Error(`CoinGecko coin API error: ${coinResponse.status}`);
    }

    const coinData = await coinResponse.json();

    return {
      price: data.bitcoin.usd,
      change24h: data.bitcoin.usd_24h_change,
      marketCap: data.bitcoin.usd_market_cap,
      volume24h: data.bitcoin.usd_24h_vol,
      circulatingSupply: coinData.market_data.circulating_supply,
      allTimeHigh: coinData.market_data.ath.usd,
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error('Error fetching Bitcoin price:', error);
    throw error;
  }
}

async function fetchHistoricalData(timeRange: string) {
  try {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
    };
    
    if (COINGECKO_API_KEY) {
      headers['x-cg-demo-api-key'] = COINGECKO_API_KEY;
    }

    let days: string;
    switch (timeRange) {
      case '24h':
        days = '1';
        break;
      case '7d':
        days = '7';
        break;
      case '30d':
        days = '30';
        break;
      case '1y':
        days = '365';
        break;
      case 'all':
        days = 'max';
        break;
      default:
        days = '1';
    }

    const response = await fetch(
      `https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=${days}`,
      { headers }
    );

    if (!response.ok) {
      throw new Error(`CoinGecko historical API error: ${response.status}`);
    }

    const data: CoinGeckoHistorical = await response.json();
    
    return data.prices.map(([timestamp, price]) => ({
      timestamp,
      price,
    }));
  } catch (error) {
    console.error('Error fetching historical data:', error);
    throw error;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Get current Bitcoin price
  app.get("/api/bitcoin/price", async (req, res) => {
    try {
      const cachedPrice = await storage.getCurrentPrice();
      const now = Date.now();
      
      // Cache for 30 seconds
      if (cachedPrice && (now - cachedPrice.timestamp) < 30000) {
        return res.json(cachedPrice);
      }

      const price = await fetchBitcoinPrice();
      await storage.setCurrentPrice(price);
      
      res.json(price);
    } catch (error) {
      console.error('Error in /api/bitcoin/price:', error);
      res.status(500).json({ 
        message: 'Failed to fetch Bitcoin price. Please check API key configuration or try again later.' 
      });
    }
  });

  // Get historical data
  app.get("/api/bitcoin/historical/:timeRange", async (req, res) => {
    try {
      const { timeRange } = req.params;
      
      const validation = timeRangeSchema.safeParse(timeRange);
      if (!validation.success) {
        return res.status(400).json({ message: 'Invalid time range' });
      }

      const cachedData = await storage.getHistoricalData(timeRange);
      const now = Date.now();
      
      // Cache historical data for 5 minutes
      if (cachedData.length > 0 && cachedData[cachedData.length - 1]) {
        const lastUpdate = cachedData[cachedData.length - 1].timestamp;
        if ((now - lastUpdate) < 300000) {
          return res.json(cachedData);
        }
      }

      const data = await fetchHistoricalData(timeRange);
      await storage.setHistoricalData(timeRange, data);
      
      res.json(data);
    } catch (error) {
      console.error('Error in /api/bitcoin/historical:', error);
      res.status(500).json({ 
        message: 'Failed to fetch historical data. Please check API key configuration or try again later.' 
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
