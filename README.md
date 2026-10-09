# Flight Rules

**Write the rules before the night falls.**

Flight Rules is a browser game for students aged about 10–16. It answers the NASA Space Apps Challenge 2026 challenge *Build a Junior Astronaut Mission Trainer*.

Students run a four-person outpost on the Moon. Real flight controllers decide what to do *before* trouble starts and write those decisions down as flight rules, and players do the same:

1. **Pack the lander.** Split 10,000 kg between solar panels, batteries, a water-wall storm shelter, greenhouse modules, oxygen, water and food.
2. **Write up to six flight rules**, for example *IF the Sun has set THEN set heaters to survival mode*. Rule order is priority, so the trade-off between power, life support, radiation shielding and food becomes a ranking students can see and edit.
3. **Fly** the outpost hour by hour through a **real record** of the 2023 lunar day and night at Chandrayaan-3's landing site (69.37° S, 32.32° E). The record includes the solar particle event of 1 September 2023.
4. **Debrief.** The game names the *first domino*, the decision that started the failure. Students then edit their rules and fly the **identical** record again, so the comparison shows exactly what their change did.

The ghost markers show what really happened at this site: ISRO put the Vikram lander to sleep before sunset on 4 September 2023, and it never answered the wake-up call on 22 September.

## Why it is different

Many mission games give students random events to react to. Here students plan ahead, the way NASA flight controllers do, and the environment is a fixed record built from real observations. When a student re-flies after changing one rule, any difference in the result comes from that rule.

## Run it

- **Offline / classroom:** open `dist/index.html` in any modern browser (double-click works; no server or internet needed after the first font load).
- **Development:** `npm run serve`, then open http://localhost:8080/src/ (ES modules need a local server).
- **Build the single-file version:** `node tools/build.mjs` → `dist/index.html`.
- **Tests:** `npm test` (16 unit tests on the simulator, rules, data checksums and share codes) and `python3 tests/e2e/smoke.py` (plays the whole loop in headless Chromium at desktop and phone width, light and dark).

No API keys, accounts, database or backend are needed. `.env.example` is intentionally empty of secrets.

## Deploy

GitHub Pages: push the repository, then in *Settings → Pages* serve the `main` branch root. The build writes the game to both `index.html` (repo root, for Pages) and `dist/index.html`. Any static host also works.

## Data

| Source | Agency | What it gives the game | Label in the app |
| --- | --- | --- | --- |
| [JPL Horizons API](https://ssd.jpl.nasa.gov/api/horizons.api) (DE441) | NASA/JPL | Sun and Earth elevation from the landing site, every 6 h, 20 Aug – 1 Oct 2023 | OBSERVED/COMPUTED |
| [DONKI](https://ccmc.gsfc.nasa.gov/DONKI-API/get/SEP?startDate=2023-08-20&endDate=2023-10-01) | NASA CCMC | Real solar particle event times (1 Sep 2023) and strong flares | OBSERVED |
| [OCHMO-TB-002 Rev B](https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-002-eclss.pdf) (NASA-STD-3001) | NASA | O₂ 1.083 / 0.771 kg per person-day, water 2.5 kg, food 3,035 kcal | PUBLISHED |
| [Zhang et al. 2020, *Science Advances*](https://doi.org/10.1126/sciadv.aaz1334) | (paper) | Lunar surface dose 1.369 mSv/day (Chang'e-4 LND) | PUBLISHED |
| Chandrayaan-3 mission updates | ISRO | Landing, sleep and wake-up dates for the ghost timeline | REPORTED |

Rebuild the record: `python3 pipeline/fetch_records.py`. It prints checksums that must match `meta.checksums` in `src/data/longNight.js` (n = 169, Sun sum 512.09, Earth sum 2682.6). The unit tests check the same checksums.

Every model constant lives in `src/sim/constants.js` with its source and one label: PUBLISHED, DERIVED or GAME ESTIMATE. The in-app *Data & sources* page shows the same table to players.

**Validation against the real record**

- Horizons puts sunset at the site on 4 Sep 2023, about 13 h after ISRO put Vikram to sleep that morning.
- Horizons puts the next sunrise on 19 Sep 2023 for a flat horizon. ISRO expected sunrise at the site on 22 Sep. The gap is consistent with local terrain, which this record does not model, and is listed as a limitation.
- Earth stays 9–25° above the horizon all mission, so direct-to-Earth radio is always possible here. A unit test checks this.

## Limitations

- **Terrain.** The horizon is flat, so real sunrise at the site may come later than the game shows.
- **Storm dose.** DONKI gives event *times*, not a surface dose. The storm's strength and the shelter's protection are GAME ESTIMATES.
- **Engineering values.** Masses, loads and battery chemistry are rounded GAME ESTIMATES chosen for play, not design values.
- **Greenhouse.** Growth is simplified: harvest after 240 lit hours, then 2,000 kcal per module per day while lit.
- **Missions.** Only one mission (Moon) ships so far. A Mars mission (2018 global dust storm, LMD dust record) is designed but not built.

## Project structure

```
src/data/longNight.js   environment record (real data + provenance + checksums)
src/sim/constants.js    every model number with source and label
src/sim/rules.js        flight-rule grammar and evaluator
src/sim/engine.js       pure, deterministic hourly simulator
src/sim/debrief.js      outcome explanation and "first domino" analysis
src/share.js            share codes (no personal data)
src/app.js, index.html  user interface
tools/build.mjs         bundles everything into dist/index.html
pipeline/               reproduces the data record from NASA services
tests/                  unit tests (node:test) and end-to-end smoke test (Playwright)
```

## Use of AI

This project was planned and coded with help from an AI assistant (Anthropic's Claude), working from the team's instructions. The team reviewed the code, data and claims. All data values come from the services and documents listed above; none were generated by AI. No AI-generated images, audio or video are used.

## Licence

Code: MIT (see `LICENSE`). NASA data is used under NASA's media and data guidelines. ISRO mission facts are cited from ISRO announcements. This is an independent student project, not an official NASA or ISRO product, and uses no agency logos.
