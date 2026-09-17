import { useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { Route, Routes } from "react-router-dom";
import { NavBar } from "./components/NavBar";
import { TrackedItemsContainer } from "./containers/TrackedItemsContainer";
import { HighVolumeItemsContainer } from "./containers/HighVolumeItemsContainer";
import { ItemProfitScanContainer } from "./containers/ItemProfitScanContainer";
import { currentCharacterService } from "./services/currentCharacterService";
import { loadTradingConfig } from "./services/tradingConfig";
import type { Character } from "./types";

/**
 * Loads config once and holds the Current Character, so both are shared by
 * every page. The Current Character is remembered across visits and tabs,
 * and can be changed from any page.
 */
const App = () => {
  // Both are read once, when the app opens.
  const { data: config } = useQuery({
    queryKey: ["tradingConfig"],
    queryFn: loadTradingConfig,
    staleTime: Infinity,
  });
  const rememberedCharacterName = useQuery({
    queryKey: ["rememberedCharacterName"],
    queryFn: () => currentCharacterService.getCurrentCharacterName(),
    staleTime: Infinity,
  });
  // Null until a character is picked during this visit.
  const [pickedCharacterName, setPickedCharacterName] = useState<string | null>(
    null,
  );

  const setCurrentCharacter = useCallback((character: Character) => {
    setPickedCharacterName(character.name);
    currentCharacterService
      .setCurrentCharacterName(character.name)
      .catch(() => {
        // Failing to remember it only means the next visit starts on the Default Character.
      });
  }, []);

  if (config === undefined || rememberedCharacterName.isPending) return null;

  const findCharacter = (name: string | null | undefined) =>
    config.characters.find((character) => character.name === name);
  // A remembered character that can't be read, or that's since been removed from the roster, falls
  // back to the Default Character.
  const currentCharacter =
    findCharacter(pickedCharacterName) ??
    findCharacter(rememberedCharacterName.data) ??
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
