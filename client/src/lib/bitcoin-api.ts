import { BitcoinPrice, HistoricalData, TimeRange, CryptoPrice } from "@shared/schema";

export async function fetchBitcoinPrice(): Promise<BitcoinPrice> {
  const response = await fetch('/api/bitcoin/price');
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch Bitcoin price');
  }
  return response.json();
}

export async function fetchMultiCryptoPrices(): Promise<CryptoPrice[]> {
  const response = await fetch('/api/crypto/prices');
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch crypto prices');
  }
  return response.json();
}

export async function fetchHistoricalData(timeRange: TimeRange): Promise<HistoricalData[]> {
  const response = await fetch(`/api/bitcoin/historical/${timeRange}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch historical data');
  }
  return response.json();
}

export function calculateDistanceFromMillion(price: number): number {
  return Math.max(0, 1000000 - price);
}

export function calculateProgressToMillion(price: number): number {
  return Math.min(100, (price / 1000000) * 100);
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatLargeCurrency(amount: number): string {
  if (amount >= 1e12) {
    return `$${(amount / 1e12).toFixed(1)}T`;
  } else if (amount >= 1e9) {
    return `$${(amount / 1e9).toFixed(1)}B`;
  } else if (amount >= 1e6) {
    return `$${(amount / 1e6).toFixed(1)}M`;
  } else if (amount >= 1e3) {
    return `$${(amount / 1e3).toFixed(1)}K`;
  }
  return formatCurrency(amount);
}
