import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, Quote } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface Obituary {
  date: string;
  quote: string;
  source: string;
  priceAtTime: number;
}

const bitcoinObituaries: Obituary[] = [
  {
    date: "Dec 2013",
    quote: "Bitcoin is a tumor that needs to be excised from the financial system.",
    source: "Financial Analyst",
    priceAtTime: 600
  },
  {
    date: "Jan 2015",
    quote: "Bitcoin will collapse to $10 by mid-2015.",
    source: "Mark T. Williams, Boston University",
    priceAtTime: 200
  },
  {
    date: "Sep 2017",
    quote: "Bitcoin is a fraud and will blow up.",
    source: "Jamie Dimon, JPMorgan CEO",
    priceAtTime: 4200
  },
  {
    date: "Dec 2018",
    quote: "Bitcoin is worth exactly zero.",
    source: "Joseph Stiglitz, Nobel Laureate",
    priceAtTime: 3200
  },
  {
    date: "Mar 2020",
    quote: "Bitcoin will never recover from this crash.",
    source: "Market Analysts",
    priceAtTime: 5000
  }
];

export default function BitcoinObituariesCard() {
  const { data: bitcoinPrice, isLoading } = useQuery<{ price: number }>({
    queryKey: ['/api/bitcoin/price'],
  });

  const currentPrice = bitcoinPrice?.price || 0;

  const calculateGain = (oldPrice: number) => {
    if (!currentPrice || oldPrice === 0) return 0;
    return ((currentPrice - oldPrice) / oldPrice) * 100;
  };

  return (
    <Card className="col-span-1 md:col-span-2 lg:col-span-3">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Quote className="h-5 w-5 text-primary" />
              "Bitcoin is Dead"
            </CardTitle>
            <CardDescription>Famous predictions that didn't age well</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {bitcoinObituaries.map((obit, index) => {
              const gain = calculateGain(obit.priceAtTime);
              return (
                <div
                  key={index}
                  className="p-4 rounded-lg bg-secondary/50 border border-border hover:border-primary/50 transition-all"
                  data-testid={`obituary-card-${index}`}
                >
                  <div className="flex items-start gap-2 mb-3">
                    <Quote className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
                    <p className="text-sm italic text-foreground leading-relaxed">
                      "{obit.quote}"
                    </p>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between items-center text-muted-foreground">
                      <span>— {obit.source}</span>
                      <span>{obit.date}</span>
                    </div>
                    <div className="pt-2 border-t border-border/50">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-muted-foreground">BTC then:</span>
                        <span className="font-medium" data-testid={`price-then-${index}`}>
                          ${obit.priceAtTime.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-muted-foreground">BTC now:</span>
                        <span className="font-medium" data-testid={`price-now-${index}`}>
                          ${currentPrice.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-center gap-1 px-2 py-1.5 bg-success/10 border border-success/20 rounded text-success font-semibold">
                        <TrendingUp className="h-3 w-3" />
                        <span data-testid={`gain-${index}`}>
                          +{gain.toFixed(0)}% since then
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
