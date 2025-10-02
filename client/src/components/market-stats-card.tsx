import { BitcoinPrice } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatLargeCurrency } from "@/lib/bitcoin-api";
import { BarChart3 } from "lucide-react";

interface MarketStatsCardProps {
  bitcoinPrice?: BitcoinPrice;
}

export default function MarketStatsCard({ bitcoinPrice }: MarketStatsCardProps) {
  if (!bitcoinPrice) {
    return (
      <Card className="stat-card">
        <CardContent className="p-6">
          <h3 className="text-lg font-bold mb-4 flex items-center">
            <BarChart3 className="h-5 w-5 mr-2 text-accent" />
            Market Overview
          </h3>
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const athDistance = ((bitcoinPrice.allTimeHigh - bitcoinPrice.price) / bitcoinPrice.allTimeHigh) * 100;
  const marketCapAt1M = bitcoinPrice.circulatingSupply * 1000000;

  return (
    <Card className="stat-card">
      <CardContent className="p-6">
        <h3 className="text-lg font-bold mb-4 flex items-center">
          <BarChart3 className="h-5 w-5 mr-2 text-accent" />
          Market Overview
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between" data-testid="stat-market-cap">
            <span className="text-muted-foreground text-sm">Market Cap</span>
            <span className="font-mono font-semibold">
              {formatLargeCurrency(bitcoinPrice.marketCap)}
            </span>
          </div>
          <div className="flex items-center justify-between" data-testid="stat-volume">
            <span className="text-muted-foreground text-sm">24h Volume</span>
            <span className="font-mono font-semibold">
              {formatLargeCurrency(bitcoinPrice.volume24h)}
            </span>
          </div>
          <div className="flex items-center justify-between" data-testid="stat-supply">
            <span className="text-muted-foreground text-sm">Circulating Supply</span>
            <span className="font-mono font-semibold">
              {(bitcoinPrice.circulatingSupply / 1000000).toFixed(1)}M BTC
            </span>
          </div>
          <div className="flex items-center justify-between" data-testid="stat-ath">
            <span className="text-muted-foreground text-sm">All-Time High</span>
            <span className="font-mono font-semibold">
              ${bitcoinPrice.allTimeHigh.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center justify-between" data-testid="stat-ath-distance">
            <span className="text-muted-foreground text-sm">Distance from ATH</span>
            <span className="font-mono font-semibold text-destructive">
              -{athDistance.toFixed(2)}%
            </span>
          </div>
          <div className="mt-6 p-4 bg-accent/10 border border-accent/20 rounded-lg">
            <p className="text-sm text-accent">
              <strong>Fun Fact:</strong> At $1M per BTC, Bitcoin's market cap would be approximately{' '}
              {formatLargeCurrency(marketCapAt1M)}, surpassing gold's market cap.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
