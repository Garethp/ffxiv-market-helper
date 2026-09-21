import type { NewCharacter } from "./characterService";
import type { PricedItem, RegionInfo, TradingParameters } from "../types";

/**
 * Data copied into what this browser saves, the first time the app is opened
 * in a browser with nothing saved yet — see personalConfig.example.ts. Each
 * part is only read that once, so it can be removed after that.
 */
export interface PersonalConfig {
  /** Copied into the tracked items. */
  trackedItems?: PricedItem[];
  /** Copied into the character roster. */
  characters?: NewCharacter[];
}

// personalConfig.ts lives at the project root (see personalConfig.example.ts) and is gitignored
// so it never leaves this machine. import.meta.glob resolves to an empty object (rather than a
// build error) when it's absent, e.g. on a fresh clone, and we fall back to an empty config then.
const personalConfigModules = import.meta.glob<{
  personalConfig: PersonalConfig;
}>("../../personalConfig.ts", { eager: true });
export const personalConfig: PersonalConfig =
  Object.values(personalConfigModules)[0]?.personalConfig ?? {};

/**
 * Source of the app's domain configuration: the FFXIV region/data-center/world
 * directory, the market board cities, and the trading parameters that govern
 * pricing and refresh behavior. Implementations can be swapped out (e.g. for
 * one backed by a real database/API) without touching any calling code.
 */
export interface ConfigService {
  getRegions(): Promise<RegionInfo[]>;
  /** The cities a retainer can be parked in to sell on the market board. */
  getMarketBoardCities(): Promise<string[]>;
  getTradingParameters(): Promise<TradingParameters>;
}

/**
 * Hardcoded implementation of ConfigService. This is the only thing that
 * should need to change once trading parameters become user-configurable and
 * move to a real database.
 */
class HardcodedConfigService implements ConfigService {
  // Static reference data — which data centers exist in which region, and which worlds belong to
  // which data center. Scoped to the global client's regions only (excludes the Chinese/Korean
  // clients, which use a different item ID scheme this app doesn't target).
  private readonly regions: RegionInfo[] = [
    {
      name: "North America",
      dataCenters: [
        {
          name: "Aether",
          worlds: [
            "Jenova",
            "Faerie",
            "Siren",
            "Gilgamesh",
            "Midgardsormr",
            "Adamantoise",
            "Cactuar",
            "Sargatanas",
          ],
        },
        {
          name: "Primal",
          worlds: [
            "Famfrit",
            "Exodus",
            "Lamia",
            "Leviathan",
            "Ultros",
            "Behemoth",
            "Excalibur",
            "Hyperion",
          ],
        },
        {
          name: "Crystal",
          worlds: [
            "Brynhildr",
            "Mateus",
            "Zalera",
            "Diabolos",
            "Coeurl",
            "Malboro",
            "Goblin",
            "Balmung",
          ],
        },
        {
          name: "Dynamis",
          worlds: [
            "Marilith",
            "Seraph",
            "Halicarnassus",
            "Maduin",
            "Cuchulainn",
            "Kraken",
            "Rafflesia",
            "Golem",
          ],
        },
      ],
    },
    {
      name: "Europe",
      dataCenters: [
        {
          name: "Chaos",
          worlds: [
            "Omega",
            "Moogle",
            "Cerberus",
            "Louisoix",
            "Spriggan",
            "Ragnarok",
            "Sagittarius",
            "Phantom",
          ],
        },
        {
          name: "Light",
          worlds: [
            "Twintania",
            "Lich",
            "Zodiark",
            "Phoenix",
            "Odin",
            "Shiva",
            "Alpha",
            "Raiden",
          ],
        },
      ],
    },
    {
      name: "Japan",
      dataCenters: [
        {
          name: "Elemental",
          worlds: [
            "Carbuncle",
            "Kujata",
            "Typhon",
            "Garuda",
            "Atomos",
            "Tonberry",
            "Aegis",
            "Gungnir",
          ],
        },
        {
          name: "Gaia",
          worlds: [
            "Alexander",
            "Fenrir",
            "Ultima",
            "Ifrit",
            "Bahamut",
            "Tiamat",
            "Durandal",
            "Ridill",
          ],
        },
        {
          name: "Mana",
          worlds: [
            "Asura",
            "Pandaemonium",
            "Anima",
            "Hades",
            "Ixion",
            "Titan",
            "Chocobo",
            "Masamune",
          ],
        },
        {
          name: "Meteor",
          worlds: [
            "Belias",
            "Shinryu",
            "Unicorn",
            "Yojimbo",
            "Zeromus",
            "Valefor",
            "Ramuh",
            "Mandragora",
          ],
        },
      ],
    },
    {
      name: "Oceania",
      dataCenters: [
        {
          name: "Materia",
          worlds: ["Ravana", "Bismarck", "Sephirot", "Sophia", "Zurvan"],
        },
      ],
    },
  ];

  // Static reference data. Named exactly as Universalis' tax-rates endpoint names them, since a
  // retainer's city is how its tax rate gets looked up there.
  private readonly marketBoardCities: string[] = [
    "Limsa Lominsa",
    "Gridania",
    "Ul'dah",
    "Ishgard",
    "Kugane",
    "Crystarium",
    "Old Sharlayan",
    "Tuliyollal",
  ];

  private readonly tradingParameters: TradingParameters = {
    buyTaxRate: 0.05,
    defaultSellTaxRate: 0.05,
    gapThresholdMultiplier: 1.1,
    saleSampleSize: 3,
    buyListingsFetchCount: 100,
    // Needs to cover every listing on the board, not just enough for a price average — otherwise
    // our own listing could rank outside the fetched set and get misread as "not listed".
    sellListingsFetchCount: 100,
    sellHistoryFetchCount: 100,
    saleVelocityWindowMs: 24 * 60 * 60_000, // 1 day
    refreshIntervalMs: 90_000,
    retryDelayMs: 10_000,
    staleWarningThresholdMs: 5 * 60_000,
    undercutListingThreshold: 3,
    undercutListingsShown: 10,
  };

  async getRegions(): Promise<RegionInfo[]> {
    return this.regions;
  }

  async getMarketBoardCities(): Promise<string[]> {
    return this.marketBoardCities;
  }

  async getTradingParameters(): Promise<TradingParameters> {
    return this.tradingParameters;
  }
}

export const configService: ConfigService = new HardcodedConfigService();
