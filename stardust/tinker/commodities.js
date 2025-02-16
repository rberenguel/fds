// commodities.js

class Commodity {
  constructor(id, name, description, basePrice, isContraband = false) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.basePrice = basePrice;
    this.isContraband = isContraband;
  }
}

class CommodityRegistry {
  constructor() {
    this.commodities = {};
    this.producers = {}; // systemType/subtype => { commodityId: weight, ... }
    this.consumers = {}; // systemType/subtype => { commodityId: weight, ... }
    this.nextId = 0;
  }

  registerCommodity(name, description, basePrice, isContraband = false) {
    const id = `comm_${this.nextId++}`; // Unique ID
    const commodity = new Commodity(
      id,
      name,
      description,
      basePrice,
      isContraband,
    );
    this.commodities[id] = commodity;
    return id; // Return the ID for later use
  }

  getCommodity(id) {
    return this.commodities[id];
  }

  getAllCommodities() {
    return this.commodities;
  }

  addProducer(systemType, commodityId, weight = 1) {
    if (!this.producers[systemType]) {
      this.producers[systemType] = {};
    }
    this.producers[systemType][commodityId] = weight;
  }

  addConsumer(systemType, commodityId, weight = 1) {
    if (!this.consumers[systemType]) {
      this.consumers[systemType] = {};
    }
    this.consumers[systemType][commodityId] = weight;
  }

  getProducers(systemType) {
    return this.producers[systemType] || {};
  }

  getConsumers(systemType) {
    return this.consumers[systemType] || {};
  }

  getProducedCommodities(systemType) {
    const producers = this.getProducers(systemType);
    return Object.keys(producers).map((commodityId) => ({
      commodity: this.getCommodity(commodityId),
      weight: producers[commodityId],
    }));
  }

  getConsumedCommodities(systemType) {
    const consumers = this.getConsumers(systemType);
    return Object.keys(consumers).map((commodityId) => ({
      commodity: this.getCommodity(commodityId),
      weight: consumers[commodityId],
    }));
  }
}

export { Commodity, CommodityRegistry };
