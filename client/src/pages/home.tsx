import { Card, CardContent } from "@/components/ui/card";

export default function Home() {
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
                <h1 className="text-lg font-bold">Bitcoin Status</h1>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          {/* Section 1 */}
          <Card className="stat-card">
            <CardContent className="p-8 text-center">
              <h2 className="text-2xl sm:text-3xl font-bold mb-4">
                Is Bitcoin $1 Million?
              </h2>
              <p className="text-6xl sm:text-7xl font-bold gradient-text">
                No
              </p>
            </CardContent>
          </Card>

          {/* Section 2 */}
          <Card className="stat-card">
            <CardContent className="p-8 text-center">
              <h2 className="text-2xl sm:text-3xl font-bold mb-4">
                Will Bitcoin reach $1 Million?
              </h2>
              <p className="text-6xl sm:text-7xl font-bold gradient-text">
                Maybe
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
