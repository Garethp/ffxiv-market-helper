import type { PersonalConfig } from "./src/services/configService";

// Template for personalConfig.ts (gitignored, holds your real tracked items).
// Copy this file to personalConfig.ts and fill in your own data. Characters and retainers are set up
// on the Characters page.
export const personalConfig: PersonalConfig = {
  trackedItems: [
    {
      itemId: 5,
      name: "Example Item",
      stackSize: 99,
      targetQuantity: 99,
    },
  ],
};
