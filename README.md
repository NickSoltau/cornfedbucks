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
