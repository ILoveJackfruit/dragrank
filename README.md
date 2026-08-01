# DragRank

Personal, local, no-auth tool for ranking your favorite Drag Race queens.
Search for up to 5 favorites to anchor the deck (each shown with her
photo), rate queens one at a time (smart-ordered toward queens similar
to what you already like), settle the order of your favorites in a
quick head-to-head round, then see your Top 10.

Rating scale: Dislike (−4), Meh (−2), Neutral (0), Like (+2), Love (+4),
plus Don't know — for queens you don't recognize, so you're not forced
to guess. Don't know is excluded entirely from the similarity math (see
below); it just marks her as seen so she won't come up again. +2 or
higher counts as a favorite for the Top 10 and the "build Top 10" nudge.
Picking an anchor or rating someone Love saves as +4.

The rating deck order is driven by `combinedScore` in `script.js`:
`0.35 × iconicScore + 0.65 × averageSignalFromYourNearest5Ratings`, where
"nearest" means the 5 rated queens most similar to the candidate (shared
tags, shared exact season, same franchise, close year), each counted
positive or negative based on how you rated it (Love/Like pull up, Meh/
Dislike push down, Meh at half strength). Averaging just the 5 nearest
ratings — not a single closest match, and not every rating you've ever
made — turned out to matter a lot: a single closest-match version let
one outlier Like drag in a wave of similarly-tagged queens that then got
disliked, and a version that averaged over literally everything you'd
rated diluted to near-zero signal once there were dozens of ratings.
Reworked four times total: iconic queens buried past queue position
200 → raised iconic weight and floored placement scores; loving one UK
queen not surfacing others → boosted the franchise-match weight; a
single Like generalizing too broadly across a loose tag like
"Alternative" → switched from single-match/full-average to nearest-5
averaging; "Don't know" ratings were occupying neighbor slots with zero
signal, diluting the real ratings around them → excluded from the
neighbor pool entirely. Each round tested against real rating data
pulled from an actual session, not guessed. See the
`combinedScore`/`pairSimilarity` comments in `script.js` for the exact
weights if you want to retune them.

A queen with a middling `iconicScore` and nothing yet rated near her
(tag/season/franchise-wise) won't surface on her own — that's not a bug,
it's the cold-start problem for any content-based recommender. If there's
someone you already know you love who the deck might never organically
reach, search and add her directly as one of your (up to 5) anchors.

**Head-to-head tournament.** A rating value alone doesn't say whether one
Love beats another Love, or which Likes make the cut when there are more
favorites than slots — so "Build Top 10" doesn't jump straight to
results. It runs a binary-insertion sort over everyone rated +2 or
higher: "which do you prefer, A or B?", one pair at a time, roughly
`N log₂N` comparisons instead of every possible pair (e.g. ~45 for 14
favorites, not the 91 a full round-robin would take). A progress line
("N queens left to place") shows above the comparison so it doesn't feel
like it's dragging with no end in sight.

Comparisons are capped once the settled order reaches `TOURNAMENT_TOP_N`
(20) — past that, a new favorite only needs ~log₂(20) ≈ 5 comparisons to
either find her spot or confirm she's outside the top 20, instead of
comparisons against every favorite ever rated. That cap is also why you
can only ever see up to #20: results only knows a precise order that
deep, everyone below that is unordered and untracked. Rejected/bumped
queens are remembered (`state.tournament.rejected`) so they're not
pointlessly re-compared if the tournament resumes later.

Resumable two ways: refreshing mid-comparison picks up the exact same
pair, and rating more favorites later + building the Top 10 again only
inserts the *new* ones into the order you already settled, not a full
redo. Logic lives in `startTournament`/`advanceTournament`/
`chooseTournament` in `script.js`.

**Results page** shows the Top 10, a one-line plain-language read of the
pattern in it (`summarizeTaste` — dominant tags, franchise spread,
whether your picks cluster in one era or span the show's whole history),
and a "See #11–20" toggle for the rest of what the tournament settled.

## Run it

```
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app.py
```

Then open http://localhost:5002. Progress (anchors + ratings) is saved to
`localStorage`, so it survives a refresh — "Start over" (in the header,
available from any screen) clears it.

## Scope (Phase 1)

- **Dataset is hand-curated, not live.** There's no public Drag Race API.
  `docs/data/queens.js` bundles 288 queens — full rosters for US
  mainline (S1–S16), All Stars, UK (S1–S7), Canada's Drag Race (S1–S6),
  and Drag Race Brasil (S1–S2), plus a lighter pass at Down Under, España,
  France, Philippines, Thailand, and Italia. Placements and seasons are
  sourced from Wikipedia; archetype tags are hand-written (used by the
  recommendation engine, not shown in the UI). `iconicScore` has a floor
  by placement (winner ≥ 6, runner-up ≥ 5) so franchise winners outside
  the US aren't scored so low they get buried in the queue. Recent/niche
  queens outside that list won't show up in search yet — extend by adding
  entries to that file.
- **Photos and wiki links are real, not guessed.** Each queen's `image`
  and `wikiUrl` were fetched from the RuPaul's Drag Race Fandom wiki's
  public MediaWiki API (with redirect-following for nicknames, e.g.
  "Bimini" → "Bimini Bon-Boulash"), not hand-typed URLs. Images are
  requested at 640px wide (`pithumbsize=640` in the fetch script) — bumped
  up from an original 184-300px pass once the rating card started
  showing photos full-bleed at up to 56dvh tall, where the small
  thumbnails looked visibly soft on a retina phone. Fandom serves
  whatever the source image actually supports up to that cap, so some
  queens land around 400-500px rather than the full 640 — still a real
  improvement, not a hard guarantee. A handful of newer/niche queens
  (Amara La Negra, Drag Sithou, Lomega, Divina, Sanjina DaBish Queen,
  Chanel) don't have a Fandom page yet — those fall back to a generated
  initials avatar and a Fandom search link instead of a dead one. If a
  hotlinked photo ever 404s at view time, the UI swaps in the generated
  avatar automatically.
- **Mobile-first layout, contained on desktop.** Below 700px wide: the
  rating card breaks out to full viewport width
  (`width:100vw; margin-left:calc(-50vw + 50%)` — the standard
  full-bleed-inside-a-centered-container trick) with the photo filling
  the top ~56% of the screen edge-to-edge and name/season/wiki-link
  overlaid on it (`.card-overlay`, bottom gradient scrim) rather than
  stacked below in a separate card. The header shrinks during rating
  (`body.rating-active`) to free up more room for the photo. Onboarding
  is centered and larger-type (`body.onboard-active`). `.avatar.hero`
  sets `object-position: 50% 20%` — with no override this defaults to
  center-center, which on a tall full-body photo crops straight through
  the face about as often as not (same root cause as the anchor grid
  crop). Checked across 5 different queens' photos (varied poses, one
  poster-style graphic) after setting this — full face in frame on all
  of them.

  At 700px and up (a real browser window, not a phone), a single
  `@media (min-width: 700px)` block at the end of `style.css` overrides
  all of the above back to the contained, rounded-card look that
  existed before the mobile-first pass: padded white card, photo capped
  at 280×340px, text below the photo in normal flow instead of
  overlaid, anchor chips back to small centered squares. The mobile
  rules aren't duplicated or branched in JS — same HTML/DOM either way,
  the media query just restyles it for wider screens. Verified both
  breakpoints with real screenshots (1280px and 390px) side by side.
- **Chosen anchors are a face-cropped 3-column photo grid**, full
  viewport width, no gaps — three fill a row edge to edge, a 4th/5th
  wraps to a second row. Name sits in a small `.anchor-overlay` (same
  bottom-gradient-scrim pattern as the rating card) rather than below
  the photo. This tile size is scoped to `.anchor-chip .avatar.large`
  specifically — the shared `.avatar.large` used in Top 10/tournament
  cards (4.5rem square) is untouched.

  Getting the crop right took two passes. `.anchor-chip` height is
  `30dvh` (viewport-relative, not an aspect-ratio derived from the
  ~130px column width) — with exactly 3 chosen (one row), a
  width-derived height left most of the screen blank underneath, since
  the row alone was only ~100px tall. `30dvh` makes the row actually
  fill a real share of the screen regardless of how many columns end up
  in it. But a taller container is closer to the source photos' own
  ~3:4 portrait shape, and `object-fit:cover` only crops as much as the
  container's aspect ratio *forces* — so the taller tile on its own
  showed full outfits again, undoing the face-crop from the prior pass.
  Fixed by decoupling "how tall is the tile" from "how tight is the
  crop": `object-position: 50% 0%` plus `transform: scale(1.8)` with
  `transform-origin: 50% 8%` on `.anchor-chip .avatar.large` zooms the
  image in beyond what plain cover-fitting provides, independent of the
  container's own height. Net result: tall tiles that actually fill the
  screen, zoomed on the face/upper body rather than the whole outfit.
- **No Drag Horoscope yet** — the astrology read-out (Sun/Moon/Rising
  from your Top 10's tags) is the one deferred piece of the original
  spec left. The head-to-head tournament is built (see above).
- If the pool of +2/+4 favorites is 0 or 1, there's nothing to compare —
  "Build Top 10" skips the tournament and goes straight to results.
