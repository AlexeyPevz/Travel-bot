## Known issues and next fixes

- Affiliate links open main page instead of hotel
  - Cause: using generic/vitrine URLs. Fixed to use canonical `https://level.travel/hotels/{hotel_id}` with `affmarker=627387` and UTM tags.
  - Verify: Bot buttons now open hotel pages, not the homepage.

- Nights mismatch (profile says 12, results show 7)
  - Root cause: Provider logic defaults to 7 nights when `dateType` is `flexible` and `flexibleMonth` is not set, ignoring `tripDuration`.
  - Fix plan: When `tripDuration` is provided, always use it regardless of `flexibleMonth`. If `startDate`/`endDate` are known (parsed from onboarding), switch to `fixed` search.

- Children flow error after providing children count
  - Symptom: after replying with a number of children, bot throws a generic error before ages question or summary.
  - Likely cause: edge case in state transition to ages step, or parsing ages when not yet provided.
  - Fix plan: guard state before parsing, prompt ages reliably, allow skipping ages (assume empty ages for API) or re-ask; add validation + retries, and log details.

- Profile → Search not fully respected
  - Missing mappings: `departureCity`, `adults`, `children`, `countries`, `budget`, `tripDuration`, `startDate/endDate` must prefill search and skip duplicate questions.
  - Date handling: if profile has dates, treat as `fixed`; if only month, map to `flexibleMonth` and use provided `tripDuration`.
  - Action: ensure prefill + skip logic, sync all fields, mark `dateType` properly.

- Missing questions in search flow
  - No explicit questions for: star rating, meal type, resort/region within country.
  - Plan: add optional steps with defaults (“не важно”) and apply as filters/sorting weights.

- Card data too sparse (meal, beach line “not specified”)
  - Reason: grouped search results often lack rich fields; some keys differ across operators.
  - Done: improved mapping for `mealType`, photos (full/x1024/x500), `beachDistance/Type`, `airportDistance`.
  - Plan: for top-N results, fetch hotel details (`references/hotels`) to enrich cards; cache to reduce latency.

- Result links parameters (dates/nights/adults/kids)
  - Ensure `start_date`, `nights`, `adults`, `kids` are added to URL. If only tripDuration is known, still pass nights.

- AI analysis integration
  - OpenRouter key connected; fallback parsing still active.
  - Plan: feed AI output directly into `searchData` (countries, budget, dates, duration) with confidence thresholds.

- Telegram 429 on shutdown
  - Log: `ETELEGRAM: 429 Too Many Requests: close` when stopping bot.
  - Plan: backoff and ignore non-critical close errors; don’t spam `close` during systemd restarts.

- Graceful shutdown warnings
  - `queue.pause is not a function` and `redis.quit is not a function` on shutdown.
  - Plan: detect Bull vs BullMQ APIs; call `queue.close()`/`queue.pause?` conditionally; use `redis.disconnect()` for ioredis.

- Mini App
  - Switched profile API to `/api/v1/profile`; ensure Telegram auth in WebApp sets JWT; profile loads.
  - Plan: show same enriched tour cards as bot; use `/api/tours` and render hotel detail enrichments.

- Sorting/filters
  - Plan: add filters (stars, meals, beach line) and sorting by price/rating/match.

- Data consistency
  - Store and use `departureCity` in `profiles`; ensure both bot and app update/read consistently.


