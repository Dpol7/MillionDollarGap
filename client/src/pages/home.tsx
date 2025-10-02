import { useQuery } from "@tanstack/react-query";
import { fetchBitcoinPrice } from "@/lib/bitcoin-api";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import StatsCards from "@/components/stats-cards";
import MilestonesCard from "@/components/milestones-card";
import MarketStatsCard from "@/components/market-stats-card";
import BitcoinObituariesCard from "@/components/bitcoin-obituaries-card";
import MillionDollarPoll from "@/components/million-dollar-poll";
import { BitcoinPrice } from "@shared/schema";
import { useEffect } from "react";

export default function Home() {
  const { toast } = useToast();

  const { data: bitcoinPrice, isLoading, error, refetch } = useQuery<BitcoinPrice>({
    queryKey: ['/api/bitcoin/price'],
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (error) {
      toast({
        title: "Error fetching Bitcoin price",
        description: error instanceof Error ? error.message : "Failed to fetch data",
        variant: "destructive",
      });
    }
  }, [error, toast]);

  const handleRefresh = async () => {
    try {
      await refetch();
      toast({
        title: "Data refreshed",
        description: "Bitcoin price data updated successfully",
      });
    } catch (error) {
      toast({
        title: "Refresh failed",
        description: "Unable to refresh data. Please try again.",
        variant: "destructive",
      });
    }
  };

  const formatTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "Just now";
    if (minutes === 1) return "1 min ago";
    return `${minutes} mins ago`;
  };

  return (
    <div className="min-h-screen">
      {/* Navigation Header */}
      <nav className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center font-bold text-primary-foreground">
                ₿
              </div>
              <div>
                <h1 className="text-lg font-bold">BTC to $1M</h1>
                <p className="text-xs text-muted-foreground">Distance Tracker</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 rounded-full bg-success/10 border border-success/20">
                <div className="w-2 h-2 bg-success rounded-full pulse-animation"></div>
                <span className="text-xs font-medium text-success">Live</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                disabled={isLoading}
                className="p-2 rounded-lg hover:bg-secondary transition-colors"
                data-testid="button-refresh"
              >
                <RefreshCw className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
                <span className="sr-only">Refresh data</span>
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <div className="mb-8">
          <div className="mb-6">
            <h2 className="text-3xl sm:text-4xl font-bold mb-2">
              How far from <span className="gradient-text">$1,000,000</span>?
            </h2>
            <p className="text-muted-foreground">Real-time tracking of Bitcoin's journey to the million-dollar milestone</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-destructive font-medium">Failed to load Bitcoin data</p>
              <p className="text-destructive/80 text-sm mt-1">
                {error instanceof Error ? error.message : 'Please check your internet connection and try again.'}
              </p>
            </div>
          )}

          <StatsCards bitcoinPrice={bitcoinPrice} isLoading={isLoading} />
        </div>

        {/* Additional Info Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
          <MilestonesCard bitcoinPrice={bitcoinPrice} />
          <MarketStatsCard bitcoinPrice={bitcoinPrice} />
          <MillionDollarPoll />
        </div>

        {/* Bitcoin Obituaries Section */}
        <div className="mt-8">
          <BitcoinObituariesCard />
        </div>

        {/* Footer Info */}
        <div className="mt-12 text-center">
          <div className="inline-flex items-center space-x-2 px-4 py-2 bg-secondary rounded-full text-sm text-muted-foreground">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>
              Data updates every 30 seconds • Last updated: {' '}
              <span data-testid="text-last-updated">
                {bitcoinPrice ? formatTime(bitcoinPrice.timestamp) : 'Never'}
              </span>
            </span>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Data provided by CoinGecko API • Not financial advice • For informational purposes only
          </p>
        </div>
      </main>
    </div>
  );
}
