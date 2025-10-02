# Overview

This is a Bitcoin price tracking application that displays real-time Bitcoin data, historical price charts, market statistics, and milestone tracking toward the $1 million price point. The application fetches data from the CoinGecko API and provides an interactive dashboard with multiple time range views (24h, 7d, 30d, 1y, all-time).

## Recent Updates (October 2, 2025)

**New Features Added:**
1. **Percentage-Based View Toggle**: Users can switch between dollar distance and percentage progress views using toggle buttons with visual icons (DollarSign/Percent)
2. **Historical ATH Markers**: Chart displays all-time high price markers with orange dashed reference lines and labels
3. **Price Alerts System**: Complete alert management with PostgreSQL persistence - users can create, view, and delete price alerts; background checking triggers alerts when targets are reached
4. **Multi-Cryptocurrency Comparison**: Side-by-side comparison of BTC, ETH, and BNB showing their respective distances and progress toward $1M
5. **Chart Export/Snapshot**: Users can download chart as PNG image for social media sharing using html2canvas library

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture

**Technology Stack**: React with TypeScript, using Vite as the build tool and development server. The UI is built with shadcn/ui components (Radix UI primitives) and styled with Tailwind CSS.

**Routing**: Wouter for lightweight client-side routing with a simple route structure (home page and 404 fallback).

**State Management**: TanStack Query (React Query) for server state management, handling data fetching, caching, and automatic refetching. No global client state management library is used - component state is managed locally with React hooks.

**Component Structure**:
- Page components in `client/src/pages/` (home, not-found)
- Feature components in `client/src/components/` (bitcoin-chart, stats-cards, market-stats-card, milestones-card, price-alerts-card, crypto-comparison-card)
- Reusable UI components in `client/src/components/ui/` (shadcn/ui component library)
- Custom hooks in `client/src/hooks/` (use-toast, use-mobile)

**Design Pattern**: The frontend follows a component-based architecture with separation of concerns. API logic is abstracted into `lib/bitcoin-api.ts`, query configuration in `lib/queryClient.ts`, and utility functions in `lib/utils.ts`.

## Backend Architecture

**Server Framework**: Express.js running on Node.js with TypeScript.

**API Design**: RESTful API endpoints:
- `GET /api/bitcoin/price` - Returns current Bitcoin price and market data
- `GET /api/bitcoin/historical/:timeRange` - Returns historical price data for specified time range
- `GET /api/crypto/prices` - Returns BTC, ETH, BNB prices with distance and progress calculations
- `GET /api/alerts` - Fetch all price alerts
- `POST /api/alerts` - Create new price alert
- `DELETE /api/alerts/:id` - Delete price alert
- `PATCH /api/alerts/:id` - Update alert triggered status

**Development vs Production**: In development mode, Vite middleware is integrated for HMR (Hot Module Replacement). In production, the server serves static files from the built frontend.

**Caching Strategy**: In-memory caching implemented through `MemStorage` class to reduce external API calls. Current price and historical data are cached with different time-to-live values to optimize API usage while maintaining data freshness.

**Error Handling**: Centralized error handling with custom logging middleware that captures request/response cycles and logs API interactions.

## Data Storage

**Primary Storage**: In-memory storage (`MemStorage` class) for caching Bitcoin price data and historical price points. This is a temporary caching layer, not persistent storage.

**Database Schema**: PostgreSQL database with Drizzle ORM actively used for price alerts:
- `price_alerts` table with fields: id (serial), targetPrice (numeric), isActive (boolean), triggered (boolean), createdAt (timestamp)
- Stores user-created price alert targets
- Background checking system updates triggered status when Bitcoin price reaches target

**Price Alert System**: 
- Users create alerts via UI with target price
- Server checks alerts against current price during each price fetch
- Alerts marked as triggered when target is reached
- Console logs notify when alerts trigger
- Full CRUD operations supported (Create, Read, Delete, Update)

## External Dependencies

**CoinGecko API**: Primary data source for cryptocurrency price information. The application uses these endpoints:
- `/api/v3/simple/price` - For current price, market cap, volume, and 24h change (supports multiple coins)
- `/api/v3/coins/bitcoin` - For additional Bitcoin data like circulating supply and all-time high
- Multi-crypto support for BTC, ETH, and BNB price tracking

**API Authentication**: Supports optional API key via `COINGECKO_API_KEY` or `API_KEY` environment variable, sent as `x-cg-demo-api-key` header.

**Rate Limiting Considerations**: The in-memory caching strategy helps minimize API calls. Frontend implements automatic refetching every 30 seconds for current price and 5 minutes for historical data.

**Data Transformation**: Price data is validated using Zod schemas defined in `shared/schema.ts`:
- `bitcoinPriceSchema` - Bitcoin specific data structure
- `cryptoPriceSchema` - Multi-crypto data with distance and progress calculations  
- `historicalDataSchema` - Time-series price data
- `timeRangeSchema` - Valid time range values
- `insertPriceAlertSchema` - Price alert creation validation
- Ensures type safety between frontend and backend

## Third-Party UI Libraries

**shadcn/ui**: Component library built on Radix UI primitives, configured with "new-york" style and neutral base color theme.

**Recharts**: Charting library used for rendering historical Bitcoin price line charts with responsive containers. Supports reference lines and dots for ATH markers.

**html2canvas**: DOM-to-image conversion library for chart export/snapshot feature. Captures chart as PNG with 2x scaling for high quality.

**date-fns**: Date manipulation and formatting utilities.

**Tailwind CSS**: Utility-first CSS framework with custom design tokens for colors, spacing, and typography.

## Build and Deployment

**Development**: `npm run dev` runs TypeScript server with tsx and Vite dev server with HMR.

**Production Build**: 
- Frontend built with Vite to `dist/public`
- Backend bundled with esbuild to `dist/index.js` as ESM module
- Single build command handles both frontend and backend

**Type Checking**: TypeScript strict mode enabled with path aliases for clean imports (`@/`, `@shared/`, `@assets/`).