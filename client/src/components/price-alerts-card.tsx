import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bell, Trash2, Plus, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

type PriceAlert = {
  id: number;
  targetPrice: string;
  isActive: boolean;
  triggered: boolean;
};

export default function PriceAlertsCard() {
  const [newAlertPrice, setNewAlertPrice] = useState("");
  const { toast } = useToast();

  const { data: alerts = [], isLoading } = useQuery<PriceAlert[]>({
    queryKey: ['/api/alerts'],
  });

  const createMutation = useMutation({
    mutationFn: async (targetPrice: string) => {
      const response = await apiRequest('POST', '/api/alerts', {
        targetPrice,
        isActive: true,
        triggered: false,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/alerts'] });
      setNewAlertPrice("");
      toast({
        title: "Alert created",
        description: "You'll be notified when Bitcoin reaches this price",
      });
    },
    onError: () => {
      toast({
        title: "Failed to create alert",
        description: "Please try again",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/alerts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/alerts'] });
      toast({
        title: "Alert deleted",
        description: "Price alert has been removed",
      });
    },
  });

  const handleCreateAlert = (e: React.FormEvent) => {
    e.preventDefault();
    const price = parseFloat(newAlertPrice);
    if (isNaN(price) || price <= 0) {
      toast({
        title: "Invalid price",
        description: "Please enter a valid price",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate(newAlertPrice);
  };

  return (
    <Card className="stat-card">
      <CardHeader>
        <CardTitle className="flex items-center text-lg">
          <Bell className="h-5 w-5 mr-2 text-primary" />
          Price Alerts
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleCreateAlert} className="mb-4">
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="Target price (USD)"
              value={newAlertPrice}
              onChange={(e) => setNewAlertPrice(e.target.value)}
              className="flex-1"
              min="0"
              step="0.01"
              data-testid="input-alert-price"
            />
            <Button
              type="submit"
              size="sm"
              disabled={createMutation.isPending}
              data-testid="button-create-alert"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>
        </form>

        <div className="space-y-2">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading alerts...</p>
          ) : alerts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No price alerts yet. Create one to get notified!
            </p>
          ) : (
            alerts.map((alert) => (
              <div
                key={alert.id}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  alert.triggered
                    ? 'bg-success/10 border-success/20'
                    : 'bg-secondary border-border'
                }`}
                data-testid={`alert-${alert.id}`}
              >
                <div className="flex items-center space-x-3">
                  {alert.triggered ? (
                    <CheckCircle2 className="h-5 w-5 text-success" />
                  ) : (
                    <Bell className="h-5 w-5 text-muted-foreground" />
                  )}
                  <div>
                    <div className="font-mono font-semibold">
                      ${parseFloat(alert.targetPrice).toLocaleString()}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {alert.triggered ? 'Triggered!' : 'Active'}
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteMutation.mutate(alert.id)}
                  disabled={deleteMutation.isPending}
                  className="h-8 px-2 hover:bg-destructive/10 hover:text-destructive"
                  data-testid={`button-delete-alert-${alert.id}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </div>

        {alerts.some(a => a.triggered) && (
          <div className="mt-4 p-3 bg-success/10 border border-success/20 rounded-lg">
            <p className="text-sm text-success">
              <strong>Alerts triggered!</strong> Bitcoin has reached one or more of your target prices.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
