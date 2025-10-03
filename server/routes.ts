import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { bitcoinPriceSchema, timeRangeSchema, insertPollVoteSchema, insertEmailSubscriptionSchema } from "@shared/schema";

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

  // Poll API
  app.post("/api/poll/vote", async (req, res) => {
    try {
      const validation = insertPollVoteSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: 'Invalid vote data', errors: validation.error });
      }

      const vote = await storage.createPollVote(validation.data);
      res.status(201).json(vote);
    } catch (error) {
      console.error('Error creating poll vote:', error);
      res.status(500).json({ message: 'Failed to submit vote' });
    }
  });

  app.get("/api/poll/results", async (req, res) => {
    try {
      const results = await storage.getPollResults();
      res.json(results);
    } catch (error) {
      console.error('Error fetching poll results:', error);
      res.status(500).json({ message: 'Failed to fetch poll results' });
    }
  });

  // Email Subscription API
  app.post("/api/subscribe", async (req, res) => {
    try {
      const validation = insertEmailSubscriptionSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          message: validation.error.errors[0]?.message || 'Invalid email address'
        });
      }

      // Add subscriber to Buttondown (sends double opt-in email automatically)
      if (process.env.BUTTONDOWN_API_KEY) {
        try {
          const buttondownResponse = await fetch('https://api.buttondown.com/v1/subscribers', {
            method: 'POST',
            headers: {
              'Authorization': `Token ${process.env.BUTTONDOWN_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email_address: validation.data.email,
              // Don't set type - this enables double opt-in by default
              // Subscriber will receive confirmation email automatically
            }),
          });

          if (!buttondownResponse.ok) {
            const errorData = await buttondownResponse.json();
            console.error('Buttondown API error:', errorData);
            
            // Check if email already exists in Buttondown
            if (buttondownResponse.status === 400 && errorData.email_address) {
              return res.status(409).json({ message: 'This email is already subscribed' });
            }
            
            throw new Error(`Buttondown API returned ${buttondownResponse.status}`);
          }

          const buttondownData = await buttondownResponse.json();
          console.log('Subscriber added to Buttondown:', buttondownData.email_address);
        } catch (buttondownError) {
          console.error('Error adding to Buttondown:', buttondownError);
          // Continue to save in database even if Buttondown fails
        }
      }

      // Save to database for our records
      const subscription = await storage.createEmailSubscription(validation.data);
      res.status(201).json({ 
        success: true,
        message: 'Check your email to confirm your subscription!'
      });
    } catch (error: any) {
      console.error('Error creating email subscription:', error);
      // Check for unique constraint violation
      if (error.message?.includes('unique') || error.code === '23505') {
        return res.status(409).json({ message: 'This email is already subscribed' });
      }
      res.status(500).json({ message: 'Failed to subscribe. Please try again.' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
