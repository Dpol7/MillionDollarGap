# Overview

This is a Bitcoin price tracking application that displays real-time Bitcoin data, historical price charts, market statistics, and milestone tracking toward the $1 million price point. The application fetches data from the CoinGecko API and provides an interactive dashboard with multiple time range views (24h, 7d, 30d, 1y, all-time).

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture

**Technology Stack**: React with TypeScript, using Vite as the build tool and development server. The UI is built with shadcn/ui components (Radix UI primitives) and styled with Tailwind CSS.

**Routing**: Wouter for lightweight client-side routing with a simple route structure (home page and 404 fallback).

**State Management**: TanStack Query (React Query) for server state management, handling data fetching, caching, and automatic refetching. No global client state management library is used - component state is managed locally with React hooks.

**Component Structure**:
- Page components in `client/src/pages/` (home, not-found)
- Feature components in `client/src/components/` (bitcoin-chart, stats-cards, market-stats-card, milestones-card)
- Reusable UI components in `client/src/components/ui/` (shadcn/ui component library)
- Custom hooks in `client/src/hooks/` (use-toast, use-mobile)

**Design Pattern**: The frontend follows a component-based architecture with separation of concerns. API logic is abstracted into `lib/bitcoin-api.ts`, query configuration in `lib/queryClient.ts`, and utility functions in `lib/utils.ts`.

## Backend Architecture

**Server Framework**: Express.js running on Node.js with TypeScript.

**API Design**: RESTful API endpoints under `/api/bitcoin/`:
- `GET /api/bitcoin/price` - Returns current Bitcoin price and market data
- `GET /api/bitcoin/historical/:timeRange` - Returns historical price data for specified time range

**Development vs Production**: In development mode, Vite middleware is integrated for HMR (Hot Module Replacement). In production, the server serves static files from the built frontend.

**Caching Strategy**: In-memory caching implemented through `MemStorage` class to reduce external API calls. Current price and historical data are cached with different time-to-live values to optimize API usage while maintaining data freshness.

**Error Handling**: Centralized error handling with custom logging middleware that captures request/response cycles and logs API interactions.

## Data Storage

**Primary Storage**: In-memory storage (`MemStorage` class) for caching Bitcoin price data and historical price points. This is a temporary caching layer, not persistent storage.

**Database Configuration**: Drizzle ORM is configured with PostgreSQL (via `@neondatabase/serverless`) but no schema is currently defined or used. The database setup exists in configuration files but is not actively utilized in the current implementation.

**Future Consideration**: The Drizzle configuration (`drizzle.config.ts`) and shared schema location (`shared/schema.ts`) suggest the application was architected to support database persistence, which could be added for storing historical data, user preferences, or price alerts.

## External Dependencies

**CoinGecko API**: Primary data source for Bitcoin price information. The application uses two main endpoints:
- `/api/v3/simple/price` - For current price, market cap, volume, and 24h change
- `/api/v3/coins/bitcoin` - For additional data like circulating supply and all-time high

**API Authentication**: Supports optional API key via `COINGECKO_API_KEY` or `API_KEY` environment variable, sent as `x-cg-demo-api-key` header.

**Rate Limiting Considerations**: The in-memory caching strategy helps minimize API calls. Frontend implements automatic refetching every 30 seconds for current price and 5 minutes for historical data.

**Data Transformation**: Bitcoin price data is validated using Zod schemas (`bitcoinPriceSchema`, `historicalDataSchema`, `timeRangeSchema`) defined in `shared/schema.ts`, ensuring type safety between frontend and backend.

## Third-Party UI Libraries

**shadcn/ui**: Component library built on Radix UI primitives, configured with "new-york" style and neutral base color theme.

**Recharts**: Charting library used for rendering historical Bitcoin price line charts with responsive containers.

**date-fns**: Date manipulation and formatting utilities.

**Tailwind CSS**: Utility-first CSS framework with custom design tokens for colors, spacing, and typography.

## Build and Deployment

**Development**: `npm run dev` runs TypeScript server with tsx and Vite dev server with HMR.

**Production Build**: 
- Frontend built with Vite to `dist/public`
- Backend bundled with esbuild to `dist/index.js` as ESM module
- Single build command handles both frontend and backend

**Type Checking**: TypeScript strict mode enabled with path aliases for clean imports (`@/`, `@shared/`, `@assets/`).