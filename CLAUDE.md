# CLAUDE.md

## What this is

DragRank helps Drag Race fans figure out their favorite queens among
hundreds across all franchises. Flow: pick up to 5 anchor favorites →
rate queens one by one from a smart-sorted deck → settle the order in a
head-to-head round → get a Top 10/20 plus a one-line taste summary.

Live at https://ilovejackfruit.github.io/dragrank/ (friends use this
link, already shared). **Every push to `main` deploys it ~1 min
later** — GitHub Pages serves the `docs/` folder. Don't push without
the owner's OK; she reviews locally first (`python app.py` →
localhost:5002 — same files as Pages) unless she's clearly said "ship
it" already.

## Architecture (deliberately simple — keep it that way)

- Vanilla JS + HTML + CSS in `docs/`, no build step, no framework, no
  dependencies. She explicitly rejected React/Next/Tailwind. Don't add
  tooling.
- `app.py` is a 10-line Flask server for local dev only. Serves the
  same `docs/` folder Pages publishes — local and live are identical.
- All state lives in the browser's localStorage (`dragrank_state`).
  Nothing server-side; each user's ratings are their own.
- `docs/data/queens.js`: 392 hand-curated queens (there is no Drag
  Race API). Full mainline rosters: US S1-16, All Stars, UK S1-7,
  Canada S1-6, Brasil S1-2. Lighter, less-verified coverage: Down
  Under, España, France, Philippines, Thailand, Italia — check against
  Wikipedia before extending those, a prior pass invented 4 queens that
  don't exist (caught because they had no Fandom page — treat any
  no-Fandom-page entry as a suspect). Sherry Pie deliberately excluded
  (disqualified). Each entry: id, name, franchise, seasons (with
  placement), 2-3 style tags (engine-only, never shown in the UI),
  iconicScore (winner ≥ 6, runner-up ≥ 5 floors), image + wikiUrl from
  the Fandom wiki's MediaWiki API (batch query, redirect-following,
  ~640px thumbnails — never hand-guess those URLs, the API is free and
  reliable).
- `docs/script.js`: all logic.
  - Search: `searchKey()` strips spaces/punctuation/accents on both
    the query and the queen names before matching, so "ben de la
    creme" finds "BenDeLaCreme" and "shea coulee" finds "Coulée".
  - Recommendation: `pairSimilarity` (tag overlap ×2, shared season
    ×3, same franchise +6, year proximity +3/+2/+1) feeds
    `combinedScore` = 0.35 × iconicScore + 0.65 × signed average of
    the **5 nearest** rated queens (NOT a single closest match, NOT an
    average over everything — both tried and failed on her real rating
    data; see lesson below).
  - Tournament: binary insertion sort, capped once the settled order
    hits `TOURNAMENT_TOP_N` (20), resumable from localStorage.
- Layout is mobile-first (that's the primary, default styling). A
  single `@media (min-width: 700px)` block at the very end of
  `style.css` restores a calmer desktop layout. Same HTML/DOM both
  ways always — the media query only restyles, never fork markup per
  breakpoint.

## Current visual direction (settled, not tentative)

Dark theme, from a Pantone cotton-chip photo she sent: near-black warm
plum background (`#191317`), flat cards with **no borders, no
box-shadow, no border-radius anywhere**, and the palette lives in *type
color* — berry (`#e0688c`) for the title/buttons/links, violet
(`#9b8cf0`) for section headings, berry/violet/red-violet for the
Top 3 ranks. She approved this explicitly ("love it") — it's the
current baseline, don't revert to the earlier light/rounded-card look
without her asking.

Screen-by-screen, all mobile-first with a photo-forward, low-chrome
feel:
- **Onboarding** — rebuilt from her own hand-drawn sketches (a much
  better design input from her than verbal description, see lesson
  below). Search is a solid berry bar, not a thin underline. Typing
  shows results as a 3-column photo grid. Chosen anchors stack as
  full-width photo rows with a solid berry name banner.
- **Rating deck** — full-bleed photo (`56dvh` tall) with name/season/
  wiki-link overlaid on a bottom gradient scrim, buttons below.
- **Tournament ("vs")** — two contenders stacked vertically as big
  full-width photos with "vs" between them, not side-by-side small
  cards.
- **Results** — Top 10 is a compact one-row-per-queen list (rank,
  small photo, name) sized to fit one phone screen for easy
  screenshotting; "See #11-20" expands further.

Desktop restores a calmer, contained version of each of these (padded
cards, text below photos not overlaid, smaller images) via the media
query — nobody's redesigned desktop on purpose, it's just "not broken
on a wide window."

## About the owner

Product manager, not an engineer, vibecodes for fun. Explain what's
happening in plain language (user action → what the code does → what
comes back), define jargon on first use, say what a command does
before running it. Surgical changes only, simplicity over cleverness,
ask rather than guess. She decides product questions — don't bury them
inside refactors.

## Her tone of voice (for all UI copy and docs she'd sign)

- Em dashes: never. Use commas, colons, parentheses, or rewrite.
- Short direct sentences, common words, contractions.
- Nuance goes in parentheses, the main sentence stays clean.
- No hedging, no filler openers, no corporate polish.
- Markers she actually uses: "etc etc", "honestly", direct questions.
- Banned: AI-sounding words (seamless, effortless, delve, journey,
  robust, leverage, unlock...) and "not just X, but Y" constructions.
- The README is the reference example of her register — read it before
  writing anything else user-facing.

## Lessons that cost real time (don't relearn them)

1. **Verify UI visually before claiming it works.** Headless Chrome +
   playwright-core driving the real app, real screenshots at 390×844
   (mobile) and 1280×900 (desktop) minimum. CSS reasoning alone shipped
   wrong repeatedly before this became standard practice.
2. **Any cropped photo needs an explicit `object-position`.** No
   override defaults to center-center, which cuts through faces on a
   tall full-body promo shot about as often as not — and it hides in
   spot checks because it only breaks on *some* photos depending on
   their individual composition. Check across several different
   queens' photos, not just one, before calling a crop fixed.
3. **Crop tightness and element size are independent CSS levers.**
   Container aspect ratio/height controls how much `object-fit:cover`
   crops; `transform: scale` + `transform-origin` zooms in *beyond*
   what the container geometry forces. Changing one to fix the other
   doesn't work — decouple them on purpose.
4. **Recommendation complaints: get her real rating history first**
   (`copy(JSON.stringify(...))` from `localStorage.dragrank_state` in
   her browser console), reproduce against the real dataset, then
   tune. Guessing weights from a described symptom alone failed
   multiple times before real data found the actual cause in one pass.
5. **Sketches beat adjectives.** When she sent photos of hand-drawn
   wireframes for the onboarding redesign, it landed in one pass. Every
   prior round guessed from words like "bold" or "simple" and needed
   2-3 iterations. If she's willing to sketch something, that beats
   asking her to describe it more precisely.
6. **A photo reference means the palette, not the literal scene.**
   When she sent a photo of a Pantone chip book on cream paper and
   said "a palette similar to the image," building the literal cream/
   white version was wrong — she wanted the chip *colors*, applied to
   a bold dark treatment she hadn't described yet. Ask "the colors, or
   the whole look?" before a full-literal build if it's ambiguous.
7. **No public Fandom page on a dataset entry is a red flag**, not
   just a missing photo. Four invented queens (fabricated during
   earlier hand-curation) were caught exactly this way — they were the
   only entries with no wiki page at all. If extending the dataset,
   verify new entries against Wikipedia's contestant lists, don't
   rely on memory for less-familiar franchises.

## Known open items

- **Photo quality.** Fandom thumbnails are capped at 640px and many
  source files only yield 393-517px — soft on a full-bleed retina
  phone screen. Cheap next step: bump `pithumbsize` higher (try 1280,
  check payload weight on mobile data) using the same batch-fetch
  script pattern already in the dataset. Real upgrade: per-season
  promo galleries on the wiki, more work but better/more consistent
  art direction.
- **España/France/Italia/Thailand rosters are thin** and were built
  from memory, less rigorously than US/UK/Canada/Brasil (which were
  verified against Wikipedia). Worth an audit pass before trusting them
  or building features on top.
- **No Drag Horoscope.** Was in the original spec (Sun/Moon/Rising
  from Top 10 tags); `summarizeTaste()` already covers the substance in
  plain language. Probably not worth a separate astrology-framed
  feature unless she specifically asks for that framing.
- Ranking stops at #20 (tournament cap) — queens below that are rated
  but not ordered relative to each other.
