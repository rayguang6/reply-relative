# 胡言乱语文学 (Reply Relative)

Next.js app for the CNY “relative defense” chat: configurable persona vs relative, style-based replies via DeepSeek.

## Setup

1. Install: `npm install`
2. Copy env: `cp .env.example .env.local` and set `DEEPSEEK_API_KEY`
3. Run: `npm run dev` → http://localhost:3000

## Deploy

- Build: `npm run build`
- Start: `npm run start`
- Set `DEEPSEEK_API_KEY` in your host’s environment (Vercel, Railway, etc.).

## Structure

- `app/page.tsx` – main UI (client component)
- `app/globals.css` – global styles and animations
- `app/api/chat/route.ts` – chat completion (DeepSeek)
- `app/api/tweak/route.ts` – rewrite/tweak reply
- `lib/constants.ts` – style definitions and config helpers

API key is only used on the server (API routes), not in the browser.
