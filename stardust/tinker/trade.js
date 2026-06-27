export { TradeSimulator };

import {
  SystemCategories,
  GovernmentTypes,
  commodityRegistry,
} from "./systemEconomy.js";
import { ShipTypes, getInitialShipDistribution } from "./systemShips.js";

class TradeSimulator {
  constructor(universe) {
    this.universe = universe;
    this.pendingTransactions = [];
  }

  calculateProfit(sourceSystem, destinationSystem, commodityId, quantity) {
    const buyPrice = sourceSystem.getPrice(commodityId);
    const sellPrice = destinationSystem.getPrice(commodityId);
    return (sellPrice - buyPrice) * quantity;
  }

  findBestTradeRoute(sourceSystem, commodityId, quantity) {
    let bestDestination = null;
    let bestProfit = 0;

    for (const neighborId in sourceSystem.neighbors) {
      const destinationSystem = this.universe[neighborId];
      if (!destinationSystem) {
        console.warn(`Neighbor system with ID ${neighborId} not found.`);
        continue;
      }

      const profit = this.calculateProfit(
        sourceSystem,
        destinationSystem,
        commodityId,
        quantity,
      );
      if (profit > bestProfit) {
        bestProfit = profit;
        bestDestination = destinationSystem;
      }
    }

    return { destination: bestDestination, profit: bestProfit };
  }

  planTradeStep() {
    this.pendingTransactions = []; // Clear previous transactions
    const systemProductions = new Map();

    for (const system of this.universe) {
      // 1. Generate *Potential* Production/Consumption (but don't apply yet)
      const production = {};
      const consumption = {};

      const producedCommodities = system.getProducedCommodities();
      for (const produced of producedCommodities) {
        production[produced.commodity.id] = Math.floor(
          produced.weight * (1 + (Math.random() - 0.5) * 0.4) * 10,
        );
        if (production[produced.commodity.id] < 0) {
          production[produced.commodity.id] = 0;
        }
      }

      const consumedCommodities = system.getConsumedCommodities();
      for (const consumed of consumedCommodities) {
        consumption[consumed.commodity.id] = Math.floor(
          consumed.weight * (1 + (Math.random() - 0.5) * 0.4) * 10,
        );
        if (consumption[consumed.commodity.id] < 0) {
          consumption[consumed.commodity.id] = 0;
        }
      }
      // Apply consumption to production.  This is "potential" production.
      for (const commodityId in consumption) {
        if (production[commodityId]) {
          const consumedAmount = Math.min(
            consumption[commodityId],
            production[commodityId],
          );
          production[commodityId] -= consumedAmount; //Consume
        }
      }
      systemProductions.set(system, production); //Store the system production
    }

    // 2. Simulate Trader Decisions (but only *plan* the trades)
    for (const system of this.universe) {
      //Iterate again for the trades
      let traders = system.shipDistribution[ShipTypes.TRADER];
      if (traders <= 0) {
        continue;
      }

      // Get availableCommodities from precalculated production plus 10% of inventory surplus
      const availableCommodities = { ...systemProductions.get(system) };
      for (const [id, qty] of Object.entries(system.inventory)) {
        if (qty > 0) {
          availableCommodities[id] = (availableCommodities[id] || 0) + Math.floor(qty * 0.1);
        }
      }

      for (let i = 0; i < traders; i++) {
        let bestCommodityId = null;
        let bestProfit = -Infinity;
        let bestDestination = null;
        let bestQuantity = 0;

        for (const commodityId in availableCommodities) {
          const commodity = commodityRegistry.getCommodity(commodityId);
          if (
            commodity.isContraband &&
            system.government !== GovernmentTypes.Anarchy
          ) {
            continue;
          }

          const MINIMUM_QUANTITY = 5;
          const quantityToTrade = Math.min(
            Math.floor(availableCommodities[commodityId] * 0.5),
            50,
          );
          if (quantityToTrade < MINIMUM_QUANTITY) {
            continue;
          }

          const { destination, profit } = this.findBestTradeRoute(
            system,
            commodityId,
            quantityToTrade,
          );

          if (destination && profit > bestProfit) {
            bestProfit = profit;
            bestDestination = destination;
            bestCommodityId = commodityId;
            bestQuantity = quantityToTrade;
          }
        }

        const MINIMUM_PROFIT_THRESHOLD = 5;
        const RELOCATION_CHANCE = 0.2;

        if (
          bestCommodityId &&
          bestDestination &&
          bestProfit > MINIMUM_PROFIT_THRESHOLD
        ) {
          // *PLAN* the trade (add to pendingTransactions)
          this.pendingTransactions.push({
            sourceSystemId: system.id,
            destinationSystemId: bestDestination.id,
            commodityId: bestCommodityId,
            quantity: bestQuantity,
            profit: bestProfit,
            shipType: ShipTypes.TRADER,
          });

          availableCommodities[bestCommodityId] -= bestQuantity; //Reduce from available
        } else if (Math.random() < RELOCATION_CHANCE) {
          const neighborIds = Object.keys(system.neighbors);
          if (neighborIds.length > 0) {
            const randomNeighborId =
              neighborIds[Math.floor(Math.random() * neighborIds.length)];
            const destinationSystem = this.universe[randomNeighborId];
            if (destinationSystem) {
              this.pendingTransactions.push({
                sourceSystemId: system.id,
                destinationSystemId: destinationSystem.id,
                commodityId: null,
                quantity: 0,
                profit: 0,
                shipType: ShipTypes.TRADER,
                notes: "Forced relocation",
              });
            }
          }
        }
      }
    }
    // Return the *planned* transactions, do NOT execute yet
    return this.pendingTransactions;
  }

  disruptionChance(system) {
    const pirates = system.shipDistribution[ShipTypes.PIRATE] ?? 0;
    const law = (system.shipDistribution[ShipTypes.MILITARY] ?? 0) +
                (system.shipDistribution[ShipTypes.POLICE] ?? 0);
    return pirates / (pirates + law + 1);
  }

  executeTradeStep() {
    const executedTransactions = [];
    for (const transaction of this.pendingTransactions) {
      const {
        sourceSystemId,
        destinationSystemId,
        commodityId,
        quantity,
        shipType,
      } = transaction;
      const sourceSystem = this.universe[sourceSystemId];
      const destinationSystem = this.universe[destinationSystemId];

      if (!sourceSystem || !destinationSystem) {
        console.warn(
          `Invalid transaction: Source or destination system not found.`,
          transaction,
        );
        continue;
      }

      if (shipType === ShipTypes.TRADER) {
        // Piracy check: if either endpoint is dangerous, cargo may be lost
        const disruption = Math.max(
          this.disruptionChance(sourceSystem),
          this.disruptionChance(destinationSystem),
        );
        const disrupted = commodityId && quantity > 0 && Math.random() < disruption;

        // Move the trader regardless (it made the trip)
        const traderIndex = sourceSystem.shipDistribution[ShipTypes.TRADER];
        if (traderIndex > 0) {
          sourceSystem.shipDistribution[ShipTypes.TRADER] -= 1;
          destinationSystem.shipDistribution[ShipTypes.TRADER] += 1;
        } else {
          console.warn("Inconsistency detected: trying to move trader that does not exist");
          continue;
        }

        if (disrupted) {
          // Pirates take the cargo — removed from source, never reaches destination
          sourceSystem.removeFromInventory(commodityId, quantity);
          transaction.notes = "disrupted by pirates";
        } else if (commodityId && quantity > 0) {
          sourceSystem.removeFromInventory(commodityId, quantity);
          destinationSystem.addToInventory(commodityId, quantity);
        }
        executedTransactions.push(transaction);
      }
    }

    this.pendingTransactions = [];
    return executedTransactions;
  }
  getBuyPrice(system, commodityId) {
    return system.getPrice(commodityId) || null;
  }

  getSellPrice(system, commodityId) {
    return system.getPrice(commodityId) || null;
  }

  playerBuy(player, commodityId, quantity) {
    // Placeholders by Gemini
    const system = player.currentSystem;
    const price = this.getBuyPrice(system, commodityId);
    if (!price) {
      console.error("Commodity not found or price unavailable.");
      return false;
    }
    const totalCost = price * quantity;

    if (player.credits < totalCost) {
      // Placeholder
      console.log("Not enough credits!");
      return false;
    }

    if (player.currentSystem.getInventory(commodityId) < quantity) {
      // Placeholder
      console.log("Not enough available in the system!");
      return false;
    }

    // Update player inventory and credits
    if (!player.inventory[commodityId]) {
      player.inventory[commodityId] = 0;
    }
    player.inventory[commodityId] += quantity;
    player.credits -= totalCost;

    // Update system inventory
    player.currentSystem.removeFromInventory(commodityId, quantity);

    console.log(
      `Bought ${quantity} of ${commodityRegistry.getCommodity(commodityId).name} for ${totalCost.toFixed(2)} credits.`,
    );
    return true; // Indicate success
  }

  playerSell(player, commodityId, quantity) {
    const system = player.currentSystem;
    const price = this.getSellPrice(system, commodityId);
    if (!price) {
      console.error("Commodity not found, or price unavailable");
      return false;
    }

    if (
      !player.inventory[commodityId] ||
      player.inventory[commodityId] < quantity
    ) {
      console.log("Not enough in player inventory!");
      return false;
    }
    const totalRevenue = price * quantity;

    //Update player inventory and credits
    player.inventory[commodityId] -= quantity;
    player.credits += totalRevenue;

    // Update system inventory.
    player.currentSystem.addToInventory(commodityId, quantity);
    console.log(
      `Sold ${quantity} of ${commodityRegistry.getCommodity(commodityId).name} for ${totalRevenue.toFixed(2)} credits`,
    );
    return true; // Indicate success
  }
}

function renderTradeMove(transaction) {
  const commodity = commodityRegistry.getCommodity(transaction.commodityId);
  // Allow moves with no commodities
  const commodityName = commodity ? commodity.name : "No Commodity";
  const sourceSystem = universe[transaction.sourceSystemId]; // Direct access by index
  const destinationSystem = universe[transaction.destinationSystemId]; // Direct access by index

  if (!sourceSystem || !destinationSystem) {
    console.error("Source or destination system not found:", transaction);
    return;
  }

  const html = `
        <div class="trade-move" style="display: flex; flex-direction: row; align-items: center; margin-bottom: 5px;">
            <span class="tr-source" style="margin-right: 10px;">Source: ${sourceSystem.name} (ID: ${sourceSystem.id})</span>
            <span style="margin-right: 5px;">-&gt;</span>
            <span class="tr-destination" style="margin-right: 10px;">Destination: ${destinationSystem.name} (ID: ${destinationSystem.id})</span>
            <span class="tr-commodity" style="margin-right: 10px;">Commodity: <span class="commodity">${commodityName}</span></span>
            <span class="tr-quantity" style="margin-right: 10px;">Quantity: <span class="quantity">${transaction.quantity}</span></span>
            <span class="tr-profit">Profit: <span class="profit">${transaction.profit.toFixed(2)}</span></span>
             ${transaction.notes ? `<span class="tr-notes" style="margin-left: 10px;">(${transaction.notes})</span>` : ""}
        </div>`;

  //Create container for all transactions if it does not exist yet
  let tradeLogDiv = document.getElementById("tradeLog");
  if (!tradeLogDiv) {
    tradeLogDiv = document.createElement("div");
    tradeLogDiv.id = "tradeLog";
    document.body.appendChild(tradeLogDiv);
  }

  if (tradeLogDiv) {
    tradeLogDiv.insertAdjacentHTML("beforeend", html);
  }
}

function renderShipChart(universe) {
  const chartContainer = document.getElementById("chart-container");
  //chartContainer.innerHTML = ''; // Clear previous chart
  const e = document.createElement("DIV");
  e.classList.add("ship-chart");
  const f = document.createElement("DIV");
  f.classList.add("ship-chart");
  f.classList.add("upside-chart");
  for (let i = 0; i < universe.length; i++) {
    const system = universe[i];
    const shipCount = system.shipDistribution[ShipTypes.TRADER];
    const barHeight = shipCount * 2; // Scale the height (e.g., 2px per ship)

    const bar = document.createElement("div");
    bar.classList.add("system-bar");
    if (i >= universe.length / 2) {
      bar.classList.add("upside-bar");
    }
    bar.style.height = `${barHeight}px`;
    bar.title = `${system.name} (ID: ${system.id}): ${shipCount} traders`; //Basic Tooltip

    // Create the tooltip element
    const tooltip = document.createElement("span");
    tooltip.classList.add("tooltip");
    tooltip.textContent = `${system.name} (ID: ${system.id}): ${shipCount} traders`;
    bar.appendChild(tooltip);
    if (i < universe.length / 2) {
      e.appendChild(bar);
    } else {
      f.appendChild(bar);
    }
  }
  chartContainer.appendChild(e);
  chartContainer.appendChild(f);
}

if (window.DEVMODE) {
  window.TradeSimulator = TradeSimulator;
  window.renderTransactions = (transactions) => {
    for (let transaction of transactions) {
      renderTradeMove(transaction);
    }
  };
  window.simTrade = (N = 2) => {
    const s = new window.TradeSimulator(window.universe);
    const sim = () => {
      const trans = s.planTradeStep();
      document.body.insertAdjacentHTML("beforeend", "<hr/>");
      window.renderTransactions(trans);
      s.executeTradeStep();
    };
    for (let i = 0; i < N; i++) {
      sim();
    }
  };
  window.simMove = (N = 20, skip = 0) => {
    const s = new window.TradeSimulator(window.universe);
    const sim = (render = true) => {
      s.planTradeStep();
      s.executeTradeStep();
      if (render) renderShipChart(window.universe);
    };
    for (let i = 0; i < N; i++) {
      const render = i >= skip;
      sim(render);
    }
  };
}
