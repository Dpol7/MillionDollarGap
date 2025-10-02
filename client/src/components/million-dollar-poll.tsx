import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Check, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface PollResult {
  prediction: string;
  count: number;
}

const POLL_OPTIONS = [
  "2025",
  "2026",
  "2027",
  "2028",
  "2029",
  "2030",
  "2030+",
  "Never"
];

const VOTE_STORAGE_KEY = "btc-million-poll-vote";

export default function MillionDollarPoll() {
  const { toast } = useToast();
  const [userVote, setUserVote] = useState<string | null>(null);

  useEffect(() => {
    const savedVote = localStorage.getItem(VOTE_STORAGE_KEY);
    if (savedVote) {
      setUserVote(savedVote);
    }
  }, []);

  const { data: results, isLoading } = useQuery<PollResult[]>({
    queryKey: ['/api/poll/results'],
  });

  const voteMutation = useMutation({
    mutationFn: async (prediction: string) => {
      return apiRequest('POST', '/api/poll/vote', { prediction });
    },
    onSuccess: (_, prediction) => {
      localStorage.setItem(VOTE_STORAGE_KEY, prediction);
      setUserVote(prediction);
      queryClient.invalidateQueries({ queryKey: ['/api/poll/results'] });
      toast({
        title: "Vote submitted!",
        description: "Thanks for participating in the poll.",
      });
    },
    onError: () => {
      toast({
        title: "Vote failed",
        description: "Unable to submit your vote. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleVote = (prediction: string) => {
    if (userVote) {
      toast({
        title: "Already voted",
        description: "You've already submitted your prediction.",
        variant: "destructive",
      });
      return;
    }
    voteMutation.mutate(prediction);
  };

  const totalVotes = results?.reduce((sum, r) => sum + r.count, 0) || 0;

  const getVoteCount = (option: string) => {
    return results?.find(r => r.prediction === option)?.count || 0;
  };

  const getPercentage = (option: string) => {
    if (totalVotes === 0) return 0;
    const count = getVoteCount(option);
    return (count / totalVotes) * 100;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              When will Bitcoin hit $1M?
            </CardTitle>
            <CardDescription>Cast your prediction and see what others think</CardDescription>
          </div>
          {totalVotes > 0 && (
            <div className="text-right">
              <div className="text-2xl font-bold text-primary" data-testid="text-total-votes">
                {totalVotes}
              </div>
              <div className="text-xs text-muted-foreground">total votes</div>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {POLL_OPTIONS.map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {POLL_OPTIONS.map((option) => {
              const percentage = getPercentage(option);
              const count = getVoteCount(option);
              const isUserVote = userVote === option;

              return (
                <div key={option} className="relative">
                  <Button
                    variant={isUserVote ? "default" : "outline"}
                    className="w-full justify-start h-auto py-3 px-4 relative overflow-hidden"
                    onClick={() => handleVote(option)}
                    disabled={!!userVote || voteMutation.isPending}
                    data-testid={`button-vote-${option}`}
                  >
                    <div
                      className="absolute left-0 top-0 bottom-0 bg-primary/10 transition-all duration-300"
                      style={{ width: `${percentage}%` }}
                    />
                    <div className="relative flex items-center justify-between w-full">
                      <div className="flex items-center gap-2">
                        {isUserVote && <Check className="h-4 w-4" />}
                        <span className="font-semibold">{option}</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        {totalVotes > 0 && (
                          <>
                            <span className="text-muted-foreground" data-testid={`text-count-${option}`}>
                              {count} {count === 1 ? 'vote' : 'votes'}
                            </span>
                            <span className="font-bold min-w-[3rem] text-right" data-testid={`text-percentage-${option}`}>
                              {percentage.toFixed(1)}%
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        {userVote && (
          <div className="mt-4 p-3 bg-success/10 border border-success/20 rounded-lg text-sm text-center">
            <p className="text-success font-medium">
              You predicted: <span className="font-bold">{userVote}</span>
            </p>
          </div>
        )}

        {!userVote && !isLoading && (
          <p className="mt-4 text-xs text-center text-muted-foreground">
            Click an option to cast your vote
          </p>
        )}
      </CardContent>
    </Card>
  );
}
