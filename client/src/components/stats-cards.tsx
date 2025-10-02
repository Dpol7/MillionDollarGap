import { useState } from "react";
import { BitcoinPrice } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { 
  calculateDistanceFromMillion, 
  calculateProgressToMillion, 
  formatCurrency, 
  formatLargeCurrency 
} from "@/lib/bitcoin-api";
import { TrendingUp, Target, BarChart3, Percent, DollarSign } from "lucide-react";

interface StatsCardsProps {
  bitcoinPrice?: BitcoinPrice;
  isLoading: boolean;
}

export default function StatsCards({ bitcoinPrice, isLoading }: StatsCardsProps) {
  const [showPercentage, setShowPercentage] = useState(false);
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="stat-card">
            <CardContent className="pt-6">
              <Skeleton className="h-4 w-24 mb-3" />
              <Skeleton className="h-8 w-32 mb-2" />
              <Skeleton className="h-4 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!bitcoinPrice) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="stat-card">
          <CardContent className="pt-6">
            <div className="text-center text-muted-foreground">
              <p>Unable to load Bitcoin data</p>
              <p className="text-sm mt-2">Please try refreshing the page</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const distance = calculateDistanceFromMillion(bitcoinPrice.price);
  const progress = calculateProgressToMillion(bitcoinPrice.price);
  const increaseNeeded = ((1000000 / bitcoinPrice.price) - 1) * 100;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* Current Bitcoin Price Card */}
      <Card className="stat-card">
        <CardContent className="pt-6">
          <div className="flex items-start justify-between mb-3">
            <div className="text-muted-foreground text-sm font-medium">Current BTC Price</div>
            <TrendingUp className="h-5 w-5 text-primary" />
          </div>
          <div className="font-mono text-2xl sm:text-3xl font-bold mb-2" data-testid="text-current-price">
            {formatCurrency(bitcoinPrice.price)}
          </div>
          <div className="flex items-center space-x-2">
            <span className={`text-sm font-medium ${bitcoinPrice.change24h >= 0 ? 'text-success' : 'text-destructive'}`}>
              {bitcoinPrice.change24h >= 0 ? '+' : ''}{bitcoinPrice.change24h.toFixed(2)}%
            </span>
            <span className="text-muted-foreground text-xs">24h</span>
          </div>
        </CardContent>
      </Card>

      {/* Distance from $1M Card */}
      <Card className="stat-card md:col-span-2">
        <CardContent className="pt-6">
          <div className="flex items-start justify-between mb-3">
            <div className="text-muted-foreground text-sm font-medium">
              {showPercentage ? "% Increase Needed" : "Distance from $1M"}
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPercentage(!showPercentage)}
                className="h-8 px-2 hover:bg-accent/10"
                data-testid="button-toggle-view"
              >
                {showPercentage ? (
                  <DollarSign className="h-4 w-4 text-accent" />
                ) : (
                  <Percent className="h-4 w-4 text-accent" />
                )}
              </Button>
              <Target className="h-5 w-5 text-accent" />
            </div>
          </div>
          <div className="font-mono text-3xl sm:text-4xl lg:text-5xl font-bold text-accent mb-2" data-testid="text-distance">
            {showPercentage ? (
              <span data-testid="text-percentage-view">+{increaseNeeded.toFixed(2)}%</span>
            ) : (
              <span data-testid="text-dollar-view">{formatCurrency(distance)}</span>
            )}
          </div>
          <div className="text-muted-foreground text-sm">
            {showPercentage ? (
              <>Bitcoin needs to increase by this percentage to reach $1 million</>
            ) : (
              <>Bitcoin needs to increase by <span className="text-foreground font-semibold">{increaseNeeded.toFixed(0)}%</span> to reach $1 million</>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Progress to $1M Card */}
      <Card className="stat-card">
        <CardContent className="pt-6">
          <div className="text-muted-foreground text-sm font-medium mb-3 flex items-center">
            <BarChart3 className="h-4 w-4 mr-2" />
            Progress to Goal
          </div>
          <div className="relative pt-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-3xl font-bold font-mono" data-testid="text-progress">
                {progress.toFixed(2)}%
              </span>
            </div>
            <div className="overflow-hidden h-3 text-xs flex rounded-full bg-secondary">
              <div 
                style={{ width: `${Math.min(progress, 100)}%` }} 
                className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-gradient-to-r from-primary to-accent transition-all duration-1000"
              />
            </div>
          </div>
          <div className="text-muted-foreground text-xs mt-3">of $1,000,000 target</div>
        </CardContent>
      </Card>
    </div>
  );
}
