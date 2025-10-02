import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchBitcoinPrice, fetchHistoricalData, calculateDistanceFromMillion } from "@/lib/bitcoin-api";
import { TimeRange } from "@shared/schema";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceDot, Label } from "recharts";
import { Download } from "lucide-react";
import html2canvas from "html2canvas";
import { useToast } from "@/hooks/use-toast";

const timeRanges: { value: TimeRange; label: string }[] = [
  { value: '24h', label: '24H' },
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
  { value: '1y', label: '1Y' },
  { value: 'all', label: 'ALL' },
];

export default function BitcoinChart() {
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange>('24h');
  const [isExporting, setIsExporting] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const { data: bitcoinPrice } = useQuery<any>({
    queryKey: ['/api/bitcoin/price'],
    refetchInterval: 30000,
  });

  const { data: historicalData, isLoading, error } = useQuery({
    queryKey: ['/api/bitcoin/historical', selectedTimeRange],
    queryFn: () => fetchHistoricalData(selectedTimeRange),
    refetchInterval: 300000,
  });

  const chartData = historicalData?.map(point => ({
    timestamp: point.timestamp,
    date: new Date(point.timestamp).toLocaleDateString(),
    time: new Date(point.timestamp).toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    }),
    distance: calculateDistanceFromMillion(point.price),
    price: point.price,
  })) || [];

  const athDistance = bitcoinPrice?.allTimeHigh ? calculateDistanceFromMillion(bitcoinPrice.allTimeHigh) : null;
  
  const athPoint = chartData.length > 0 && athDistance !== null 
    ? chartData.reduce((closest, point) => {
        const currentDiff = Math.abs(point.distance - athDistance);
        const closestDiff = Math.abs(closest.distance - athDistance);
        return currentDiff < closestDiff ? point : closest;
      }, chartData[0])
    : null;

  const formatXAxisLabel = (timestamp: number) => {
    const date = new Date(timestamp);
    if (selectedTimeRange === '24h') {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } else if (selectedTimeRange === '7d' || selectedTimeRange === '30d') {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    }
  };

  const formatTooltipValue = (value: number) => {
    return `$${value.toLocaleString('en-US', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    })}`;
  };

  const handleExportChart = async () => {
    if (!chartRef.current) return;
    
    setIsExporting(true);
    try {
      const canvas = await html2canvas(chartRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
      });
      
      const link = document.createElement('a');
      link.download = `bitcoin-chart-${selectedTimeRange}-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      
      toast({
        title: "Chart exported",
        description: "Your chart has been downloaded as an image",
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Export failed",
        description: "Could not export chart. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Card className="stat-card" ref={chartRef}>
      <CardContent className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 space-y-4 sm:space-y-0">
          <div>
            <h3 className="text-xl font-bold mb-1">Historical Distance from $1M</h3>
            <p className="text-sm text-muted-foreground">Track how the gap has changed over time</p>
          </div>

          <div className="flex items-center gap-2">
            {/* Export Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportChart}
              disabled={isExporting || isLoading}
              className="px-3"
              data-testid="button-export-chart"
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>

            {/* Time Range Selector */}
            <div className="flex items-center space-x-2 bg-secondary rounded-lg p-1">
              {timeRanges.map(({ value, label }) => (
                <Button
                  key={value}
                  variant={selectedTimeRange === value ? "default" : "ghost"}
                  size="sm"
                  className={`px-3 py-1.5 text-sm font-medium transition-all ${
                    selectedTimeRange === value 
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90' 
                      : 'hover:bg-muted'
                  }`}
                  onClick={() => setSelectedTimeRange(value)}
                  data-testid={`button-timerange-${value}`}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Chart Container */}
        <div className="h-[400px] md:h-[500px]">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Skeleton className="h-8 w-48 mx-auto mb-4" />
                <Skeleton className="h-64 w-full" />
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-muted-foreground">
                <p className="text-lg font-semibold mb-2">Failed to load chart data</p>
                <p className="text-sm">
                  {error instanceof Error ? error.message : 'Please try refreshing the page'}
                </p>
              </div>
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-muted-foreground">
                <p className="text-lg font-semibold mb-2">No data available</p>
                <p className="text-sm">Historical data for this time range is not available</p>
              </div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(217, 33%, 17%)" />
                <XAxis 
                  dataKey="timestamp"
                  tickFormatter={formatXAxisLabel}
                  stroke="hsl(215, 20%, 65%)"
                  fontSize={11}
                  fontFamily="JetBrains Mono"
                />
                <YAxis 
                  tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`}
                  stroke="hsl(215, 20%, 65%)"
                  fontSize={11}
                  fontFamily="JetBrains Mono"
                />
                <Tooltip 
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
                          <p className="text-sm text-muted-foreground mb-1">
                            {selectedTimeRange === '24h' ? data.time : data.date}
                          </p>
                          <p className="font-semibold">
                            Distance: {formatTooltipValue(data.distance)}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            BTC Price: {formatTooltipValue(data.price)}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="distance" 
                  stroke="hsl(217, 91%, 60%)"
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 6, stroke: "hsl(217, 91%, 60%)", strokeWidth: 2, fill: "hsl(222, 47%, 5%)" }}
                />
                {athPoint && athDistance !== null && (
                  <>
                    <ReferenceLine 
                      y={athDistance} 
                      stroke="hsl(28, 92%, 54%)"
                      strokeDasharray="5 5"
                      strokeWidth={2}
                    >
                      <Label 
                        value={`ATH: $${bitcoinPrice?.allTimeHigh.toLocaleString()}`}
                        position="insideTopRight"
                        fill="hsl(28, 92%, 54%)"
                        fontSize={12}
                        fontWeight="bold"
                      />
                    </ReferenceLine>
                    <ReferenceDot
                      x={athPoint.timestamp}
                      y={athPoint.distance}
                      r={6}
                      fill="hsl(28, 92%, 54%)"
                      stroke="hsl(222, 47%, 5%)"
                      strokeWidth={2}
                      data-testid="ath-marker"
                    />
                  </>
                )}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Chart Legend */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-6 text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-gradient-to-r from-accent to-primary"></div>
            <span className="text-muted-foreground">Distance from $1M (USD)</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-primary"></div>
            <span className="text-muted-foreground">All-Time High (ATH)</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full border-2 border-success"></div>
            <span className="text-muted-foreground">Decreasing (Getting Closer)</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full border-2 border-destructive"></div>
            <span className="text-muted-foreground">Increasing (Moving Away)</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
