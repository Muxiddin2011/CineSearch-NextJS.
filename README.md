# CineSearch — Next.js + TypeScript + TMDB API

CineSearch is built with Next.js App Router, React, and TypeScript. The page and layout use `.tsx`, and the TMDB server endpoint uses `.ts`. CSS lives in `app/globals.css`.

## Requirements
- Node.js 18.17 or newer
- A TMDB Read Access Token

## Run locally
1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env.local`
3. Add your token to `.env.local` as `TMDB_READ_TOKEN=your_tmdb_read_access_token`
4. Start the development server: `npm run dev`
5. Open http://localhost:3000

## Features
- Trending, popular, and upcoming titles
- Search through TMDB
- Discover filters for genre, year, and sorting
- Movie and TV details, cast, budget, revenue, and popularity when TMDB provides them
- Browser-local watchlist and favorites
- Server-side TMDB requests through `/api/movies`; the token is not bundled into client-side code

## TypeScript structure
- `app/page.tsx` — typed React UI and client-side interactions
- `app/layout.tsx` — typed root layout and metadata
- `app/api/movies/route.ts` — typed Next.js API route that calls TMDB on the server
- `tsconfig.json` — TypeScript compiler settings

TMDB's vote count is the number of user ratings, not a movie view counter. Popularity is a TMDB score. Budget and revenue may be unavailable, and revenue minus budget is not net profit. Please follow TMDB attribution and API terms.
