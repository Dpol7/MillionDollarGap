import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { bitcoinPriceSchema, timeRangeSchema, insertPriceAlertSchema } from "@shared/schema";

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

async function fetchMultiCryptoPrices() {
  try {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
    };
    
    if (COINGECKO_API_KEY) {
      headers['x-cg-demo-api-key'] = COINGECKO_API_KEY;
    }

    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,binancecoin&vs_currencies=usd&include_market_cap=true&include_24hr_change=true',
      { headers }
    );

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data = await response.json();
    const TARGET_PRICE = 1000000;
    
    const cryptos = [
      { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' },
      { id: 'ethereum', symbol: 'ETH', name: 'Ethereum' },
      { id: 'binancecoin', symbol: 'BNB', name: 'BNB' },
    ];

    return cryptos.map(crypto => {
      const price = data[crypto.id].usd;
      const distance = Math.max(0, TARGET_PRICE - price);
      const progress = Math.min(100, (price / TARGET_PRICE) * 100);
      
      return {
        id: crypto.id,
        symbol: crypto.symbol,
        name: crypto.name,
        price,
        change24h: data[crypto.id].usd_24h_change || 0,
        marketCap: data[crypto.id].usd_market_cap || 0,
        distanceToMillion: distance,
        percentToMillion: progress,
        timestamp: Date.now(),
      };
    });
  } catch (error) {
    console.error('Error fetching multi-crypto prices:', error);
    throw error;
  }
}

async function checkPriceAlerts(currentPrice: number) {
  try {
    const alerts = await storage.getPriceAlerts();
    for (const alert of alerts) {
      if (!alert.triggered && alert.isActive) {
        const targetPrice = parseFloat(alert.targetPrice);
        if (currentPrice >= targetPrice) {
          await storage.updatePriceAlert(alert.id, true);
          console.log(`Alert triggered: BTC reached $${targetPrice}`);
        }
      }
    }
  } catch (error) {
    console.error('Error checking price alerts:', error);
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
      
      // Check price alerts in background
      checkPriceAlerts(price.price);
      
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

  // Get multi-crypto prices
  app.get("/api/crypto/prices", async (req, res) => {
    try {
      const cached = await storage.getMultiCryptoPrices();
      const now = Date.now();
      
      // Cache for 30 seconds
      if (cached.length > 0 && (now - cached[0].timestamp) < 30000) {
        return res.json(cached);
      }

      const prices = await fetchMultiCryptoPrices();
      await storage.setMultiCryptoPrices(prices);
      
      res.json(prices);
    } catch (error) {
      console.error('Error in /api/crypto/prices:', error);
      res.status(500).json({ 
        message: 'Failed to fetch crypto prices. Please check API key configuration or try again later.' 
      });
    }
  });

  // Price Alerts API
  app.get("/api/alerts", async (req, res) => {
    try {
      const alerts = await storage.getPriceAlerts();
      res.json(alerts);
    } catch (error) {
      console.error('Error fetching alerts:', error);
      res.status(500).json({ message: 'Failed to fetch price alerts' });
    }
  });

  app.post("/api/alerts", async (req, res) => {
    try {
      const validation = insertPriceAlertSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: 'Invalid alert data', errors: validation.error });
      }

      const alert = await storage.createPriceAlert(validation.data);
      res.status(201).json(alert);
    } catch (error) {
      console.error('Error creating alert:', error);
      res.status(500).json({ message: 'Failed to create price alert' });
    }
  });

  app.delete("/api/alerts/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid alert ID' });
      }

      await storage.deletePriceAlert(id);
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting alert:', error);
      res.status(500).json({ message: 'Failed to delete price alert' });
    }
  });

  app.patch("/api/alerts/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid alert ID' });
      }

      const { triggered } = req.body;
      if (typeof triggered !== 'boolean') {
        return res.status(400).json({ message: 'Invalid triggered value' });
      }

      await storage.updatePriceAlert(id, triggered);
      res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error updating alert:', error);
      res.status(500).json({ message: 'Failed to update price alert' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
