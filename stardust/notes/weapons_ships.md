# Weapons, Ships & Upgrades — Stardust Design Reference

## 1. Weapon taxonomy

### Energy weapons (draw from ship power pool, no ammo)
| Weapon | Notes |
|---|---|
| `LaserGun` | Light, fast fire rate, long range, low damage. Harassing weapon, not a primary threat. |
| `PlasmaGun` | Mid-tier. Better range and fire rate than mass driver, more damage than laser. Good default. |
| `BeamLaser` *(new)* | Continuous beam, soft-lock autoaim within a cone. Drains power fast. Counters shields well. |
| `PhasDisruptor` *(new)* | Mass-driver variant visually (plasma-coloured bullets). Bypasses shields entirely. Short-medium range. Rare. |
| `OverloadedWeapon` *(new)* | Any weapon can have an overloaded variant. More damage, different bullet colour, slowly damages the player while active. Found/looted, not bought. |

### Kinetic / ammo weapons (buy ammo at stations, ammo takes cargo space)
| Weapon | Cargo/unit | Notes |
|---|---|---|
| `MassDriverGun` | 0.02 | Very short range, devastating burst. Hard to aim for NPCs. Best in player hands. |
| `GaussCannon` | 0.5 | Scatter pattern suits human pilots, poor for NPC AI. Avoid giving to NPCs. |
| `MissileLauncher` | 1.0 | Tracking. Very dangerous in open space (no torus wrap to limit range). |
| `PhotonTorpedoLauncher` | 0.5 | High burst energy damage. Terrifying in volume. Has overheat mechanic (see below). |
| `EmpMissile` *(new)* | 1.0 | Half-autoaiming; second fire press detonates it. No hull damage — collapses shields and drains energy. Tactical. |
| `MineLauncher` *(new)* | 0.5 | Drops stationary trap behind ship. NPC AI can't handle mines. Player-favoured. |

### Active abilities (found as drops/powerups, not bought)
| Ability | Notes |
|---|---|
| `EmpBurst` | Local instant pulse. Disables nearby ships 3 seconds. Lifted from Destrier. |
| `GraviticBomb` | Drops, 1-second fuse, massive area damage. Doesn't affect own ship. Lifted from Destrier. |

---

## 2. Photon torpedo overheat

Each torpedo fired dumps heat into the launcher (`heat` float on weapon instance). Below threshold: fire freely. Above threshold: locked out for a few seconds. Heat decays continuously. Sustaining a slow cadence is fine; dumping a 6-torpedo burst requires a cooldown window after. Prevents ammo-less spray without adding a per-second recharge.

No recharge rate on any ammo weapon. You fly with what you bought. Running dry is a real consequence.

---

## 3. Shields

Three types, lifted from Destrier. In Destrier they are timed (3 seconds). In Stardust they are **energy-driven**: each shield drains the power pool at a fixed rate. Duration scales naturally with power pool size and recharge rate. Larger capacitor = longer shield windows.

| Shield | Effect | Countered by |
|---|---|---|
| Deflector | Stops kinetic strongly, energy mildly | Energy weapons |
| Energy shield | Stops energy weapons completely, no effect on kinetic | Kinetic weapons |
| Phase shield | Full phasing — pass through all projectiles, ships, asteroids. Nothing hits you. Romulan-cloak visual. Can't fire secondary while active. | Running out of power |

Phase shield costs the most energy by far (~5–10× a fired weapon per second). You get ~3–5 seconds at baseline power pool. The tactical loop: phase in, mass-driver the target, phase out before energy runs dry — or you're defenceless.

**Boost** (already implemented in `stardust/weapons/boost.js`) also briefly activates `phaseShield` for the boost duration. This is worth keeping: boosting makes you briefly untouchable, which rewards aggressive play.

---

## 4. Ammo economy

No per-weapon recharge. Ammo is bought at stations. Cargo hold is the constraint.

| Item | Cargo units |
|---|---|
| Missile | 1.0 |
| EMP missile | 1.0 |
| Photon torpedo | 0.5 |
| Gauss cannon shot | 0.5 |
| Mass driver round | 0.02 |
| Mine | 0.5 |
| Trade goods | 1.0 |

A pirate build is: fill your hold with missiles, go hunt traders. Perfectly valid if you can afford it.

---

## 5. Ship progression

### Base ships

| Ship | Cargo | Extension slots | Notes |
|---|---|---|---|
| Bobcat | 20 units | 3 | Starting ship. Traders fly these. Common, flexible. |
| Lynx | 10 units | 2 | The goal. Better combat stats (speed, turn rate). Fewer slots and less cargo. |
| Panther | 5 units | — | Heavy NPC platform. Multiple weapon mounts. Player never flies one. Rare spawn: military escort, pirate capital ship. |

The player starts as a Bobcat. A Lynx is aspirational — bought at a HighTech or Military station for serious credits. The security Lynxes patrolling the station are a constant reminder of what you're working toward.

### Extension slots

Extension slots are the hard constraint on ship builds. Weapons beyond the first, shield systems, cargo compressors, targeting computers all consume a slot.

Slots beyond the base number are purchasable but exponentially more expensive:

| Extra slots | Bobcat cost | Lynx cost |
|---|---|---|
| Base (included) | — | — |
| +1 | 10,000 cr | 15,000 cr |
| +2 | 50,000 cr | 75,000 cr |
| +3 | 250,000 cr | 375,000 cr |
| +4 | 1,250,000 cr | 1,875,000 cr |

In theory infinite; in practice 2–3 purchased slots is the realistic ceiling. A maxed-out Bobcat with 6+ slots is a deliberate creative achievement.

---

## 6. Station upgrades (consume extension slots)

### Weapons
Weapon mount beyond slot 1 requires a hardpoint upgrade (costs a slot). Each additional mount adds a permanent energy drain.

Each hardpoint fires **independently** — separate fire bindings for slot 0 and slot 1 (and beyond). This means:

- You can equip a **mixed loadout**: e.g. PlasmaGun on slot 0, MassDriverGun on slot 1.
- Tactically: fire plasma at range, switch to mass driver up close, or fire both simultaneously for maximum damage.
- Scarcity matters: finding *two* of the weapon you want is harder than finding one. A mixed load is often the practical reality.
- The station shop sells weapons **per hardpoint**, not as a paired set. Finding a second MassDriverGun in the same system is not guaranteed.

**Implementation note:** currently `weapons[]` fires all entries simultaneously on a single keybind. To support independent fire, add two separate fire actions (e.g. `shootPrimary` → `weapons[0].fire()`, `shootSecondary` → `weapons[1].fire()`), distinct from the existing `secondaryWeapons[]` slot. The `roids2/powerups.js` system replaces the whole `weapons[]` array and will need updating to target individual indices.

### Cargo
| Upgrade | Effect | Availability |
|---|---|---|
| Matter compressor Mk1 | ×1.5 cargo | Industrial systems |
| Matter compressor Mk2 | ×2.0 cargo | HighTech systems |
| Matter compressor Mk3 | ×3.0 cargo | Military or wreck loot only |

Multiple compressors stack multiplicatively. A Lynx with two Mk2 compressors gets 10 × 4 = 40 units — significantly more than a stock Bobcat, but at enormous cost and slot commitment.

### Power & flight
| Upgrade | Effect |
|---|---|
| Energy capacitor | Increases max power pool |
| Recharge coil | Increases power recovery rate |
| Engine tune | Modifies thrust/turn constants directly |
| Targeting computer | Tightens missile lock cone, extends lock range. Required for guided EMP missile. |
| **Power management computer** | Unlocks real-time power allocation UI (Weapons / Engines / Shields). Player only — NPCs run fixed ratios. Found as rare loot or sold at Military stations. |

### Passive (lifted from Destrier powerups)
| Upgrade | Effect |
|---|---|
| Emergency brakes | Thrust opposite direction brakes immediately |
| Point sight | Aiming overlay — shows where you're actually shooting |
| Faster rotation | Increased yaw rate |

---

## 7. Power management computer

When installed, the player can distribute total power capacity across three systems in real time:

- **Weapons**: faster fire recharge, more energy-weapon damage
- **Engines**: faster thrust response
- **Shields**: longer shield windows, faster recovery

NPCs do not have this. They run fixed ratios and don't tactically reallocate. This is intentional — the power management computer is a player-skill differentiator, not an NPC behaviour.

Found as rare loot (wreck fields, elite pirate drops) or sold at Military stations. Probably the most impactful single item in the game.

---

## 8. Rarity / system availability

| System type | Sells |
|---|---|
| Agricultural | Nothing useful |
| Industrial | LaserGun, PlasmaGun, basic missiles, cargo pods, Mk1 compressor |
| HighTech | MassDriverGun, PhotonTorpedoLauncher, shield systems, hardpoints, Mk2 compressor, targeting computer |
| Military | EMP missile, phase disruptor, Bobcat/Lynx hulls, Mk3 compressor, power management computer (rare stock) |
| Anarchy / pirate haven | Mine launcher, cluster warhead, overloaded weapons, stolen goods — illegal to carry in lawful systems |

Wreck loot: when a military or elite pirate ship dies, small chance of a floating crate. Scoop it. Could be rare weapons, ammo, or prototype parts (overloaded weapon variant, Mk3 compressor, power management computer).

---

## 9. New weapons — implementation notes

| Weapon | Key mechanic | Lift from |
|---|---|---|
| `BeamLaser` | Continuous raycast, cone autoaim, energy drain per frame | New |
| `PhasDisruptor` | Mass driver projectile, `shieldPiercing = true` flag, plasma bullet visual | Extend `MassDriverGun` |
| `OverloadedVariant` | Wrapper: higher damage, different bullet colour, `ship.e -= drain * dt` while firing | New |
| `EmpMissile` | Missile with `guided = 0.3` (partial tracking), second-fire detonation, EMP blast on explode | Extend `MissileLauncher` + lift `EmpBlast` |
| `MineLauncher` | Spawns stationary `Mine` object at ship pos, timed or proximity detonation | Lift from `bomb.js` |
| `BeamLaser` autoaim | Scan `otherShips` within cone angle (±15°), lock to nearest, draw line | New |
