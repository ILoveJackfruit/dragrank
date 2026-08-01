# CLAUDE.md

## What this is

DragRank helps Drag Race fans figure out their favorite queens among
hundreds across all franchises. Flow: pick up to 5 anchor favorites →
rate queens one by one from a smart-sorted deck → settle the order in a
head-to-head round → get a Top 10/20 plus a one-line taste summary.

Live at https://ilovejackfruit.github.io/dragrank/ (friends use this
link). **Every push to `main` deploys it ~1 min later** — GitHub Pages
serves the `docs/` folder. Don't push without the owner's OK.

## Architecture (deliberately simple — keep it that way)

- Vanilla JS + HTML + CSS in `docs/`, no build step, no framework, no
  dependencies. She explicitly rejected React/Next/Tailwind. Don't add
  tooling.
- `app.py` is a 10-line Flask server for local dev only (`python
  app.py` → localhost:5002). It serves the same `docs/` folder Pages
  publishes — local and live are identical files.
- All state lives in the browser's localStorage (`dragrank_state`).
  Nothing server-side, each user's ratings are their own.
- `docs/data/queens.js`: 288 hand-curated queens (there is no Drag Race
  API). Full rosters US S1-16 + All Stars, UK S1-7, Canada S1-6, Brasil
  S1-2; lighter elsewhere. Each entry: id, name, franchise, seasons
  (with placement), 2-3 style tags, iconicScore (winner ≥ 6, runner-up
  ≥ 5 floors), image + wikiUrl fetched from the Fandom wiki's MediaWiki
  API (batch query, redirect-following — never hand-guess those URLs).
- `docs/script.js`: all logic. Key functions: `pairSimilarity` (tag
  overlap ×2, shared season ×3, same franchise +6, year proximity
  +3/+2/+1), `combinedScore` (0.35 × iconicScore + 0.65 × signed
  average of the 5 rated queens most similar to the candidate — NOT a
  single closest match and NOT an average over everything; both were
  tried and failed on her real data), tournament = binary insertion
  sort capped at a settled top 20, resumable from localStorage.
- Layout is mobile-first; a single `@media (min-width: 700px)` block at
  the end of `style.css` restores a contained desktop look. Same DOM
  both ways — never fork markup per breakpoint.

## About the owner

Product manager, not an engineer, vibecodes for fun. Explain what's
happening in plain language (user action → what the code does → what
comes back), define jargon on first use, say what a command does before
running it. Surgical changes only, simplicity over cleverness, ask
rather than guess. She decides product questions — don't bury them
inside refactors.

## Her tone of voice (for all UI copy and docs she'd sign)

- Em dashes: never. Use commas, colons, parentheses, or rewrite.
- Short direct sentences, common words, contractions.
- Nuance goes in parentheses, the main sentence stays clean.
- No hedging, no filler openers, no corporate polish.
- Markers she actually uses: "etc etc", "honestly", direct questions.
- Banned: AI-sounding words (seamless, effortless, delve, journey,
  robust, leverage, unlock...) and "not just X, but Y" constructions.
- The README is the reference example of her register.

## Lessons that cost real time (don't relearn them)

1. **Verify UI visually before claiming it works.** Headless Chrome +
   playwright-core driving the real app, real screenshots at 390×844
   and 1280×900. CSS reasoning alone shipped wrong three times.
2. **Any cropped photo needs explicit `object-position`** (top-biased,
   faces live in the top of promo shots). Default center-crop cuts
   heads off on some photos and not others, so it hides in spot checks.
3. Container aspect ratio controls crop tightness; `transform: scale`
   zooms beyond it. Two independent levers, don't conflate.
4. **Recommendation complaints: get her real rating history first**
   (paste of `localStorage.dragrank_state`), reproduce, then tune.
   Guessing weights from a described symptom failed three times in a
   row before real data found the actual cause in one pass.
5. Visual direction: if her feedback is vague, ask what specifically is
   wrong or build 2-3 side-by-side options with real data. Guessing a
   whole direction from adjectives missed repeatedly.

## What she wants next

- **A redesign.** She's said so explicitly — the current look (dark
  plum background, Pantone berry/violet/red-violet type colors, flat
  squares, no borders or rounded corners, photos dominating mobile) is
  round 11 of iteration and still not where she wants it. Ask what's
  not working before proposing; expect to prototype options.
- **Better photos.** Fandom thumbnails cap out around 400-500px; the
  full-bleed mobile layout wants ~780px+. First try: re-run the batch
  fetch with `pithumbsize=1280`, watch payload sizes. Real upgrade:
  per-season promo galleries on the wiki.
- Maybe: drag horoscope (astrology-framed taste read; the existing
  `summarizeTaste` already covers the substance), ranking below #20,
  more franchises' full rosters.
