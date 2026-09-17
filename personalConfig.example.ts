import type { PersonalConfig } from "./src/services/configService";

// Template for personalConfig.ts (gitignored). Tracked items and characters are set up on the Manage
// Items and Characters pages. Anything in personalConfig.ts is only copied in the first time the app
// is opened in a browser with nothing saved yet, so this file is optional.
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
