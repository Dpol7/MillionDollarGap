# Overview

This is a Bitcoin price tracking application that displays real-time Bitcoin data and milestone tracking toward the $1 million price point. The application fetches data from the CoinGecko API and provides two versions: a full-featured dashboard (Version 1) and a simplified tracker (Version 2).

## Recent Updates (October 2, 2025)

**Latest Changes:**
1. **Two-Version System**: Users can switch between a full dashboard (Version 1) and a simplified tracker (Version 2) using header navigation tabs
   - Version 1: Full dashboard with all sections (stats, milestones, market overview, Bitcoin obituaries, poll)
   - Version 2: Simplified tracker with core sections only (stats, milestones, poll)
2. **Removed Features**: Removed "Fun Fact" section from Market Stats card for cleaner design
3. **Community Poll**: "When will Bitcoin hit $1M?" poll with PostgreSQL storage, 8 predefined options, vote distribution visualization, and duplicate prevention
4. **Bitcoin Obituaries**: Historical "Bitcoin is Dead" predictions showing how wrong skeptics were
5. **Simplified UI**: Removed historical charts and price alerts to focus on core tracking features

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture

**Technology Stack**: React with TypeScript, using Vite as the build tool and development server. The UI is built with shadcn/ui components (Radix UI primitives) and styled with Tailwind CSS.

**Routing**: Wouter for lightweight client-side routing with two main versions:
- `/` - Version 1 (Full dashboard with all sections)
- `/v2` - Version 2 (Simplified tracker with core sections only)
- Navigation tabs in header allow users to switch between versions on all devices

**State Management**: TanStack Query (React Query) for server state management, handling data fetching, caching, and automatic refetching. No global client state management library is used - component state is managed locally with React hooks.

**Component Structure**:
- Page components in `client/src/pages/` (home, home-v2, not-found)
- Feature components in `client/src/components/` (stats-cards, market-stats-card, milestones-card, bitcoin-obituaries-card, million-dollar-poll)
- Reusable UI components in `client/src/components/ui/` (shadcn/ui component library)
- Custom hooks in `client/src/hooks/` (use-toast, use-mobile)

**Version Differences**:
- Version 1 (`home.tsx`): Full dashboard with Distance Stats, Milestones, Market Overview, Bitcoin Obituaries, and Poll
- Version 2 (`home-v2.tsx`): Simplified tracker with Distance Stats, Milestones, and Poll only

**Design Pattern**: The frontend follows a component-based architecture with separation of concerns. API logic is abstracted into `lib/bitcoin-api.ts`, query configuration in `lib/queryClient.ts`, and utility functions in `lib/utils.ts`.

## Backend Architecture

**Server Framework**: Express.js running on Node.js with TypeScript.

**API Design**: RESTful API endpoints:
- `GET /api/bitcoin/price` - Returns current Bitcoin price and market data
- `GET /api/poll/results` - Returns poll vote distribution
- `POST /api/poll/vote` - Submit a poll vote (validates against 8 predefined options)

**Development vs Production**: In development mode, Vite middleware is integrated for HMR (Hot Module Replacement). In production, the server serves static files from the built frontend.

**Caching Strategy**: In-memory caching implemented through `MemStorage` class to reduce external API calls. Current price and historical data are cached with different time-to-live values to optimize API usage while maintaining data freshness.

**Error Handling**: Centralized error handling with custom logging middleware that captures request/response cycles and logs API interactions.

## Data Storage

**Primary Storage**: In-memory storage (`MemStorage` class) for caching Bitcoin price data and historical price points. This is a temporary caching layer, not persistent storage.

**Database Schema**: PostgreSQL database with Drizzle ORM:
- `poll_votes` table with fields: id (serial), prediction (text - enum validated), createdAt (timestamp)
- Stores community predictions for when Bitcoin will hit $1M
- 8 valid options: "2025", "2026", "2027", "2028", "2029", "2030", "2030+", "Never"

**Poll System**: 
- Users vote on when Bitcoin will reach $1M
- Backend validates votes using Zod enum schema to prevent invalid predictions
- Vote distribution shown as percentages with visual bars
- Duplicate voting prevented via localStorage

## External Dependencies

**CoinGecko API**: Primary data source for Bitcoin price information. The application uses these endpoints:
- `/api/v3/simple/price` - For current price, market cap, volume, and 24h change
- `/api/v3/coins/bitcoin` - For additional Bitcoin data like circulating supply and all-time high

**API Authentication**: Supports optional API key via `COINGECKO_API_KEY` or `API_KEY` environment variable, sent as `x-cg-demo-api-key` header.

**Rate Limiting Considerations**: The in-memory caching strategy helps minimize API calls. Frontend implements automatic refetching every 30 seconds for current price and 5 minutes for historical data.

**Data Transformation**: Data is validated using Zod schemas defined in `shared/schema.ts`:
- `bitcoinPriceSchema` - Bitcoin specific data structure with price, market cap, volume, and stats
- `pollPredictionSchema` - Enum validation for the 8 valid poll options
- `insertPollVoteSchema` - Poll vote creation validation
- Ensures type safety and data integrity between frontend and backend

## Third-Party UI Libraries

**shadcn/ui**: Component library built on Radix UI primitives, configured with "new-york" style and neutral base color theme.

**Tailwind CSS**: Utility-first CSS framework with custom design tokens for colors, spacing, and typography. Responsive design with mobile-first approach.

## Build and Deployment

**Development**: `npm run dev` runs TypeScript server with tsx and Vite dev server with HMR.

**Production Build**: 
- Frontend built with Vite to `dist/public`
- Backend bundled with esbuild to `dist/index.js` as ESM module
- Single build command handles both frontend and backend

**Type Checking**: TypeScript strict mode enabled with path aliases for clean imports (`@/`, `@shared/`, `@assets/`).