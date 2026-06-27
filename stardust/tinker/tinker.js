import { plot } from "./plot.js";
import { nodes, links, universe } from "./universe.js";
import { TradeSimulator } from "./trade.js";
import { ShipTypes } from "./systemShips.js";
import { transitionTick } from "./govDynamics.js";

const TIER_COLORS = {
  5: "#859900",
  4: "#268bd2",
  3: "#b58900",
  2: "#cb4b16",
  1: "#dc322f",
};

const plotted = plot(nodes, links);
const suns = plotted.suns;
const routes = plotted.routes;

// Economy simulation
const sim = new TradeSimulator(universe);
let totalTicks = 0;
let totalEvents = 0;
let selectedSystem = null;

suns.on("click.track", (event, d) => {
  selectedSystem = d.system;
});

function healthTick() {
  for (const system of universe) {
    system.health = Math.max(0, Math.min(1, system.computeHealth() + (Math.random() - 0.5) * 0.05));
    // Own ships matter most — pirates in-system directly hurt stability
    let neighborPressure =
      (system.shipDistribution[ShipTypes.MILITARY] ?? 0) +
      (system.shipDistribution[ShipTypes.POLICE] ?? 0) -
      (system.shipDistribution[ShipTypes.PIRATE] ?? 0);
    for (const nId in system.neighbors) {
      const n = universe[nId];
      if (!n) continue;
      neighborPressure +=
        (n.shipDistribution[ShipTypes.MILITARY] ?? 0) +
        (n.shipDistribution[ShipTypes.POLICE] ?? 0) -
        (n.shipDistribution[ShipTypes.PIRATE] ?? 0);
    }
    if (system.health > 0.4 && neighborPressure >= 0) {
      system.stabilityCounter = Math.min(100, system.stabilityCounter + 1);
    } else if (system.health < 0.25 || neighborPressure < 0) {
      system.stabilityCounter = Math.max(-100, system.stabilityCounter - 1);
    }
    system.wealth += system.health * (system.shipDistribution[ShipTypes.TRADER] ?? 0);
  }
}

function updateStabilityRings() {
  plotted.suns.select("circle.stability-ring")
    .attr("stroke", (d) => TIER_COLORS[d.system.governmentTier()])
    .attr("stroke-opacity", (d) => {
      const sc = d.system.stabilityCounter;
      return sc > 10 ? 1.0 : sc < -10 ? 0.35 : 0.7;
    });
}

function productionStub() {
  for (const system of universe) {
    for (const { commodity, weight } of system.getProducedCommodities()) {
      system.addToInventory(commodity.id, weight * 10);
    }
    for (const { commodity, weight } of system.getConsumedCommodities()) {
      system.removeFromInventory(commodity.id, weight * 10);
    }
  }
}

function refreshSystemPanel() {
  if (!selectedSystem) return;
  const div = document.getElementById("system-info");
  div.innerHTML = selectedSystem.extendedinfo();
  div.style.opacity = 1;
}

function renderTraderChart() {
  const container = document.getElementById("chart-container");
  container.innerHTML = "";
  const chart = document.createElement("div");
  chart.className = "ship-chart";
  const counts = universe.map((s) => s.shipDistribution[ShipTypes.TRADER] ?? 0);
  const max = Math.max(...counts, 1);
  for (let i = 0; i < universe.length; i++) {
    const count = counts[i];
    const bar = document.createElement("div");
    bar.className = "system-bar";
    bar.style.height = `${(count / max) * 100}%`;
    const tip = document.createElement("span");
    tip.className = "bar-tip";
    tip.textContent = `${universe[i].name}: ${count} traders`;
    bar.appendChild(tip);
    chart.appendChild(bar);
  }
  container.appendChild(chart);
}

function flashNodes(events) {
  if (events.length === 0) return;
  const eventIds = new Set(events.map((e) => e.system.id));
  plotted.suns
    .filter((d) => eventIds.has(d.id))
    .select("circle.stability-ring")
    .attr("stroke-width", 7)
    .attr("stroke-opacity", 1)
    .transition()
    .duration(800)
    .attr("stroke-width", 2)
    .attr("stroke-opacity", (d) => {
      const sc = d.system.stabilityCounter;
      return sc > 10 ? 1.0 : sc < -10 ? 0.35 : 0.7;
    });
}

function renderGovChart() {
  const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const healthSum = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let anarchyCount = 0;
  let multiGovCount = 0;
  for (const s of universe) {
    const t = s.governmentTier();
    counts[t]++;
    healthSum[t] += s.health;
    if (t === 1) {
      if (s.government === "Anarchy") anarchyCount++;
      else multiGovCount++;
    }
  }
  const container = document.getElementById("gov-chart");
  container.innerHTML = [5, 4, 3, 2, 1].map((t) => {
    const avgH = counts[t] > 0 ? Math.round((healthSum[t] / counts[t]) * 100) : 0;
    let line = `<span style="color:${TIER_COLORS[t]}">T${t}: ${counts[t]} <span style="color:#657b83">(h̄:${avgH}%)</span></span>`;
    if (t === 1) {
      line += `<br><span style="color:#657b83; font-size:0.85em">&nbsp;↳ Anarchy: ${anarchyCount} / MultiGov: ${multiGovCount}</span>`;
    }
    return line;
  }).join("<br>");
}

function runTicks(n) {
  let batchEvents = [];
  for (let i = 0; i < n; i++) {
    productionStub();
    sim.planTradeStep();
    sim.executeTradeStep();
    healthTick();
    const events = transitionTick(universe);
    batchEvents = batchEvents.concat(events);
  }
  totalTicks += n;
  totalEvents += batchEvents.length;
  document.getElementById("tick-display").textContent =
    `Ticks: ${totalTicks} | Events: ${totalEvents}`;
  renderTraderChart();
  renderGovChart();
  updateStabilityRings();
  flashNodes(batchEvents);
  refreshSystemPanel();
}

document.getElementById("run-ticks").addEventListener("click", () => {
  const n = parseInt(document.getElementById("tick-count").value, 10);
  if (n > 0) runTicks(n);
});

renderTraderChart();
renderGovChart();
updateStabilityRings();

// Search
let searchText = "";

window.addEventListener("keydown", (e) => {
  if (e.key === "Control" || e.key === "Tab") return;
  if (e.key === "Backspace") {
    searchText = searchText.slice(0, -1);
  } else if (e.key === "Escape") {
    searchText = "";
  } else if (e.key === "Enter") {
    const targets = suns.filter((n) =>
      n.system.name.startsWith(searchText.toUpperCase()),
    );
    if (targets.size() === 1) {
      targets.dispatch("click");
      searchText = "";
      return;
    }
  } else if (e.key.length === 1) {
    searchText += e.key;
  }
  if (searchText.length < 2) return;
  routes.classed("highlighted-link", false);
  suns
    .filter((n) => n.system.name.startsWith(searchText.toUpperCase()))
    .dispatch("mouseover");
});
