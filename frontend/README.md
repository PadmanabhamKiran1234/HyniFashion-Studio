# Hyni Fashion Studio Frontend

React + Vite storefront and admin UI connected to the supplied Express/MongoDB backend.

See [BACKEND_CONNECTION.md](./BACKEND_CONNECTION.md) for setup, environment variables, seed commands, run instructions, and known backend API gaps.

```bash
npm install
npm run dev
```

The production build generates a sitemap and route-specific metadata pages for
the public storefront routes. Set `VITE_SITE_URL` to the canonical production
origin when building; it defaults to `https://www.hynifashionstudio.com`.
