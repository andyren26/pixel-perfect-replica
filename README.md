# Pixel Perfect Replica

Implement exactly the screenshot and nothing else

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/82cf263a-1136-4987-8042-3be1be420013).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Architecture

Plain **Vite + React** single-page app with **React Router** for client-side routing.
There is no server rendering — `npm run build` outputs a static site to `dist/`.

| Path | Page |
| --- | --- |
| `/` | Landing page |
| `/sign-in` | Sign in |
| `/sign-up` | Create account (customer or barber) |
| `/app` | Signed-in home (redirects to `/sign-in` when signed out) |

Routes live in `src/router.tsx`; pages in `src/pages/`.

Supabase is configured through `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (see `.env`).

## Deploying to Vercel

Import the repo in Vercel — the Vite preset is detected automatically. `vercel.json`
sets the output directory to `dist/` and rewrites every path to `index.html`, so deep
links like `/app` load the SPA and React Router resolves them in the browser.
