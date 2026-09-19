import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { Route, Routes } from "react-router-dom";
import { ItemDataStatusBar } from "./components/ItemDataStatusBar";
import { NavBar } from "./components/NavBar";
import { NoCharactersMessage } from "./components/NoCharactersMessage";
import { CharactersContainer } from "./containers/CharactersContainer";
import { ExpertDeliveryContainer } from "./containers/ExpertDeliveryContainer";
import { TrackedItemsContainer } from "./containers/TrackedItemsContainer";
import { HighVolumeItemsContainer } from "./containers/HighVolumeItemsContainer";
import { ItemProfitScanContainer } from "./containers/ItemProfitScanContainer";
import { ManageItemsContainer } from "./containers/ManageItemsContainer";
import { useItemDataStatus } from "./hooks/useItemDataStatus";
import { useReloadable } from "./hooks/useReloadable";
import { characterService } from "./services/characterService";
import { currentCharacterService } from "./services/currentCharacterService";
import { trackedItemService } from "./services/trackedItemService";
import { buildTradingConfig, loadConfig } from "./services/tradingConfig";
import type { Character } from "./types";

const loadCharacters = () => characterService.getCharacters();
const loadTrackedItems = () => trackedItemService.getTrackedItems();

/**
 * Loads config, the character roster and the tracked items, and holds the
 * Current Character, so all of them are shared by every page. The Current
 * Character is remembered across visits and tabs, and can be changed from any
 * page.
 */
const App = () => {
  // Both are read once, when the app opens.
  const { data: loadedConfig } = useQuery({
    queryKey: ["config"],
    queryFn: loadConfig,
    staleTime: Infinity,
  });
  const rememberedCharacterId = useQuery({
    queryKey: ["rememberedCharacterId"],
    queryFn: () => currentCharacterService.getCurrentCharacterId(),
    staleTime: Infinity,
  });

  // Both are read when the app opens, and again after every change made to them.
  const [characters, reloadCharacters] = useReloadable(loadCharacters);
  const [trackedItems, reloadTrackedItems] = useReloadable(loadTrackedItems);
  const itemDataStatus = useItemDataStatus();

  // Null until a character is picked during this visit.
  const [pickedCharacterId, setPickedCharacterId] = useState<string | null>(
    null,
  );

  const setCurrentCharacter = useCallback((character: Character) => {
    setPickedCharacterId(character.id);
    currentCharacterService.setCurrentCharacterId(character.id).catch(() => {
      // Failing to remember it only means the next visit starts on the first character.
    });
  }, []);

  // Built once per load, so pages only see a changed config when something in it has actually changed.
  const config = useMemo(
    () =>
      loadedConfig && characters && trackedItems
        ? buildTradingConfig(loadedConfig, characters, trackedItems)
        : undefined,
    [loadedConfig, characters, trackedItems],
  );

  if (config === undefined || rememberedCharacterId.isPending) return null;

  const findCharacter = (id: string | null | undefined) =>
    config.characters.find((character) => character.id === id);
  // A remembered character that can't be read, or that's since been removed from the roster, falls
  // back to the first character in the roster.
  const currentCharacter =
    findCharacter(pickedCharacterId) ??
    findCharacter(rememberedCharacterId.data) ??
    config.characters[0] ??
    null;

  return (
    <>
      <NavBar
        characters={config.characters}
        currentCharacter={currentCharacter}
        onSelectCharacter={setCurrentCharacter}
      />
      <Routes>
        {/* There's only no Current Character when the roster is empty, and then every page that
            prices items has nothing to show. */}
        {currentCharacter ? (
          <>
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
              path="/expert-delivery"
              element={
                <ExpertDeliveryContainer
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
                  onTrackedItemsChanged={reloadTrackedItems}
                />
              }
            />
          </>
        ) : (
          <Route path="*" element={<NoCharactersMessage />} />
        )}
        <Route
          path="/characters"
          element={
            <CharactersContainer
              config={config}
              onCharactersChanged={reloadCharacters}
            />
          }
        />
        <Route
          path="/manage-items"
          element={
            <ManageItemsContainer
              config={config}
              onTrackedItemsChanged={reloadTrackedItems}
            />
          }
        />
      </Routes>
      <ItemDataStatusBar status={itemDataStatus} />
    </>
  );
};

export default App;
