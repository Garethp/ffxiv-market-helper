# TODO

## Feature ideas

Split into two groups: features buildable now, and features blocked by (or best built on top of) a real backend — which doesn't exist yet, everything in `ConfigService` today is hardcoded in-memory data. Two different things push a feature into the blocked group: needing persisted history to work from, or being a long-term alert/notification that should run as a background job handed to a notification service rather than only while the tab happens to be open. Within each group, ideas are ordered roughly easiest-first, except where one depends on another.

### Not blocked by a backend

| Idea                     | Complexity | Value                  |
| ------------------------ | ---------- | ---------------------- |
| Trip-grouping            | Low        | Medium-High            |
| Top N opportunities view | Low        | Medium                 |
| Vendor-to-market trades  | Medium     | Medium-High            |
| Crafting cross-reference | High       | Low for now (deferred) |

#### Trip-grouping

**Complexity:** Low. **Value:** Medium-High.

Group the current opportunities by where you'd actually buy them, so a shopping run covers everything reachable in one trip instead of you working that out by hand.

Implementation notes:

- `ProfitPricing.buyDatacenter` (and `ConsistentPrice.cheapestWorld` within it) already identifies where each row's buy price came from — group ready rows by that instead of introducing new state.
- Render as sections per data center/world, each sorted by profit, rather than a flat table.

#### Top N opportunities view

**Complexity:** Low. **Value:** Medium.

A condensed view showing just the best few opportunities across all Tracked Items, for a quick glance instead of scanning the full table.

Implementation notes:

- Derive from the existing profit analysis results — sort by `expectedProfitPerDay` (configurable metric?) and take the top N.
- Could be a panel above ProfitTable or its own page.

#### Vendor-to-market trades

**Complexity:** Medium. **Value:** Medium-High.

Some items are sold infinitely by NPC vendors for gil, then resold on the market board for more. No buy-side listings or supply limits are involved, so this doesn't fit the existing Consistent-Price-from-listings model — it's a simpler, different risk profile (no risk of running out of stock to buy) and probably wants its own case in a buy-source union rather than being forced through `ProfitPricing`'s current shape.

Implementation notes: needs a vendor price data source per item (XIVAPI has NPC vendor data). Profit calc is just `sellPrice - vendorPrice`, no `ConsistentPrice`/buy-side listings involved at all.

#### Crafting cross-reference

**Complexity:** High. **Value:** Low for now (deferred).

Flag Tracked Items (or scan candidates) where the finished item's sell price beats the cost of its ingredients' Consistent Prices — a crafting trade, not just a buy-low-sell-high one.

Deferred: not worth building until crafting level is high enough to actually make the relevant recipes. Needs a recipe data source (e.g. XIVAPI or Teamcraft's data) to map an item to its ingredient item IDs and required craft level.

### Blocked by (or best built on) a backend

| Idea                           | Complexity                 | Value                                      |
| ------------------------------ | -------------------------- | ------------------------------------------ |
| Automatic trade log            | High                       | High                                       |
| Maybe-prune suggestions        | Low-Medium (given the log) | Medium                                     |
| Own-listing stockout warning   | Low-Medium                 | Medium                                     |
| Event-aware watchlist          | Medium                     | Medium                                     |
| New-patch item radar           | Medium                     | Medium                                     |
| Restock-timing patterns        | Medium                     | Medium                                     |
| Currency-exchange trades       | Medium-High                | Medium                                     |
| New-character worthiness check | High                       | Medium (rare, high payoff when it applies) |

#### Automatic trade log

**Complexity:** High. **Value:** High.

A log of trades actually completed (price bought/sold at, quantity, timing), sourced from Universalis rather than typed in by hand, so `expectedProfitPerDay` estimates can be checked against what actually happened.

Blocked on persistence — no point rebuilding this from scratch every session.

Implementation notes:

- Universalis sale history entries include `buyerName`, so a buy by one of our own Characters may be detectable by matching that name against sale history on the world we bought from.
- There's no equivalent seller/retainer field on sale history entries (only current listings expose `retainerName`), so detecting our own sells likely means inferring from one of our Retainer's current listings disappearing around the same time a matching sale history entry appears. That's a heuristic, not a guarantee — verify actual Universalis field behavior before relying on it, and be upfront in the UI if a logged sale is inferred rather than confirmed.

#### Maybe-prune suggestions

**Complexity:** Low-Medium, given the trade log already exists. **Value:** Medium.

Surface Tracked Items that haven't shown real profit over some recent window, as a suggestion to remove — never auto-removed.

Blocked on persistence, and ideally builds on the automatic trade log above rather than just estimated figures.

#### Own-listing stockout warning

**Complexity:** Low-Medium. **Value:** Medium.

Warn when one of our Retainer's own active listings is close to selling out, so it can be topped up before it silently drops to zero and stops earning.

Blocked on having a backend: this only matters if it can warn you while you're away from the tool, which means a background job polling stock levels and a notification service to push the warning through, not something computed only while the page happens to be open.

Implementation notes: needs the remaining quantity on our own current listings, which Universalis' current-listings data already exposes per retainer — the frontend-only part (surfacing it, picking a low-stock threshold) is easy; the alerting part is what needs the backend.

#### Event-aware watchlist

**Complexity:** Medium. **Value:** Medium.

Flag Tracked Items tied to known recurring in-game events (Moogle Treasure Trove, seasonal events, etc.) that reliably spike in demand, as a reminder to check them ahead of time.

Blocked on having a backend: to actually serve as a heads-up "ahead of time" rather than something you only notice if you happen to open the app on the right day, this wants a scheduled background check and a pushed notification.

Implementation notes: needs a small static reference table of event → affected items, and event dates/windows (recurring seasonal events are announced ahead of time; exact dates would need updating each year). That data modeling is easy on its own — it's the proactive-reminder part that needs the backend.

#### New-patch item radar

**Complexity:** Medium. **Value:** Medium.

Freshly added items on a new patch are often mispriced for the first week or two before the market settles, and it's easy to miss when a patch drops without a nudge.

Blocked on having a backend: being useful means getting nudged right around patch release, not just seeing a diff next time you happen to open the app — that's a background check plus a pushed notification.

Implementation notes: needs to know the current patch version and which items were added by it — either a static per-patch item list (maintained by hand each patch) or diffing `fetchMarketableItemIds()` against a saved snapshot from before the patch.

#### Restock-timing patterns

**Complexity:** Medium. **Value:** Medium.

Track what time of day a Tracked Item's cheap listings typically refill, so buy trips can be timed around it instead of guessed.

Blocked on persistence — needs a history of listing refresh timestamps per item to find a pattern from.

#### Currency-exchange trades

**Complexity:** Medium-High. **Value:** Medium.

Items bought with tomestones, allied society seals, or crafting/gathering scrips instead of gil, then resold on the market board. The cost side isn't gil, so profit isn't gil-per-gil-spent — it needs to be expressed as gil-per-currency-unit, compared against how fast that currency is actually earned, to be a meaningful ranking.

Implementation notes: another buy-source case distinct from market listings and vendor gil cost. Needs per-item currency cost data and a way to configure/derive each currency's personal earn rate (tomestones/week cap, scrips per roulette, etc.) — that's account-specific and worth tweaking without a code change, which is why this is best done once config is persisted rather than hardcoded.

#### New-character worthiness check

**Complexity:** High. **Value:** Medium — rare, but a high payoff on the occasion it actually applies.

If tracked items show a persistent (not one-off) price advantage in a Region none of the current Characters can reach, work out whether it'd be worth creating and provisioning a new Character there — rather than doing anything to an existing one — weighed against the setup cost (starting from scratch, gearing up a Retainer, no established gil).

Implementation notes: an occasional/on-demand analysis rather than a live feature. Needs to compare the best trades reachable from existing Characters' Regions against what the same Tracked Items would fetch in an unreached Region, sustained over time rather than a single snapshot — which needs persisted history — before it's worth suggesting.
