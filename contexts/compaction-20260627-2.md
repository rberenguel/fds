# Session Compaction Summary — 2026-06-27 (2)

## User Intent

- Debug and fix galaxy-wide government collapse toward T1 (Anarchy/MultiGovernment)
- Make the economy and government simulation more stable and player-legible
- Resize universe from 1000 to 256 systems (Elite-scale)
- Add piracy disruption to trade

## Contextual Work Summary

### Diagnosis
- Inspected three real systems (RIPYO, XORL, OZLUD) to identify collapse causes
- Found three root causes: trade throughput near-zero (traders only saw fresh production, not inventory), structural Machinery supply/demand deficit, and health thresholds set too high for a supply-constrained universe
- Added avg health per tier and Anarchy/MultiGov breakdown to the gov chart widget for ongoing diagnostics

### Economy Fixes
- Traders now draw 10% of existing inventory as tradeable surplus on top of fresh production — massively increased trade throughput
- Machinery consumption halved across Agricultural, Mining, and Frontier subtypes (structural supply/demand rebalance)
- Narcotics consumption made universal at low weight (0.3) across all subtypes instead of high-weight for a few — eliminates impossible consumption needs

### Government Stability Fixes
- Stability gain threshold lowered from 0.6 to 0.4 health; loss threshold raised from 0.35 to 0.25 — T3 systems can now gain stability instead of bleeding out
- System's own ships (military + police - pirates) now included in `neighborPressure` — pirate presence directly hurts their own system's stability, and clearing pirates directly helps it
- Revolution destruction reduced from 60% to 30%; newly-revolted systems get +20 stability head start (honeymoon period)
- Transition chance reduced 0.10 → 0.005, max per tick 5 → 1, revolution ticks 150 → 300 — transitions now rare enough to be legible during play

### Universe Resize
- `SYSTEMS` changed from 1000 to 256
- Added explicit connectivity guarantee after reblob sequence: finds all disconnected components and stitches each to the main component with a single edge — robust against RNG variation at smaller sizes

### Piracy & Trade Disruption
- `executeTradeStep` now computes disruption chance per transaction: `pirates / (pirates + military + police + 1)` at both endpoints (max of the two)
- If disrupted, cargo is destroyed (removed from source, never reaches destination); trader ship still moves
- Closes the player-action loop: kill pirates → lower disruption → more trade → higher health → stability gain → government upgrade

### Force Layout Tuning
- Charge: -300, link distance: 120 (strength 0.8), center strength: 0.15, alphaDecay: 0.02, ticks: 1000
- These give a well-spread connected layout; the graph is guaranteed connected before D3 sees it

## Files Touched

### Core Simulation
- **stardust/tinker/trade.js**: Inventory surplus (10% of stock) added to available trade per tick; `disruptionChance()` method; piracy cargo-destruction in `executeTradeStep`
- **stardust/tinker/systemEconomy.js**: Machinery consumption halved for Agricultural/Mining/Frontier; narcotics consumption universalised at weight 0.3 across all subtypes
- **stardust/tinker/govDynamics.js**: Revolution destruction 60→30%, honeymoon +20 stability, TRANSITION_CHANCE 0.005, MAX_TRANSITIONS_PER_TICK 1, ANARCHY_REVOLUTION_TICKS 300

### Tinker Harness
- **stardust/tinker/tinker.js**: `healthTick` self-ship pressure added; stability thresholds adjusted (gain >0.4, lose <0.25); `renderGovChart` extended with avg health per tier and Anarchy/MultiGov T1 breakdown
- **stardust/tinker/universe.js**: SYSTEMS 1000→256; connectivity guarantee block added after final reblob
- **stardust/tinker/plot.js**: Force parameters tuned for 256-system spread (charge -300, alphaDecay 0.02, ticks 1000)
