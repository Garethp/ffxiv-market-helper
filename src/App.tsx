import { useCallback, useEffect, useState } from "react";
import { Route, Routes } from "react-router-dom";
import { NavBar } from "./components/NavBar";
import { TrackedItemsContainer } from "./containers/TrackedItemsContainer";
import { HighVolumeItemsContainer } from "./containers/HighVolumeItemsContainer";
import { ItemProfitScanContainer } from "./containers/ItemProfitScanContainer";
import { currentCharacterService } from "./services/currentCharacterService";
import {
  loadTradingConfig,
  type TradingConfig,
} from "./services/tradingConfig";
import type { Character } from "./types";

/**
 * Loads config once and holds the Current Character, so both are shared by
 * every page. The Current Character is remembered across visits and tabs,
 * and can be changed from any page.
 */
const App = () => {
  const [config, setConfig] = useState<TradingConfig | null>(null);
  // Null until a character has been picked, here or on an earlier visit, meaning the Default Character.
  const [pickedCharacterName, setPickedCharacterName] = useState<string | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      loadTradingConfig(),
      // Not being able to read the remembered character just means starting on the Default Character.
      currentCharacterService.getCurrentCharacterName().catch(() => null),
    ]).then(([loadedConfig, rememberedCharacterName]) => {
      if (cancelled) return;
      setConfig(loadedConfig);
      setPickedCharacterName(rememberedCharacterName);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const setCurrentCharacter = useCallback((character: Character) => {
    setPickedCharacterName(character.name);
    currentCharacterService
      .setCurrentCharacterName(character.name)
      .catch(() => {
        // Failing to remember it only means the next visit starts on the Default Character.
      });
  }, []);

  if (config === null) return null;

  const findCharacter = (name: string | null) =>
    config.characters.find((character) => character.name === name);
  // A remembered character that's since been removed from the roster falls back to the Default Character.
  const currentCharacter =
    findCharacter(pickedCharacterName) ??
    findCharacter(config.defaultCharacterName) ??
    null;

  return (
    <>
      <NavBar
        characters={config.characters}
        currentCharacter={currentCharacter}
        onSelectCharacter={setCurrentCharacter}
      />
      <Routes>
        <Route
          path="/"
          element={
            <TrackedItemsContainer
              config={config}
              currentCharacter={currentCharacter}
            />
          }
        />
        <Route
          path="/high-volume-items"
          element={
            <HighVolumeItemsContainer
              config={config}
              currentCharacter={currentCharacter}
            />
          }
        />
        <Route
          path="/item/:itemId"
          element={
            <ItemProfitScanContainer
              config={config}
              currentCharacter={currentCharacter}
            />
          }
        />
      </Routes>
    </>
  );
};

export default App;
