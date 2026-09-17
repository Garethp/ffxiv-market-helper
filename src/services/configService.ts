import type {
  Character,
  RegionInfo,
  TrackedItem,
  TradingParameters,
} from "../types";

/** Which items to track and which characters/retainers make up our roster — see personalConfig.example.ts. */
export interface PersonalConfig {
  trackedItems: TrackedItem[];
  characters: Character[];
  /** The name of the character (from characters) that starts out as the Current Character. */
  defaultCharacterName: string;
}

// personalConfig.ts lives at the project root (see personalConfig.example.ts) and is gitignored
// so it never leaves this machine. import.meta.glob resolves to an empty object (rather than a
// build error) when it's absent, e.g. on a fresh clone, and we fall back to an empty roster then.
const personalConfigModules = import.meta.glob<{
  personalConfig: PersonalConfig;
}>("../../personalConfig.ts", { eager: true });
const personalConfig: PersonalConfig = Object.values(personalConfigModules)[0]
  ?.personalConfig ?? {
  trackedItems: [],
  characters: [],
  defaultCharacterName: "",
};

/**
 * Source of the app's domain configuration: which items to track, our
 * character roster, the FFXIV region/data-center/world directory, and the
 * trading parameters that govern pricing and refresh behavior.
 * Implementations can be swapped out (e.g. for one backed by a real
 * database/API) without touching any calling code.
 */
export interface ConfigService {
  getTrackedItems(): Promise<TrackedItem[]>;
  getCharacters(): Promise<Character[]>;
  /** The name of the character (from getCharacters) that starts out as the Current Character. */
  getDefaultCharacterName(): Promise<string>;
  getRegions(): Promise<RegionInfo[]>;
  getTradingParameters(): Promise<TradingParameters>;
}

/**
 * Hardcoded implementation of ConfigService. This is the only thing that
 * should need to change once tracked items, characters, and trading
 * parameters become user-configurable and move to a real database.
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
    undercutListingThreshold: 5,
  };

  async getTrackedItems(): Promise<TrackedItem[]> {
    return personalConfig.trackedItems;
  }

  async getCharacters(): Promise<Character[]> {
    return personalConfig.characters;
  }

  async getDefaultCharacterName(): Promise<string> {
    return personalConfig.defaultCharacterName;
  }

  async getRegions(): Promise<RegionInfo[]> {
    return this.regions;
  }

  async getTradingParameters(): Promise<TradingParameters> {
    return this.tradingParameters;
  }
}

export const configService: ConfigService = new HardcodedConfigService();
