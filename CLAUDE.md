# Cornfed Bucks

Astro static site for cornfedbucks.com — field reports and ground-level whitetail
strategy for Midwest row-crop hunters (Ohio, Michigan, Indiana, Iowa, Illinois,
Minnesota, Wisconsin, plus occasional coverage of Arkansas, Pennsylvania, and
other states). Written by Nick, a working hunter covering ag-lease country.
Monetized via Amazon Associates / affiliate links and a beehiiv newsletter
("The Monday Morning Report").

## Workflow

Content (post copy, hero images, any new components) is drafted in a separate
project, not in this repo or this session. The typical ask here is: given a
prompt plus a location/set of files, wire them into this repo correctly —
frontmatter, image placement, cross-links, tag taxonomy — then commit and push
so Cloudflare Pages picks it up. This session's job is integration and
publishing, not first-draft content creation, so default to matching existing
conventions exactly rather than introducing new ones.

## Stack

- **Astro 7** (content collections + MDX), static output to `dist/`.
- Deployed to **Cloudflare Pages**: pushing to `main` on GitHub triggers an
  automatic build and deploy (build command `npm run build`, output `dist`).
  `wrangler.jsonc` exists for local/Workers tooling but the day-to-day deploy
  path is just `git push`.
- No test suite, linter, or CI configured — `npm run dev` / `npm run build`
  are the only checks available.

```bash
npm install
npm run dev      # local dev server
npm run build    # output to dist/
npm run preview  # preview the production build
```

## Content model

Blog posts live in `src/content/blog/` as `.md` or `.mdx`, schema defined in
[src/content.config.ts](src/content.config.ts):

```yaml
---
title: "Your Title"
description: "One sentence summary."
pubDate: 2026-10-01
fieldNote: "FIELD NOTE NO. 030"
tags: ["cartridges-ammo", "buying-guide"]
---
```

`fieldNote` is a free-text label rendered as the post's eyebrow and used for
sort order (see `fieldNoteNum` in [src/pages/blog/index.astro](src/pages/blog/index.astro)).
Two content types share this field:

- **`FIELD NOTE NO. 0XX`** — regular tactics/gear/land content (prefix `FN` in
  commit messages and image filenames, e.g. `fn029-*`).
- **`SPECIAL REPORT NO. 00X`** — regulation/legal-news pieces, numbered in
  their own separate sequence (prefix `SR`, e.g. `sr004-*`).

Check `git log --oneline` or the existing frontmatter for the next number in
each sequence before adding a post — there's no other source of truth.

### Tags

Tags are a **closed vocabulary** (see commit `984ee8e`, "Standardize tag
taxonomy across all posts") — don't invent new topic tags without a reason.
Current facets, mixed freely on a single post:

- **Topic:** `bowhunting`, `cartridges-ammo`, `buying-guide`, `shotguns`,
  `slugs`, `deer-biology`, `tactics-scouting`, `land-management`,
  `optics-gear`, `regulations-law`, `youth`, `muzzleloader`
- **Cartridge:** `350-legend`, `400-legend`, `450-bushmaster`,
  `360-buckhammer`, `45-70`
- **State:** lowercase state names, e.g. `ohio`, `michigan`, `indiana`,
  `iowa`, `illinois`, `minnesota`, `wisconsin`, `arkansas`, `pennsylvania`,
  `tennessee`, `west-virginia`, `maryland`, `delaware`

### Hero images

Each post typically has a hero image pair at `public/images/{fn|sr}0XX-slug.{jpg,webp}`,
wrapped in a `<figure class="field-note-hero">` with `<picture>`/`<source>` for
the webp and captioned "AI-generated illustration." Image generation itself
happens outside this repo — not something to reproduce in a session.

### Cross-linking

New posts commonly link back to related existing posts (and existing posts get
a follow-up commit adding a link forward to the new one) — see commit history
for the pattern, e.g. `9ff3708 Publish FN029 ... + cross-link from FN028`.
The `public/llms.txt` file lists the handful of pillar/core guides and should
be updated if a new post becomes one of those anchor pages.

## Components

Reusable pieces in `src/components/`:

- `ArticleCard.astro` — blog index card
- `FaqSchema.astro` — emits FAQPage JSON-LD; pass `items: {question, answer}[]`
- `SpecTable.astro`, `CartridgeCard.astro` — cartridge/gear comparison tables
- `DecisionTree.astro`, `ReticleDecisionTree.astro` — interactive decision-tree UI
- `ZoneMapEmbed.astro`, `ArkansasZoneLocator.astro` — regulation zone maps
- `NewsletterSignup.astro` — embedded beehiiv form (publication settings live
  in the beehiiv dashboard, not in code)

## Site structure

- `src/pages/` — static pages (`about`, `privacy-policy`, `terms-of-service`,
  `affiliate-disclosure`, `zone-map`, `thanks`) plus `blog/index.astro` (listing)
  and `blog/[slug].astro` (post template, driven entirely by content collection
  frontmatter).
- `src/layouts/Layout.astro` — global shell: header/nav, footer with affiliate
  disclosure + legal links, canonical URL, beehiiv attribution script.
- `astro.config.mjs` — `site: 'https://cornfedbucks.com'`, `trailingSlash: 'always'`
  (matters for canonical URLs and internal links — always link with a trailing slash).

## Conventions

- Posts are written in first person as "Nick," sign off with "Until next time.\nNick"
  on longer/report-style pieces.
- Tone: practical, working-hunter voice — not generic outdoor-content filler.
  Calls out uncertainty explicitly rather than guessing (see the Illinois
  FireStick caveat in `firestick-nitrofire-muzzleloader-legality-2026.mdx`).
- Regulation/legal posts should be treated as time-sensitive and flagged for
  follow-up if a decision is pending (see SR004's "we'll update this report"
  pattern).
