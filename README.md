# CornfedBucks

A content and affiliate site for Midwest whitetail deer hunting — built,
launched, and operated end-to-end as a solo business project.

🔗 [cornfedbucks.com](https://cornfedbucks.com)

## What this project demonstrates

This isn't a coding exercise — it's a real business I built and run,
covering everything from initial technical buildout to ongoing content
strategy, SEO, and monetization:

- **Full site build** — scaffolded from scratch with Astro, including a
  custom design system and content collection structure
- **Monetization** — affiliate partnerships (Cabela's, Bass Pro via Impact
  Radius) and email list growth via Beehiiv
- **Content strategy & SEO/GEO** — ongoing optimization for both
  traditional search and AI-driven search (ChatGPT, Perplexity, Gemini)
- **Competitive research** — tracking positioning against established
  outdoor media (MeatEater, Wired to Hunt, National Deer Association)
- **Distribution** — Pinterest and Facebook channels for traffic
- **Deployment** — Cloudflare Pages with custom domain configuration

## A note on how this was built

I used AI-assisted development (Claude Code) heavily throughout this
project — both for the technical build and for content workflows. This
was a deliberate choice: it let me move fast on a solo project while
learning to work effectively with AI tooling as part of my development
process, which I see as an increasingly important skill rather than a
shortcut.

For code samples that reflect my hands-on React/JavaScript work, see
[Skinstric](https://github.com/NickSoltau/Skinstric) and
[craftDesk](https://github.com/NickSoltau/craftDesk).

## Tech stack

- Astro
- Cloudflare Pages
- Beehiiv (email)
- Impact Radius (affiliate tracking)

# Cornfed Bucks

Astro static site for cornfedbucks.com — field reports and ground-level
whitetail strategy for Midwest row-crop hunters.

## Local development

```
npm install
npm run dev
```

## Build

```
npm run build
```

Output goes to `dist/`.

## Adding a new field note

Add a new `.md` file to `src/content/blog/` with this frontmatter:

```yaml
---
title: "Your Title"
description: "One sentence summary."
pubDate: 2026-10-01
fieldNote: "FIELD NOTE NO. 004"
tags: ["scouting"]
---
```

Then write the post body in Markdown below the frontmatter.

## Deploying to Cloudflare Pages

1. Push this repo to GitHub.
2. In Cloudflare: Workers & Pages -> Create application -> Pages -> Connect to Git.
3. Build command: `npm run build`
4. Output directory: `dist`
5. Add `cornfedbucks.com` and `www.cornfedbucks.com` as custom domains once deployed.
