import { BitcoinPrice } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Circle } from "lucide-react";

interface MilestonesCardProps {
  bitcoinPrice?: BitcoinPrice;
}

const milestones = [
  { price: 50000, percentage: 5 },
  { price: 100000, percentage: 10 },
  { price: 250000, percentage: 25 },
  { price: 500000, percentage: 50 },
  { price: 750000, percentage: 75 },
];

export default function MilestonesCard({ bitcoinPrice }: MilestonesCardProps) {
  const currentPrice = bitcoinPrice?.price || 0;

  const formatDistance = (milestonePrice: number) => {
    const distance = milestonePrice - currentPrice;
    if (distance <= 0) return "Reached";
    
    if (distance >= 1000) {
      return `$${(distance / 1000).toFixed(1)}K away`;
    }
    return `$${distance.toFixed(0)} away`;
  };

  return (
    <Card className="stat-card">
      <CardContent className="p-6">
        <h3 className="text-lg font-bold mb-4 flex items-center">
          <CheckCircle className="h-5 w-5 mr-2 text-primary" />
          Key Milestones
        </h3>
        <div className="space-y-4">
          {milestones.map((milestone, index) => {
            const isReached = currentPrice >= milestone.price;
            const distance = formatDistance(milestone.price);
            
            return (
              <div 
                key={milestone.price}
                className={`flex items-center justify-between py-3 ${
                  index < milestones.length - 1 ? 'border-b border-border' : ''
                }`}
                data-testid={`milestone-${milestone.price}`}
              >
                <div className="flex items-center space-x-3">
                  {isReached ? (
                    <CheckCircle className="h-5 w-5 text-success" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground" />
                  )}
                  <div>
                    <div className="font-medium">
                      ${milestone.price.toLocaleString()}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {milestone.percentage}% to target
                    </div>
                  </div>
                </div>
                <Badge 
                  variant={isReached ? "default" : "secondary"}
                  className={
                    isReached 
                      ? "bg-success/10 text-success border-success/20 hover:bg-success/20" 
                      : "bg-muted text-muted-foreground"
                  }
                >
                  {distance}
                </Badge>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
