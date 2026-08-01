# DragRank

With 16+ US seasons, All Stars, UK, Canada, Brasil, España etc etc,
there are hundreds of queens by now, and honestly they start to blur.
This project answers one question: out of all of them, who are *your*
queens?

Try it: **https://ilovejackfruit.github.io/dragrank/**

## How it works

1. Pick up to 5 queens you already love.
2. Rate queens one by one: Love, Like, Neutral, Meh, Dislike, or Don't
   know (for the ones you don't remember, no guessing). The deck learns
   as you go. Love someone and similar queens show up sooner, a run of
   Mehs pushes that type away.
3. When you have enough favorites, you settle the order head to head,
   one pair at a time. Your clicks decide the ranking, not some score.
4. You get your Top 10 (and 11 to 20 if you're curious), plus a one-line
   read of your taste: what type of queen, which franchises, whether you
   stick to one era or not.

Your ratings stay in your browser. Nothing is stored anywhere else, and
nobody sees your list unless you show them.

## Run it locally

```
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app.py
```

Then open http://localhost:5002. Same files as the hosted version
(Flask just serves the `docs/` folder, which is also what GitHub Pages
publishes).

## The data

There's no official Drag Race API, so the dataset is hand-curated: 392
queens in [docs/data/queens.js](docs/data/queens.js), each with her
seasons, franchise, style tags (used by the recommendations, not shown
in the app) and a link to her wiki page. Photos come from the Drag Race
Fandom wiki.

Full rosters: US S1-16, All Stars, UK S1-7, Canada S1-6, Brasil S1-2.
Lighter coverage for Down Under, España, France, Philippines, Thailand
and Italia. Missing a queen? She goes straight into that file.

The recommendation logic lives in
[docs/script.js](docs/script.js) (`combinedScore` and
`pairSimilarity`, with comments on the exact weights if you want to
retune them).

## Known gaps

- Photo quality is okay, not great (the wiki thumbnails cap out around
  400-500px). Looking for a better source.
- Queens below your top 20 aren't ranked, just rated.
- No drag horoscope yet (the taste summary covers most of it).
