# Stardust Universe Dynamics Plan

Companion to `trade_plan.md`. Covers government stability, pirate dynamics,
and the feedback loops that keep the universe from freezing into a static state.

---

## Core idea

The economy (trade_plan.md) tends toward equilibrium. That's good but boring —
a universe where prices stabilise and nothing changes gives the player nothing to
react to. Government dynamics are the perturbation layer: they inject chaos when
the economy stagnates, and reward recovery with stability. The two simulations
feed each other.

---

## Government stability tiers

Governments are grouped into stability tiers. Transitions move up or down one
tier at a time (no jumping from Democracy straight to Anarchy).

```
Tier 5 — Advanced:      Democracy, Technocracy
Tier 4 — Organised:     CorporateState
Tier 3 — Authoritarian: Dictatorship, Communist
Tier 2 — Weak order:    Feudal, Theocracy
Tier 1 — Unstable:      MultiGovernment, Anarchy
```

### Downward transitions (economic collapse)
| From | To (pick one) |
|---|---|
| Democracy / Technocracy | CorporateState |
| CorporateState | Dictatorship or Communist |
| Dictatorship | Feudal |
| Communist | MultiGovernment |
| Feudal | Anarchy |
| Theocracy | Feudal or MultiGovernment |
| MultiGovernment | Anarchy |
| Anarchy | — (see revolution below) |

### Upward transitions (prosperity + neighbor stability)
| From | To (pick one) |
|---|---|
| Feudal / Theocracy / MultiGovernment | Dictatorship or Communist |
| Dictatorship / Communist | CorporateState |
| CorporateState | Democracy or Technocracy |
| Democracy / Technocracy | — (top tier) |

### The anarchy escape: revolution
Anarchy has no upward economic path — no traders means no recovery.
Instead, after a system spends N ticks in Anarchy with prices at floor,
a revolution fires spontaneously, pushing it to one of:
  Feudal / Theocracy / Communist / Dictatorship (random weighted pick)

This is the only transition that does NOT require economic health or neighbor
pressure. It is purely time-driven. It prevents the galaxy-wide chaos spiral.

The revolution destroys more goods than a normal collapse (see below) — the
new government starts from near-zero but at least has structure.

---

## Economic health metric

Each tick, a system's health is computed as:

```
health = mean(getPrice(id) / commodity.basePrice)
         over all commodities currently in inventory
```

- Floor-pegged prices → health ≈ 0.5
- Prices at base → health ≈ 1.0
- Shortage-driven high prices → health > 1.0 (prosperous)
- No inventory at all → health = 0 (crisis)

Normalised to [0, 1]: `normHealth = clamp((health - 0.5) / 1.5, 0, 1)`

A small noise term (±0.05) is added each tick so that systems near the
threshold don't oscillate rapidly.

---

## Stability counter

Each system carries a `stabilityCounter` (integer, range −20 to +20).

Each tick:
```
if normHealth > 0.6 and neighborPressure >= 0:
    stabilityCounter += 1
else if normHealth < 0.35 or neighborPressure < 0:
    stabilityCounter -= 1
// else: no change (dead zone between 0.35 and 0.6)
```

`neighborPressure` = sum of (military + police) in direct neighbors − pirates in
direct neighbors. Positive means stable neighbors, negative means pirate pressure.

When `stabilityCounter` reaches **+20**: trigger upward transition.
When `stabilityCounter` reaches **−20**: trigger downward transition (or revolution
if already Anarchy).

After any transition, reset `stabilityCounter` to 0.

This gives ~20 ticks of warning before a collapse, during which traders and the
player can observe price trends. Fast enough to feel dynamic, slow enough to react to.

---

## Collapse / transition event

When a government transition fires:

### Goods destruction
A fraction of the system's inventory is destroyed (not redistributed — lost):

| New government | Goods destroyed |
|---|---|
| Anarchy | 50% |
| Feudal / Theocracy / MultiGovernment | 30% |
| Dictatorship / Communist | 20% |
| CorporateState | 10% |
| Democracy / Technocracy | 5% |

Revolution (Anarchy → anything): 60% destroyed.

Destruction applies uniformly across all commodities. This is the "economic shock"
that shakes loose any stagnant price equilibrium.

### Ship redistribution on collapse (downward)
- A fraction of trader ships flee to random neighbors (10–30% depending on severity)
- Some police/military are lost (disbanded or defected)
- Pirates increase if transition is toward Anarchy

### Ship redistribution on recovery (upward)
- A fraction of pirate ships are destroyed or converted to police
- Neighboring systems may "donate" police/military ships if they have surplus
  (the wealthy-neighbor stabilisation mechanic)

---

## Pirate dynamics

### Growth
Each tick in Anarchy or MultiGovernment:
```
pirates += baseGrowthRate * (1 - traderCount / maxExpectedTraders)
```
No traders → maximum pirate growth. Many traders → slow growth (economy provides
alternatives to piracy). Capped at a per-system maximum.

### Suppression from neighbors
Each tick, for each Anarchy/high-pirate system:
```
for each neighbor with (military + police) > threshold:
    pirates -= suppressionRate * neighborMilitaryExcess
    neighbor.military -= 1  // costs the neighbor a ship
```
This creates a genuine cost for stable neighbors — maintaining order nearby
drains their military. Rich/militarised systems can afford it; weak ones cannot.

### Effect on trade
Traders avoid high-pirate systems (and their neighbors).
```
traderWillingness = 1 / (1 + pirateCount * avoidanceFactor)
```
Applied as a multiplier to the trader count when planTradeStep picks routes.
A heavily pirated system becomes economically isolated — reinforcing the collapse
spiral until revolution fires.

### Pirate effect on player
Pirates should eventually spawn as actual NPC ships in the game (hostile, will
attack). The count in the simulation maps to spawn probability when the player
enters a system. This links the background simulation directly to gameplay stakes.

---

## Wealth accumulation

Systems accumulate `wealth` as a separate counter (distinct from inventory):
```
wealth += sum(traderCount * mean(sellPrice - buyPrice)) per tick
wealth -= upkeepCost (based on ship count and government tier)
```

Wealth is used to:
- **Buy ships**: a system can "purchase" police/military from a neighbor by paying
  wealth. The neighbor loses the ship, the buyer gains it.
- **Trigger upward transitions**: very high wealth adds bonus to stabilityCounter
- **Fund revolution**: Anarchy systems with high accumulated hidden wealth can
  trigger a faster revolution

Wealth is hidden from the player but its effects (ship movements, government
changes) are observable.

---

## Cascade / shock events

When a Tier 4 or 5 system collapses (rare but impactful):
- The goods destruction is larger than the table above (×1.5 multiplier for
  high-tier collapse — these systems had more to lose)
- All direct neighbors take a −3 stabilityCounter hit (ripple instability)
- A "galactic event" flag fires that the game loop can use for a news message
  or player notification

This means a Democracy collapsing is a big deal — it destabilises its region.
Prevents the galaxy from ever fully flattening into a sea of stable systems.

---

## Tinker visualisation

To observe these dynamics, the tinker needs:

- **Node colour** by government tier: green (T5) → yellow (T4) → orange (T3) →
  red (T2) → dark red (T1/Anarchy)
- **Node size** by stabilityCounter: shrinking = trending toward collapse,
  growing = trending toward upgrade
- **Collapse flash**: brief highlight when a transition fires
- **System panel**: show current stabilityCounter, wealth, and health alongside
  existing info

---

## Implementation sequence

### Step 1: Health metric + stability counter
Add `health`, `stabilityCounter`, `wealth` fields to `System`.
Compute health in `productionStub` (or a separate `healthTick`).
Update stabilityCounter each tick. No transitions yet — just observe the counters
moving and verify they respond correctly to economic conditions.

### Step 2: Government transitions (instant)
When stabilityCounter hits ±20, fire the transition.
Apply goods destruction. Reset counter.
Verify in tinker that systems cycle through governments over long runs.

### Step 3: Pirate dynamics
Add pirate growth/suppression logic to the tick.
Apply trader avoidance multiplier.
Verify that Anarchy systems don't colonise the whole galaxy.

### Step 4: Revolution (anarchy escape)
Add tick counter per Anarchy system.
After N ticks, fire revolution: random low-tier government, 60% destruction.
Verify no permanent anarchy clusters remain after 5000+ ticks.

### Step 5: Wealth and ship purchasing
Add wealth accumulation and the ship-buying mechanic.
This is the most complex step — defer until steps 1–4 are stable.

### Step 6: Tinker colour/size visualisation
Colour nodes by tier, size by stabilityCounter.
This is the payoff — watching the galaxy breathe.

### Step 7: Merge into game loop
Same pattern as trade_plan.md Step 7: validate in tinker first, then wire
into SpaceScene with the same landing/departure tick trigger.

---

## Decisions

| Question | Decision |
|---|---|
| MultiGovernment tier | Tier 1, alongside Anarchy. Unstable and factional. |
| Revolution destination | Random, but weighted by neighboring government types. More Theocratic neighbors → higher chance of Theocratic revolution. |
| Pirate migration | Local only. Most low-tier systems naturally have a small pirate presence anyway. |

## Open questions

- Wealth is currently hidden. Should the player be able to observe system
  wealth in some form (e.g. station quality, population happiness indicator)?
