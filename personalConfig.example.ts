import type { PersonalConfig } from "./src/services/configService";

// Template for personalConfig.ts (gitignored, holds your real roster/tracked items).
// Copy this file to personalConfig.ts and fill in your own data.
export const personalConfig: PersonalConfig = {
  trackedItems: [
    {
      itemId: 5,
      name: "Example Item",
      stackSize: 99,
      targetQuantity: 99,
    },
  ],
  characters: [
    {
      name: "Example Character",
      homeWorld: "Gilgamesh",
      retainers: [{ name: "Example Retainer", city: "Ul'dah" }],
    },
  ],
  defaultCharacterName: "Example Character",
};
