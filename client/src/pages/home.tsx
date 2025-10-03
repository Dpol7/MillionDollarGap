import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { BitcoinPrice } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useState } from "react";

export default function Home() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");

  const { data: bitcoinPrice, isLoading } = useQuery<BitcoinPrice>({
    queryKey: ['/api/bitcoin/price'],
    refetchInterval: 30000,
  });

  const subscribeMutation = useMutation({
    mutationFn: async (email: string) => {
      return await apiRequest('POST', '/api/subscribe', { email });
    },
    onSuccess: () => {
      toast({
        title: "Successfully subscribed!",
        description: "You'll be notified when Bitcoin reaches $1M.",
      });
      setEmail("");
    },
    onError: (error: any) => {
      toast({
        title: "Subscription failed",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      subscribeMutation.mutate(email);
    }
  };

  const targetPrice = 1000000;
  const currentPrice = bitcoinPrice?.price || 0;
  const progressPercentage = Math.min((currentPrice / targetPrice) * 100, 100);

  return (
    <div className="min-h-screen">
      {/* Navigation Header */}
      <nav className="border-b border-accent bg-accent sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center font-bold text-white">
                ₿
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          {/* Section 1 */}
          <Card className="stat-card" data-testid="card-question-1">
            <CardContent className="p-8 text-center">
              <h2 className="text-2xl sm:text-3xl font-bold mb-4">
                Is Bitcoin $1 Million?
              </h2>
              <p className="text-6xl sm:text-7xl font-bold gradient-text" data-testid="text-answer-no">
                No
              </p>
            </CardContent>
          </Card>

          {/* Section 2 */}
          <Card className="stat-card" data-testid="card-question-2">
            <CardContent className="p-8 text-center">
              <h2 className="text-2xl sm:text-3xl font-bold mb-4">
                Will Bitcoin reach $1 Million?
              </h2>
              <p className="text-6xl sm:text-7xl font-bold gradient-text" data-testid="text-answer-maybe">
                Maybe
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Progress Bar Section */}
        <div className="mt-8">
          <Card className="stat-card" data-testid="card-progress">
            <CardContent className="p-8">
              <div className="space-y-4">
                <div className="flex justify-between items-baseline">
                  <h3 className="text-xl sm:text-2xl font-bold">Progress to $1,000,000</h3>
                  {isLoading ? (
                    <Skeleton className="h-6 w-24" />
                  ) : (
                    <span className="text-lg font-semibold gradient-text" data-testid="text-percentage">
                      {progressPercentage.toFixed(2)}%
                    </span>
                  )}
                </div>

                {/* Progress Bar */}
                <div className="relative w-full h-12 bg-secondary rounded-full overflow-hidden border-2 border-border">
                  {isLoading ? (
                    <Skeleton className="h-full w-full" />
                  ) : (
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-orange-500 transition-all duration-500 ease-out"
                      style={{ width: `${progressPercentage}%` }}
                      data-testid="progress-bar-fill"
                    />
                  )}
                </div>

                {/* Price Labels */}
                <div className="flex justify-between text-sm">
                  <div className="text-left">
                    <p className="text-muted-foreground">Current Price</p>
                    {isLoading ? (
                      <Skeleton className="h-5 w-24 mt-1" />
                    ) : (
                      <p className="font-mono font-bold text-lg" data-testid="text-current-price">
                        ${currentPrice.toLocaleString()}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-bold text-lg gradient-text" data-testid="text-goal">
                      $1,000,000
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Email Signup Section */}
        <div className="mt-8">
          <Card className="stat-card" data-testid="card-subscribe">
            <CardContent className="p-8">
              <div className="max-w-2xl mx-auto text-center">
                <h3 className="text-xl sm:text-2xl font-bold mb-4">
                  Sign up to be notified when $1M USD = 1 BTC
                </h3>
                <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
                  <Input
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="flex-1"
                    data-testid="input-email"
                    disabled={subscribeMutation.isPending}
                  />
                  <Button 
                    type="submit" 
                    className="sm:w-auto"
                    data-testid="button-subscribe"
                    disabled={subscribeMutation.isPending}
                  >
                    {subscribeMutation.isPending ? "Subscribing..." : "Wen $1M?"}
                  </Button>
                </form>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
