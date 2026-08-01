(function () {
  "use strict";

  const STORAGE_KEY = "dragrank_state";
  const NUDGE_THRESHOLD = 12;

  const byId = Object.fromEntries(QUEENS.map((q) => [q.id, q]));

  let state = loadState();

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      /* corrupt state — start fresh */
    }
    return { anchors: [], ratings: {}, nudgeShown: false, nudgeDismissed: false };
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  // ---------- shared helpers ----------

  function initials(name) {
    return name
      .split(/\s+/)
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }

  function colorForName(name) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 55%, 42%)`;
  }

  function makeAvatar(queen, size) {
    const sizeClass = size ? " " + size : "";
    if (queen.image) {
      const img = document.createElement("img");
      img.className = "avatar" + sizeClass;
      img.src = queen.image;
      img.alt = queen.name;
      img.loading = "lazy";
      // If the hotlinked photo 404s, fall back to the generated avatar
      // instead of showing a broken-image icon.
      img.addEventListener("error", () => {
        const fallback = makeInitialsAvatar(queen, size);
        img.replaceWith(fallback);
      }, { once: true });
      return img;
    }
    return makeInitialsAvatar(queen, size);
  }

  function makeInitialsAvatar(queen, size) {
    const div = document.createElement("div");
    div.className = "avatar" + (size ? " " + size : "");
    div.style.background = colorForName(queen.name);
    div.textContent = initials(queen.name);
    return div;
  }

  function makeWikiLink(queen) {
    const link = document.createElement("a");
    link.className = "wiki-link";
    link.href = queen.wikiUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "View on wiki ↗";
    return link;
  }

  function seasonKeys(queen) {
    // "US S12 (Winner)" -> "US S12" — strips placement so shared-season
    // matching works regardless of how each queen placed.
    return queen.seasons.map((s) => s.replace(/\s*\(.*\)$/, ""));
  }

  // Approximate premiere year per season key — good enough for "same era"
  // clustering, not meant as a precise historical record.
  const SEASON_YEAR = {
    "US S1": 2009, "US S2": 2010, "US S3": 2011, "US S4": 2012, "US S5": 2013,
    "US S6": 2014, "US S7": 2015, "US S8": 2016, "US S9": 2017, "US S10": 2018,
    "US S11": 2019, "US S12": 2020, "US S13": 2021, "US S14": 2022, "US S15": 2023,
    "US S16": 2024,
    "US AS1": 2012, "US AS2": 2016, "US AS3": 2018, "US AS4": 2019, "US AS5": 2020,
    "US AS6": 2021, "US AS7": 2022, "US AS8": 2023, "US AS9": 2024,
    "UK S1": 2019, "UK S2": 2021, "UK S3": 2021, "UK S4": 2022, "UK S5": 2023,
    "UK S6": 2024, "UK S7": 2025, "UK vs World": 2023,
    "Canada S1": 2020, "Canada S2": 2021, "Canada S3": 2022, "Canada S4": 2023,
    "Canada S5": 2024, "Canada S6": 2025,
    "Brasil S1": 2023, "Brasil S2": 2025,
    "DU S1": 2021, "DU S2": 2022, "DU S3": 2023,
    "España S1": 2021, "España S2": 2022,
    "France S1": 2022,
    "Philippines S1": 2022, "Philippines S2": 2023,
    "Thailand S1": 2018, "Thailand S2": 2019,
    "Italia S1": 2023,
  };

  function tagOverlapCount(a, b) {
    return a.tags.filter((t) => b.tags.includes(t)).length;
  }

  function sharedSeasonCount(a, b) {
    const aKeys = seasonKeys(a);
    const bKeys = seasonKeys(b);
    return aKeys.filter((k) => bKeys.includes(k)).length;
  }

  function yearProximityBonus(a, b) {
    const aYears = seasonKeys(a).map((k) => SEASON_YEAR[k]).filter((y) => y !== undefined);
    const bYears = seasonKeys(b).map((k) => SEASON_YEAR[k]).filter((y) => y !== undefined);
    if (aYears.length === 0 || bYears.length === 0) return 0;
    let minDiff = Infinity;
    for (const ay of aYears) {
      for (const by of bYears) minDiff = Math.min(minDiff, Math.abs(ay - by));
    }
    if (minDiff === 0) return 3;
    if (minDiff === 1) return 2;
    if (minDiff === 2) return 1;
    return 0;
  }

  function pairSimilarity(queen, ref) {
    let score = tagOverlapCount(queen, ref) * 2;
    score += sharedSeasonCount(queen, ref) * 3;
    // Same franchise is a strong signal on its own — a UK fan who loves
    // one UK queen expects other UK queens next, even with zero tag or
    // season overlap. Weighted comparably to sharing two tags plus a
    // season, not a token +1.
    if (queen.franchise === ref.franchise) score += 6;
    // Same era matters even across franchises or with no shared tags —
    // two queens from around the same year read as contemporaries.
    score += yearProximityBonus(queen, ref);
    return score;
  }

  const NEIGHBOR_COUNT = 5;

  function ratedQueens() {
    // "Don't know" carries no preference signal — excluded entirely so it
    // can't occupy one of the nearest-neighbor slots and dilute the real
    // ratings sitting alongside it.
    return Object.keys(state.ratings)
      .map((id) => ({ ref: byId[id], rating: state.ratings[id] }))
      .filter((entry) => entry.ref && typeof entry.rating === "number");
  }

  // Nearest-neighbor averaging, not a single closest match and not a
  // straight average over every rating. A single max match let one
  // outlier (e.g. one Like on an otherwise-disliked type) drag in a
  // whole wave of similar queens she'd go on to Meh/Dislike. Averaging
  // over literally everything rated dilutes to near-zero once there are
  // dozens of ratings, since most pairs share nothing. Averaging just
  // the K queens actually most similar to this candidate — weighted
  // toward Like/Love and away from Meh/Dislike by how she rated each —
  // stays meaningful at any session length and isn't swayed by one
  // exception. Verified against a real 59-rating session where it fixed
  // exactly this: a single Liked "HighFashion+Alternative" queen was
  // pulling in several similarly-tagged queens she then disliked.
  function combinedScore(queen, rated) {
    const neighbors = rated
      .map(({ ref, rating }) => ({ rating, similarity: pairSimilarity(queen, ref) }))
      .filter((n) => n.similarity > 0)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, NEIGHBOR_COUNT);
    if (neighbors.length === 0) return queen.iconicScore;
    const signal =
      neighbors.reduce((acc, { rating, similarity }) => acc + (rating / 4) * similarity, 0) / neighbors.length;
    return 0.35 * queen.iconicScore + 0.65 * signal;
  }

  function getOrderedQueue() {
    const rated = ratedQueens();
    return QUEENS.filter((q) => !(q.id in state.ratings))
      .map((q) => ({ queen: q, score: combinedScore(q, rated) }))
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.queen);
  }

  function positiveCount() {
    return Object.values(state.ratings).filter((r) => r >= 2).length;
  }

  function ratedCount() {
    return Object.keys(state.ratings).length;
  }

  // ---------- Phase 0: onboarding ----------

  const searchInput = document.getElementById("search-input");
  const searchResults = document.getElementById("search-results");
  const anchorList = document.getElementById("anchor-list");
  const startRatingBtn = document.getElementById("start-rating-btn");

  // Spaces, punctuation and accents don't count in search — "ben de la
  // creme" has to find "BenDeLaCreme", "shea coulee" has to find
  // "Coulée". Plain substring matching missed both.
  function searchKey(text) {
    return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  searchInput.addEventListener("input", () => {
    const q = searchKey(searchInput.value);
    searchResults.innerHTML = "";
    if (!q) return;

    const matches = QUEENS.filter(
      (queen) => !(queen.id in state.ratings) && searchKey(queen.name).includes(q)
    ).slice(0, 8);

    for (const queen of matches) {
      const li = document.createElement("li");
      li.appendChild(makeAvatar(queen));
      const label = document.createElement("span");
      label.textContent = queen.name;
      li.appendChild(label);
      const badge = document.createElement("span");
      badge.className = "season-badge";
      badge.textContent = queen.seasons[0];
      li.appendChild(badge);
      li.addEventListener("click", () => selectAnchor(queen));
      searchResults.appendChild(li);
    }
  });

  const MAX_ANCHORS = 5;

  function selectAnchor(queen) {
    if (state.anchors.length >= MAX_ANCHORS) return;
    state.anchors.push(queen.id);
    state.ratings[queen.id] = 4;
    searchInput.value = "";
    searchResults.innerHTML = "";
    saveState();
    renderAnchors();
  }

  function removeAnchor(id) {
    state.anchors = state.anchors.filter((a) => a !== id);
    delete state.ratings[id];
    saveState();
    renderAnchors();
  }

  function renderAnchors() {
    anchorList.innerHTML = "";
    for (const id of state.anchors) {
      const queen = byId[id];
      if (!queen) continue;
      const chip = document.createElement("div");
      chip.className = "anchor-chip";
      chip.appendChild(makeAvatar(queen, "large"));

      const overlay = document.createElement("div");
      overlay.className = "anchor-overlay";
      const label = document.createElement("span");
      label.textContent = queen.name;
      overlay.appendChild(label);
      chip.appendChild(overlay);

      const removeBtn = document.createElement("button");
      removeBtn.textContent = "×";
      removeBtn.addEventListener("click", () => removeAnchor(id));
      chip.appendChild(removeBtn);
      anchorList.appendChild(chip);
    }
    startRatingBtn.disabled = state.anchors.length === 0;
  }

  startRatingBtn.addEventListener("click", () => {
    goToPhase("rating");
    renderNextCard();
  });

  // ---------- Phase 1: rating deck ----------

  const ratingCard = document.getElementById("rating-card");
  const deckEmpty = document.getElementById("deck-empty");
  const ratedCountEl = document.getElementById("rated-count");
  const faveCountEl = document.getElementById("fave-count");
  const nudgeBanner = document.getElementById("nudge-banner");
  const nudgeBuildBtn = document.getElementById("nudge-build-btn");
  const nudgeDismissBtn = document.getElementById("nudge-dismiss-btn");
  const stickyBuildBtn = document.getElementById("sticky-build-btn");

  let currentQueen = null;

  function renderNextCard() {
    const queue = getOrderedQueue();
    currentQueen = queue[0] || null;

    ratedCountEl.textContent = ratedCount();
    faveCountEl.textContent = positiveCount();

    ratingCard.innerHTML = "";
    if (!currentQueen) {
      deckEmpty.classList.remove("hidden");
      return;
    }
    deckEmpty.classList.add("hidden");

    ratingCard.appendChild(makeAvatar(currentQueen, "hero"));

    const overlay = document.createElement("div");
    overlay.className = "card-overlay";

    const name = document.createElement("div");
    name.className = "card-name";
    name.textContent = currentQueen.name;
    overlay.appendChild(name);

    const seasons = document.createElement("div");
    seasons.className = "card-seasons-corner";
    seasons.textContent = currentQueen.seasons.join(" · ");
    overlay.appendChild(seasons);

    overlay.appendChild(makeWikiLink(currentQueen));

    ratingCard.appendChild(overlay);

    updateNudge();
  }

  function rateCurrent(rating) {
    if (!currentQueen) return;
    state.ratings[currentQueen.id] = rating;
    saveState();
    renderNextCard();
  }

  document.querySelectorAll(".rate-btn").forEach((btn) => {
    const raw = btn.dataset.rating;
    const rating = raw === "unknown" ? raw : Number(raw);
    btn.addEventListener("click", () => rateCurrent(rating));
  });

  document.addEventListener("keydown", (e) => {
    if (document.getElementById("phase-rating").classList.contains("hidden")) return;
    if (document.activeElement === searchInput) return;
    const map = { 1: -4, 2: -2, 3: 0, 4: 2, 5: 4, 6: "unknown" };
    if (e.key in map) rateCurrent(map[e.key]);
  });

  function updateNudge() {
    const count = positiveCount();
    if (count >= NUDGE_THRESHOLD && !state.nudgeDismissed) {
      nudgeBanner.classList.remove("hidden");
      stickyBuildBtn.classList.add("hidden");
    } else if (count >= NUDGE_THRESHOLD && state.nudgeDismissed) {
      nudgeBanner.classList.add("hidden");
      stickyBuildBtn.classList.remove("hidden");
      stickyBuildBtn.textContent = `Build Top 10 (${count} favorites)`;
    } else {
      nudgeBanner.classList.add("hidden");
      stickyBuildBtn.classList.add("hidden");
    }
  }

  nudgeBuildBtn.addEventListener("click", () => {
    startTournament();
  });

  nudgeDismissBtn.addEventListener("click", () => {
    state.nudgeDismissed = true;
    saveState();
    updateNudge();
  });

  stickyBuildBtn.addEventListener("click", () => {
    startTournament();
  });

  // ---------- Phase 2: head-to-head tournament ----------
  //
  // A rating value alone doesn't say whether one Love beats another Love,
  // or which Likes make the cut when there are more favorites than slots.
  // This resolves that with pairwise "which do you prefer" comparisons —
  // binary-insertion sort, so ranking N favorites takes roughly N*log2(N)
  // comparisons instead of every possible pair. Resumable: if you rate
  // more favorites later and build the Top 10 again, only the new ones
  // get inserted into the order you already settled, not a full redo.

  const tournamentLeftBtn = document.getElementById("tournament-left");
  const tournamentRightBtn = document.getElementById("tournament-right");
  const tournamentProgressEl = document.getElementById("tournament-progress");

  // Only the top 20 need a precise, judged order — nobody's asking to see
  // #21 vs #340. Capping comparisons to this window keeps the tournament
  // from growing unboundedly as favorites pile up: once the ranked list
  // reaches this size, a new candidate only ever needs ~log2(20) ≈ 5
  // comparisons to find her spot or confirm she doesn't make the cut,
  // instead of comparisons against every favorite ever rated.
  const TOURNAMENT_TOP_N = 20;

  function seedTournamentCandidates() {
    return Object.entries(state.ratings)
      .filter(([, r]) => r >= 2)
      .map(([id]) => id)
      .sort((a, b) => {
        const qa = byId[a];
        const qb = byId[b];
        return state.ratings[b] - state.ratings[a] || qb.iconicScore - qa.iconicScore || qa.name.localeCompare(qb.name);
      });
  }

  function startTournament() {
    const seed = seedTournamentCandidates();

    if (!state.tournament) {
      if (seed.length <= 1) {
        goToPhase("results");
        renderResults();
        return;
      }
      state.tournament = { ranked: [seed[0]], remaining: seed.slice(1), rejected: [], current: null, lo: 0, hi: 0 };
      goToPhase("tournament");
      advanceTournament();
      return;
    }

    state.tournament.rejected = state.tournament.rejected || [];
    const known = new Set([...state.tournament.ranked, ...state.tournament.remaining, ...state.tournament.rejected]);
    if (state.tournament.current) known.add(state.tournament.current);
    state.tournament.remaining.push(...seed.filter((id) => !known.has(id)));
    saveState();
    goToPhase("tournament");
    advanceTournament();
  }

  function advanceTournament() {
    const t = state.tournament;
    t.rejected = t.rejected || [];
    if (t.current === null) {
      if (t.remaining.length === 0) {
        goToPhase("results");
        renderResults();
        return;
      }
      t.current = t.remaining.shift();
      t.lo = 0;
      t.hi = Math.min(t.ranked.length, TOURNAMENT_TOP_N);
    }
    if (t.lo >= t.hi) {
      if (t.lo >= TOURNAMENT_TOP_N) {
        // Lost to everyone already in the top N — remember that so she's
        // not pointlessly re-compared next time the tournament resumes.
        t.rejected.push(t.current);
      } else {
        t.ranked.splice(t.lo, 0, t.current);
        if (t.ranked.length > TOURNAMENT_TOP_N) {
          t.rejected.push(...t.ranked.splice(TOURNAMENT_TOP_N));
        }
      }
      t.current = null;
      saveState();
      advanceTournament();
      return;
    }
    saveState();
    renderTournamentCard();
  }

  function renderTournamentCard() {
    const t = state.tournament;
    const mid = Math.floor((t.lo + t.hi) / 2);
    fillTournamentCard(tournamentLeftBtn, byId[t.current]);
    fillTournamentCard(tournamentRightBtn, byId[t.ranked[mid]]);

    const left = t.remaining.length + 1; // +1 for the one being placed now
    tournamentProgressEl.textContent = left === 1 ? "Last one to place." : `${left} queens left to place.`;
  }

  function fillTournamentCard(button, queen) {
    button.innerHTML = "";
    button.appendChild(makeAvatar(queen, "large"));
    const name = document.createElement("div");
    name.className = "card-name";
    name.textContent = queen.name;
    button.appendChild(name);
  }

  function chooseTournament(preferLeft) {
    const t = state.tournament;
    const mid = Math.floor((t.lo + t.hi) / 2);
    if (preferLeft) t.hi = mid;
    else t.lo = mid + 1;
    advanceTournament();
  }

  tournamentLeftBtn.addEventListener("click", () => chooseTournament(true));
  tournamentRightBtn.addEventListener("click", () => chooseTournament(false));

  // ---------- Phase 3: results ----------

  const top10Grid = document.getElementById("top10-grid");
  const top20Grid = document.getElementById("top20-grid");
  const showMoreBtn = document.getElementById("show-more-btn");
  const tasteSummaryEl = document.getElementById("taste-summary");
  const keepRatingBtn = document.getElementById("keep-rating-btn");
  const resetBtn = document.getElementById("reset-btn");

  function computeRankedFavorites(n) {
    if (state.tournament) {
      return state.tournament.ranked
        .map((id) => byId[id])
        .filter(Boolean)
        .slice(0, n)
        .map((queen) => ({ queen }));
    }
    return Object.entries(state.ratings)
      .filter(([, rating]) => rating >= 2)
      .map(([id, rating]) => ({ queen: byId[id], rating }))
      .filter((entry) => entry.queen)
      .sort((a, b) => b.rating - a.rating || b.queen.iconicScore - a.queen.iconicScore || a.queen.name.localeCompare(b.queen.name))
      .slice(0, n);
  }

  function renderRankGrid(grid, entries, rankOffset) {
    grid.innerHTML = "";
    entries.forEach((entry, index) => {
      const rankNum = rankOffset + index + 1;
      const card = document.createElement("div");
      card.className = `top10-card rank-${rankNum}`;

      const rank = document.createElement("div");
      rank.className = "rank";
      rank.textContent = `#${rankNum}`;
      card.appendChild(rank);

      card.appendChild(makeAvatar(entry.queen, "large"));

      const name = document.createElement("div");
      name.className = "card-name";
      name.textContent = entry.queen.name;
      card.appendChild(name);

      const seasons = document.createElement("div");
      seasons.className = "card-seasons";
      seasons.textContent = entry.queen.seasons[0];
      card.appendChild(seasons);

      card.appendChild(makeWikiLink(entry.queen));

      grid.appendChild(card);
    });
  }

  // A frequency read of the Top 10's own tags/franchise/debut-era — not a
  // horoscope, just "here's what the pattern in your own picks looks
  // like," in plain language.
  function summarizeTaste(top10Queens) {
    if (top10Queens.length < 3) return "";

    const tagCounts = {};
    const franchiseCounts = {};
    const debutYears = [];
    for (const q of top10Queens) {
      for (const t of q.tags) tagCounts[t] = (tagCounts[t] || 0) + 1;
      franchiseCounts[q.franchise] = (franchiseCounts[q.franchise] || 0) + 1;
      const years = seasonKeys(q).map((k) => SEASON_YEAR[k]).filter((y) => y !== undefined);
      if (years.length) debutYears.push(Math.min(...years));
    }

    const topTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);
    const n = top10Queens.length;
    let tagPart;
    if (topTags.length && topTags[0][1] / n >= 0.4) {
      const leading = topTags.filter((t) => t[1] >= topTags[0][1] - 1).slice(0, 2);
      tagPart = `Mostly ${leading.map((t) => t[0]).join(" and ")} queens`;
    } else {
      tagPart = "A real mix of styles, no single type dominates";
    }

    const franchises = Object.entries(franchiseCounts).sort((a, b) => b[1] - a[1]);
    let franchisePart;
    if (franchises.length === 1) {
      franchisePart = `all ${franchises[0][0]}`;
    } else if (franchises[0][1] / n >= 0.7) {
      franchisePart = `mostly ${franchises[0][0]}, with ${franchises
        .slice(1)
        .map((f) => f[0])
        .join(" and ")} mixed in`;
    } else {
      franchisePart = `genuinely international (${franchises.length} franchises)`;
    }

    let eraPart = "";
    if (debutYears.length >= 3) {
      const min = Math.min(...debutYears);
      const max = Math.max(...debutYears);
      const range = max - min;
      if (range <= 2) eraPart = `, all from around ${min}–${max} (one era, not spread out)`;
      else if (range <= 6) eraPart = `, mostly one stretch of time (${min}–${max})`;
      else eraPart = `, spanning ${min} to ${max} (no loyalty to one era)`;
    }

    return `${tagPart}, ${franchisePart}${eraPart}.`;
  }

  function renderResults() {
    const top20 = computeRankedFavorites(20);
    const top10 = top20.slice(0, 10);
    const rest = top20.slice(10);

    renderRankGrid(top10Grid, top10, 0);
    tasteSummaryEl.textContent = summarizeTaste(top10.map((e) => e.queen));

    if (rest.length > 0) {
      showMoreBtn.classList.remove("hidden");
      showMoreBtn.textContent = `See #11–${10 + rest.length}`;
      renderRankGrid(top20Grid, rest, 10);
    } else {
      showMoreBtn.classList.add("hidden");
      top20Grid.classList.add("hidden");
    }
  }

  showMoreBtn.addEventListener("click", () => {
    const isHidden = top20Grid.classList.contains("hidden");
    top20Grid.classList.toggle("hidden");
    showMoreBtn.textContent = isHidden
      ? showMoreBtn.textContent.replace("See", "Hide")
      : showMoreBtn.textContent.replace("Hide", "See");
  });

  keepRatingBtn.addEventListener("click", () => {
    goToPhase("rating");
    renderNextCard();
  });

  function resetAll() {
    if (!confirm("Clear all ratings and start over?")) return;
    localStorage.removeItem(STORAGE_KEY);
    state = loadState();
    searchResults.innerHTML = "";
    renderAnchors();
    goToPhase("onboard");
  }

  resetBtn.addEventListener("click", resetAll);
  document.getElementById("header-reset-btn").addEventListener("click", resetAll);

  // ---------- phase switching ----------

  function goToPhase(name) {
    document.querySelectorAll(".phase").forEach((el) => el.classList.add("hidden"));
    document.getElementById(`phase-${name}`).classList.remove("hidden");
    // Rating is the one screen where the photo should own the space —
    // shrink the header out of the way instead of competing with it.
    document.body.classList.toggle("rating-active", name === "rating");
    document.body.classList.toggle("onboard-active", name === "onboard");
    if (name !== "rating") {
      nudgeBanner.classList.add("hidden");
      stickyBuildBtn.classList.add("hidden");
    }
  }

  // ---------- init ----------

  renderAnchors();
  if (state.tournament && (state.tournament.current !== null || state.tournament.remaining.length > 0)) {
    // there's an unfinished comparison — resume it rather than losing
    // the progress on refresh
    goToPhase("tournament");
    advanceTournament();
  } else if (state.tournament) {
    goToPhase("results");
    renderResults();
  } else if (ratedCount() > state.anchors.length) {
    // there's rating progress beyond the anchors — resume the deck
    goToPhase("rating");
    renderNextCard();
  }
})();
