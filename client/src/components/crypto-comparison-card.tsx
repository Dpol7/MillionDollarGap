import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";
import { fetchMultiCryptoPrices } from "@/lib/bitcoin-api";
import { formatCurrency, formatLargeCurrency } from "@/lib/bitcoin-api";
import type { CryptoPrice } from "@shared/schema";

export default function CryptoComparisonCard() {
  const { data: cryptos = [], isLoading } = useQuery<CryptoPrice[]>({
    queryKey: ['/api/crypto/prices'],
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <Card className="stat-card">
        <CardHeader>
          <CardTitle className="text-lg">Crypto Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse">
                <div className="h-16 bg-secondary rounded-lg"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="stat-card">
      <CardHeader>
        <CardTitle className="text-lg">Crypto Comparison</CardTitle>
        <p className="text-sm text-muted-foreground">Distance from $1M</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {cryptos.map((crypto) => (
            <div
              key={crypto.id}
              className="p-3 rounded-lg border border-border bg-secondary/30 hover:bg-secondary/50 transition-colors"
              data-testid={`crypto-${crypto.symbol.toLowerCase()}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="font-semibold">{crypto.symbol}</div>
                  <div className="text-xs text-muted-foreground">{crypto.name}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-semibold" data-testid={`text-price-${crypto.symbol.toLowerCase()}`}>
                    {formatCurrency(crypto.price)}
                  </div>
                  <div className={`text-xs flex items-center justify-end ${crypto.change24h >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {crypto.change24h >= 0 ? (
                      <TrendingUp className="h-3 w-3 mr-1" />
                    ) : (
                      <TrendingDown className="h-3 w-3 mr-1" />
                    )}
                    {Math.abs(crypto.change24h).toFixed(2)}%
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Distance:</span>
                  <span className="font-mono" data-testid={`text-distance-${crypto.symbol.toLowerCase()}`}>
                    {formatLargeCurrency(crypto.distanceToMillion)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Progress:</span>
                  <span className="font-mono" data-testid={`text-percent-${crypto.symbol.toLowerCase()}`}>
                    {crypto.percentToMillion.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
