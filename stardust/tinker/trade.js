import {
  SystemCategories,
  GovernmentTypes,
  commodityRegistry,
} from "./systemEconomy.js";
import { ShipTypes, getInitialShipDistribution } from "./systemShips.js";

class TradeSimulator {
  constructor(universe) {
    this.universe = universe; // Now an array of System objects
  }

  // Helper function to simulate price fluctuations (remains the same)
  _applyPriceFluctuation(basePrice, system, commodityId, isBuy) {
    let price = basePrice;
    const fluctuationFactor = 0.05; //  5% fluctuation

    // Apply demand/supply
    const produced = system.getProducedCommodities(); // Get from system
    const consumed = system.getConsumedCommodities(); // Get from system

    let demandWeight = 0;
    let supplyWeight = 0;

    for (const prod of produced) {
      if (prod.commodity.id === commodityId) {
        supplyWeight = prod.weight;
        break;
      }
    }
    for (const cons of consumed) {
      if (cons.commodity.id === commodityId) {
        demandWeight = cons.weight;
        break;
      }
    }

    if (isBuy) {
      // If the ship buys, high demand increases price, production decreases
      price *= 1 + (demandWeight - supplyWeight) * fluctuationFactor;
    } else {
      //If the ship is selling, high production decreases price, high demand increases.
      price *= 1 + (demandWeight - supplyWeight) * fluctuationFactor;
    }

    // Apply random fluctuation
    price *= 1 + (Math.random() - 0.5) * 2 * fluctuationFactor;

    return Math.max(0, price); // Ensure price is not negative
  }
  // Calculates the profit for a given trade route (remains the same)
  calculateProfit(sourceSystem, destinationSystem, commodityId, quantity) {
    const commodity = commodityRegistry.getCommodity(commodityId);
    if (!commodity) {
      console.warn(`Commodity with ID ${commodityId} not found.`);
      return 0; // Or throw an error
    }
    const buyPrice = this._applyPriceFluctuation(
      commodity.basePrice,
      sourceSystem,
      commodityId,
      true,
    );
    const sellPrice = this._applyPriceFluctuation(
      commodity.basePrice,
      destinationSystem,
      commodityId,
      false,
    );
    const profit = (sellPrice - buyPrice) * quantity;
    return profit;
  }

  // Finds the best trade route (remains the same)
  findBestTradeRoute(sourceSystem, commodityId, quantity) {
    let bestDestination = null;
    let bestProfit = 0;

    for (const neighborId in sourceSystem.neighbors) {
      const destinationSystem = this.universe[neighborId]; // Access by index!
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

  simulateTradeStep() {
    const transactions = [];

    for (const system of this.universe) {
      // 1. Generate Current Production/Consumption State - Remains the same
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

      // 2. Simulate Trader Decisions - *KEY CHANGES HERE*
      let traders = system.shipDistribution[ShipTypes.TRADER];
      if (traders <= 0) {
        continue;
      }

      const availableCommodities = { ...production };

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

          const MINIMUM_QUANTITY = 5; // Minimum quantity to trade
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

        const MINIMUM_PROFIT_THRESHOLD = 5; // Minimum profit to make a trade
        const RELOCATION_CHANCE = 0.2; // 20% chance to relocate even if no profit

        // --- FORCED RELOCATION LOGIC (Modified) ---
        if (
          bestCommodityId &&
          bestDestination &&
          bestProfit > MINIMUM_PROFIT_THRESHOLD
        ) {
          // Profitable trade found: Execute the trade
          transactions.push({
            sourceSystemId: system.id,
            destinationSystemId: bestDestination.id,
            commodityId: bestCommodityId,
            quantity: bestQuantity,
            profit: bestProfit,
            shipType: ShipTypes.TRADER,
          });

          availableCommodities[bestCommodityId] -= bestQuantity;
          system.shipDistribution[ShipTypes.TRADER] -= 1;
          bestDestination.shipDistribution[ShipTypes.TRADER] += 1;
        } else if (Math.random() < RELOCATION_CHANCE) {
          // Random relocation
          // No profitable trade found, but relocate with a certain probability
          const neighborIds = Object.keys(system.neighbors);
          if (neighborIds.length > 0) {
            const randomNeighborId =
              neighborIds[Math.floor(Math.random() * neighborIds.length)];
            const destinationSystem = this.universe[randomNeighborId];
            if (destinationSystem) {
              transactions.push({
                sourceSystemId: system.id,
                destinationSystemId: destinationSystem.id,
                commodityId: null, // No commodity traded
                quantity: 0,
                profit: 0, // No profit
                shipType: ShipTypes.TRADER, // Still a trader move
                notes: "Forced relocation", // Add a note for clarity
              });

              system.shipDistribution[ShipTypes.TRADER] -= 1;
              destinationSystem.shipDistribution[ShipTypes.TRADER] += 1;
            }
          }
        } // else: Trader stays in the current system (no transaction added)
      }
      // Apply consumption.
      for (const commodityId in consumption) {
        if (production[commodityId]) {
          const consumedAmount = Math.min(
            consumption[commodityId],
            production[commodityId],
          );
          production[commodityId] -= consumedAmount; //Consume
        }
      }
      // Store the current available
      system.currentProduction = production;
    }

    return transactions;
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
    tradeLogDiv.insertAdjacentHTML("beforeend", html); // Add to the end of the body, or a specific container
  }
}

function renderShipChart(universe) {
  const chartContainer = document.getElementById("chart-container");
  //chartContainer.innerHTML = ''; // Clear previous chart
  const e = document.createElement("DIV");
  e.classList.add("ship-chart");
  for (const system of universe) {
    const shipCount = system.shipDistribution[ShipTypes.TRADER];
    const barHeight = shipCount * 2; // Scale the height (e.g., 2px per ship)

    const bar = document.createElement("div");
    bar.classList.add("system-bar");
    bar.style.height = `${barHeight}px`;
    bar.title = `${system.name} (ID: ${system.id}): ${shipCount} traders`; //Basic Tooltip

    // Create the tooltip element
    const tooltip = document.createElement("span");
    tooltip.classList.add("tooltip");
    tooltip.textContent = `${system.name} (ID: ${system.id}): ${shipCount} traders`;
    bar.appendChild(tooltip);

    e.appendChild(bar);
  }
  chartContainer.appendChild(e);
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
      const trans = s.simulateTradeStep();
      document.body.insertAdjacentHTML("beforeend", "<hr/>");
      window.renderTransactions(trans);
    };
    for (let i = 0; i < N; i++) {
      sim();
    }
  };
  window.simMove = (N = 20, skip = 0) => {
    const s = new window.TradeSimulator(window.universe);
    const sim = (render = true) => {
      s.simulateTradeStep();
      if (render) renderShipChart(window.universe);
    };
    for (let i = 0; i < N; i++) {
      const render = i >= skip;
      sim(render);
    }
  };
}
