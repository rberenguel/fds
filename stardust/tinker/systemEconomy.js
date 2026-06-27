// system_and_government.js
import { CommodityRegistry } from "./commodities.js";

export { SystemCategories, GovernmentTypes, commodityRegistry };
// --- System Categories (and Subtypes) ---

const Agricultural = "Agricultural";
const Industrial = "Industrial";
const HighTech = "HighTech";
const Mining = "Mining";
const Services = "Services";
const Frontier = "Frontier";

const AgriculturalRich = "AgriculturalRich";
const AgriculturalStandard = "AgriculturalStandard";
const AgriculturalPoor = "AgriculturalPoor";
const AgriculturalSpecialized = "AgriculturalSpecialized";

const IndustrialHeavy = "IndustrialHeavy";
const IndustrialLight = "IndustrialLight";
const IndustrialRefining = "IndustrialRefining";

const HighTechResearch = "HighTechResearch";
const HighTechIndustrial = "HighTechIndustrial";
const HighTechConsumer = "HighTechConsumer";

const MiningStandard = "MiningStandard";
const MiningRich = "MiningRich";
const MiningRadioactive = "MiningRadioactive";
const MiningVolatile = "MiningVolatile";

const ServicesTrade = "ServicesTrade";
const ServicesFinancial = "ServicesFinancial";

const FrontierOutpost = "FrontierOutpost";
const FrontierIndependent = "FrontierIndependent";

const subTypes = {
  [Agricultural]: [
    AgriculturalRich,
    AgriculturalStandard,
    AgriculturalPoor,
    AgriculturalSpecialized,
  ],
  [Industrial]: [IndustrialHeavy, IndustrialLight, IndustrialRefining],
  [HighTech]: [HighTechResearch, HighTechIndustrial, HighTechConsumer],
  [Mining]: [MiningStandard, MiningRich, MiningRadioactive, MiningVolatile],
  [Services]: [ServicesTrade, ServicesFinancial],
  [Frontier]: [FrontierOutpost, FrontierIndependent],
};

const SystemCategories = {
  Agricultural,
  Industrial,
  HighTech,
  Mining,
  Services,
  Frontier,
  getAll() {
    return [
      this.Agricultural,
      this.Industrial,
      this.HighTech,
      this.Mining,
      this.Services,
      this.Frontier,
    ];
  },
  getOne(n) {
    // Weighted: more low-tier producers, fewer high-tier consumers (scarcity drives trade)
    const weighted = [
      ...Array(25).fill(Agricultural),
      ...Array(20).fill(Mining),
      ...Array(20).fill(Industrial),
      ...Array(15).fill(Frontier),
      ...Array(10).fill(HighTech),
      ...Array(10).fill(Services),
    ];
    return weighted[Math.floor(n) % weighted.length];
  },
  repr(category) {
    return descriptions[category];
  },
  getSubTypes(category) {
    return subTypes[category] || [];
  },
  subRepr(subtype) {
    return subDescriptions[subtype] || { name: "Unknown Subtype", desc: "" };
  },
  getRandomSubType(category) {
    const subtypes = this.getSubTypes(category);
    if (subtypes.length === 0) {
      return null;
    }
    return subtypes[Math.floor(Math.random() * subtypes.length)];
  },
};

const descriptions = {
  [Agricultural]: {
    name: "Agricultural",
    desc: "A system focused on food production and agriculture.",
  },
  [Industrial]: {
    name: "Industrial",
    desc: "A system focused on manufacturing and industry.",
  },
  [HighTech]: {
    name: "High Tech",
    desc: "A system focused on advanced technology and research.",
  },
  [Mining]: {
    name: "Mining",
    desc: "A system focused on resource extraction.",
  },
  [Services]: {
    name: "Services",
    desc: "A system focused on trade, finance, and corporate services.",
  },
  [Frontier]: {
    name: "Frontier",
    desc: "An underdeveloped system on the fringes of explored space.",
  },
};
const subDescriptions = {
  [AgriculturalRich]: {
    name: "Rich Agricultural",
    desc: "Abundant food and textile production. High population.",
  },
  [AgriculturalStandard]: {
    name: "Agricultural (Standard)",
    desc: "Moderate food and textile production.",
  },
  [AgriculturalPoor]: {
    name: "Agricultural (Poor)",
    desc: "Low food and textile production. May struggle to meet its own needs.",
  },
  [AgriculturalSpecialized]: {
    name: "Agricultural (Specialized)",
    desc: "Focuses on a particular crop.",
  },

  [IndustrialHeavy]: {
    name: "Industrial (Heavy)",
    desc: "Focuses on large-scale manufacturing.",
  },
  [IndustrialLight]: {
    name: "Industrial (Light)",
    desc: "Focuses on consumer goods.",
  },
  [IndustrialRefining]: {
    name: "Industrial (Refining)",
    desc: "Specializes in processing raw materials.",
  },

  [HighTechResearch]: {
    name: "High Tech (Research)",
    desc: "Focuses on research and development.",
  },
  [HighTechIndustrial]: {
    name: "High Tech (Industrial)",
    desc: "Focuses on manufacturing advanced technology.",
  },
  [HighTechConsumer]: {
    name: "High Tech (Consumer)",
    desc: "Focuses on producing high-tech consumer goods.",
  },

  [MiningStandard]: {
    name: "Mining (Standard)",
    desc: "Extracts common minerals and metals.",
  },
  [MiningRich]: {
    name: "Mining (Rich)",
    desc: "Abundant deposits of valuable materials.",
  },
  [MiningRadioactive]: {
    name: "Mining (Radioactive)",
    desc: "Specializes in extracting radioactive materials.",
  },
  [MiningVolatile]: {
    name: "Mining (Volatile)",
    desc: "Extracts highly unstable, but valuable materials",
  },

  [ServicesTrade]: {
    name: "Service (Trade)",
    desc: "Centers of import and export.",
  },
  [ServicesFinancial]: {
    name: "Service (Financial)",
    desc: "Centers for finance.",
  },

  [FrontierOutpost]: {
    name: "Frontier (Outpost)",
    desc: "Newly established colony.",
  },
  [FrontierIndependent]: {
    name: "Frontier (Independent)",
    desc: "Self-governing, may have a unique economy.",
  },
};

// --- Government Types ---

const Anarchy = "Anarchy";
const Feudal = "Feudal";
const MultiGovernment = "MultiGovernment";
const Dictatorship = "Dictatorship";
const Communist = "Communist";
const CorporateState = "CorporateState";
const Democracy = "Democracy";
const Theocracy = "Theocracy";
const Technocracy = "Technocracy";

const governmentDescriptions = {
  [Anarchy]: { name: "Anarchy", desc: "No central government. Lawless." },
  [Feudal]: { name: "Feudal", desc: "Ruled by a hereditary noble class." },
  [MultiGovernment]: {
    name: "Multi-Government",
    desc: "Governed by multiple factions or entities.",
  },
  [Dictatorship]: {
    name: "Dictatorship",
    desc: "Ruled by a single, absolute ruler.",
  },
  [Communist]: {
    name: "Communist",
    desc: "State-controlled economy and society.",
  },
  [CorporateState]: {
    name: "Corporate State",
    desc: "Government heavily influenced by corporations.",
  },
  [Democracy]: { name: "Democracy", desc: "Ruled by elected representatives." },
  [Theocracy]: { name: "Theocracy", desc: "Ruled by religious leaders." },
  [Technocracy]: { name: "Technocracy", desc: "Ruled by technical experts." },
};

const GovernmentTypes = {
  Anarchy,
  Feudal,
  MultiGovernment,
  Dictatorship,
  Communist,
  CorporateState,
  Democracy,
  Theocracy,
  Technocracy,

  getAll() {
    return [
      this.Anarchy,
      this.Feudal,
      this.MultiGovernment,
      this.Dictatorship,
      this.Communist,
      this.CorporateState,
      this.Democracy,
      this.Theocracy,
      this.Technocracy,
    ];
  },

  getOne(n) {
    const all = this.getAll();
    return all[Math.floor(n) % all.length];
  },
  repr(governmentType) {
    return (
      governmentDescriptions[governmentType] || { name: "Unknown", desc: "" }
    );
  },
};

// --- Instance and Commodity Definitions (Using the Registry) ---

const registry = new CommodityRegistry();

// Register commodities
const foodId = registry.registerCommodity("Food", "Basic sustenance.", 10);
const textilesId = registry.registerCommodity(
  "Textiles",
  "Used for clothing and fabrics.",
  15,
);
const mineralsId = registry.registerCommodity("Minerals", "Raw materials.", 20);
const radioactivesId = registry.registerCommodity(
  "Radioactives",
  "Used in industry and power generation.",
  50,
);
const alloysId = registry.registerCommodity(
  "Alloys",
  "Used in manufacturing.",
  40,
);
const machineryId = registry.registerCommodity(
  "Machinery",
  "Industrial goods.",
  60,
);
const computersId = registry.registerCommodity(
  "Computers",
  "Advanced technology.",
  100,
);
const liquorWinesId = registry.registerCommodity(
  "Liquor/Wines",
  "Luxury goods.",
  30,
);
const luxuriesId = registry.registerCommodity(
  "Luxuries",
  "High-value goods.",
  150,
);
const goldId = registry.registerCommodity("Gold", "Precious metal.", 200);
const platinumId = registry.registerCommodity(
  "Platinum",
  "Precious metal.",
  250,
);
const gemStonesId = registry.registerCommodity(
  "Gem-Stones",
  "High value, low volume.",
  300,
);
const narcoticsId = registry.registerCommodity(
  "Narcotics",
  "Illegal drugs.",
  500,
  true,
);
const firearmsId = registry.registerCommodity(
  "Firearms",
  "Weapons.",
  120,
  true,
);
const alienItemsId = registry.registerCommodity(
  "Alien Items",
  "Rare and unusual items.",
  500,
); //price could be random

// --- Define Producers and Consumers ---

// Agricultural
registry.addProducer(AgriculturalRich, foodId, 3);
registry.addProducer(AgriculturalStandard, foodId, 2);
registry.addProducer(AgriculturalPoor, foodId, 1);
registry.addProducer(AgriculturalSpecialized, foodId, 2); // Could be higher for its specialty
registry.addProducer(AgriculturalRich, textilesId, 2);
registry.addProducer(AgriculturalStandard, textilesId, 1);
registry.addProducer(AgriculturalSpecialized, textilesId, 2); //if specialized in textiles
registry.addProducer(AgriculturalRich, liquorWinesId, 2);
registry.addProducer(AgriculturalSpecialized, liquorWinesId, 3); // If specialized in wines

registry.addConsumer(AgriculturalRich, machineryId, 1);
registry.addConsumer(AgriculturalStandard, machineryId, 1);
registry.addConsumer(AgriculturalPoor, machineryId, 1);
registry.addConsumer(AgriculturalRich, luxuriesId, 1);
registry.addConsumer(AgriculturalRich, computersId, 1);

// Industrial
registry.addProducer(IndustrialHeavy, machineryId, 3);
registry.addProducer(IndustrialLight, machineryId, 1);
registry.addProducer(IndustrialRefining, machineryId, 2);
registry.addProducer(IndustrialHeavy, alloysId, 3);
registry.addProducer(IndustrialLight, alloysId, 1);
registry.addProducer(IndustrialRefining, alloysId, 2);
registry.addProducer(IndustrialHeavy, radioactivesId, 2);
registry.addProducer(IndustrialRefining, radioactivesId, 3);
registry.addProducer(IndustrialLight, firearmsId, 2);

registry.addConsumer(IndustrialHeavy, mineralsId, 3);
registry.addConsumer(IndustrialLight, mineralsId, 2);
registry.addConsumer(IndustrialRefining, mineralsId, 3);
registry.addConsumer(IndustrialHeavy, radioactivesId, 2);
registry.addConsumer(IndustrialLight, radioactivesId, 1);
registry.addConsumer(IndustrialHeavy, foodId, 2);
registry.addConsumer(IndustrialLight, foodId, 2);
registry.addConsumer(IndustrialRefining, foodId, 2);
registry.addConsumer(IndustrialHeavy, computersId, 2);
registry.addConsumer(IndustrialLight, computersId, 1);
registry.addConsumer(IndustrialRefining, computersId, 2);

// High Tech
registry.addProducer(HighTechResearch, computersId, 2);
registry.addProducer(HighTechIndustrial, computersId, 3);
registry.addProducer(HighTechConsumer, computersId, 1);
registry.addProducer(HighTechResearch, radioactivesId, 1);
registry.addProducer(HighTechIndustrial, radioactivesId, 2);
registry.addProducer(HighTechResearch, luxuriesId, 2);
registry.addProducer(HighTechConsumer, luxuriesId, 3);

registry.addConsumer(HighTechResearch, mineralsId, 2);
registry.addConsumer(HighTechIndustrial, mineralsId, 3);
registry.addConsumer(HighTechResearch, radioactivesId, 3);
registry.addConsumer(HighTechIndustrial, radioactivesId, 2);
registry.addConsumer(HighTechResearch, alloysId, 3);
registry.addConsumer(HighTechIndustrial, alloysId, 2);
registry.addConsumer(HighTechConsumer, alloysId, 1);
registry.addConsumer(HighTechResearch, platinumId, 2);
registry.addConsumer(HighTechIndustrial, platinumId, 2);
registry.addConsumer(HighTechResearch, gemStonesId, 2);

// Mining
registry.addProducer(MiningStandard, mineralsId, 2);
registry.addProducer(MiningRich, mineralsId, 3);
registry.addProducer(MiningRadioactive, radioactivesId, 3);
registry.addProducer(MiningVolatile, alienItemsId, 3); //special case
registry.addProducer(MiningRich, goldId, 3);
registry.addProducer(MiningRich, platinumId, 3);
registry.addProducer(MiningRich, gemStonesId, 3);

registry.addConsumer(MiningStandard, machineryId, 1);
registry.addConsumer(MiningRich, machineryId, 1);
registry.addConsumer(MiningRadioactive, machineryId, 1);
registry.addConsumer(MiningStandard, foodId, 2);
registry.addConsumer(MiningRich, foodId, 1);
registry.addConsumer(MiningRadioactive, foodId, 2);
registry.addConsumer(MiningVolatile, foodId, 2);

// Services
registry.addProducer(ServicesTrade, luxuriesId, 1); // Facilitates trade, doesn't *produce*
registry.addProducer(ServicesFinancial, luxuriesId, 2);

registry.addConsumer(ServicesTrade, foodId, 1);
registry.addConsumer(ServicesTrade, textilesId, 1);
registry.addConsumer(ServicesTrade, mineralsId, 1);
registry.addConsumer(ServicesTrade, radioactivesId, 1);
registry.addConsumer(ServicesTrade, alloysId, 1);
registry.addConsumer(ServicesTrade, machineryId, 1);
registry.addConsumer(ServicesTrade, computersId, 1);
registry.addConsumer(ServicesTrade, liquorWinesId, 1);
registry.addConsumer(ServicesTrade, luxuriesId, 1);
registry.addConsumer(ServicesTrade, goldId, 1);
registry.addConsumer(ServicesTrade, platinumId, 1);
registry.addConsumer(ServicesTrade, gemStonesId, 1);
registry.addConsumer(ServicesFinancial, luxuriesId, 3);
registry.addConsumer(ServicesFinancial, computersId, 2);

// Frontier
// Outpost: bare colony, subsistence farming + basic mining. Needs machinery and some computers.
registry.addProducer(FrontierOutpost, mineralsId, 1);
registry.addProducer(FrontierOutpost, foodId, 1);   // subsistence farming keeps lights on

registry.addConsumer(FrontierOutpost, foodId, 1);   // net-neutral on food; traders bring the rest
registry.addConsumer(FrontierOutpost, machineryId, 1);
registry.addConsumer(FrontierOutpost, computersId, 1);

// Independent: more established, diversified production
registry.addProducer(FrontierIndependent, mineralsId, 2);
registry.addProducer(FrontierIndependent, foodId, 1);

registry.addConsumer(FrontierIndependent, foodId, 1);
registry.addConsumer(FrontierIndependent, machineryId, 1);
registry.addConsumer(FrontierIndependent, computersId, 1);

// --- Contraband ---
// Narcotics: produced only in lawless/frontier systems; consumed everywhere at low weight
registry.addProducer(FrontierIndependent, narcoticsId, 2);
registry.addProducer(FrontierOutpost, narcoticsId, 1);

registry.addConsumer(AgriculturalRich, narcoticsId, 0.3);
registry.addConsumer(AgriculturalStandard, narcoticsId, 0.3);
registry.addConsumer(AgriculturalPoor, narcoticsId, 0.3);
registry.addConsumer(AgriculturalSpecialized, narcoticsId, 0.3);
registry.addConsumer(IndustrialHeavy, narcoticsId, 0.3);
registry.addConsumer(IndustrialLight, narcoticsId, 0.3);
registry.addConsumer(IndustrialRefining, narcoticsId, 0.3);
registry.addConsumer(HighTechResearch, narcoticsId, 0.3);
registry.addConsumer(HighTechIndustrial, narcoticsId, 0.3);
registry.addConsumer(HighTechConsumer, narcoticsId, 0.3);
registry.addConsumer(MiningStandard, narcoticsId, 0.3);
registry.addConsumer(MiningRich, narcoticsId, 0.3);
registry.addConsumer(MiningRadioactive, narcoticsId, 0.3);
registry.addConsumer(MiningVolatile, narcoticsId, 0.3);
registry.addConsumer(ServicesTrade, narcoticsId, 0.5);
registry.addConsumer(ServicesFinancial, narcoticsId, 0.5);
registry.addConsumer(FrontierOutpost, narcoticsId, 0.2);
registry.addConsumer(FrontierIndependent, narcoticsId, 0.3);

// Firearms: produced in Industrial Light (already registered above); consumed in frontier/mining
registry.addConsumer(FrontierOutpost, firearmsId, 2);
registry.addConsumer(FrontierIndependent, firearmsId, 3);
registry.addConsumer(MiningVolatile, firearmsId, 2);
registry.addConsumer(MiningRadioactive, firearmsId, 1);

const commodityRegistry = registry;
