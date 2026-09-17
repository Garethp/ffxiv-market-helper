import { CharacterCard } from "../components/CharacterCard";
import { CharacterForm } from "../components/CharacterForm";
import {
  characterService,
  type RosterChangeResult,
} from "../services/characterService";
import type { TradingConfig } from "../services/tradingConfig";

/** Where the character roster is set up: adding, changing and removing characters and their retainers. */
export const CharactersContainer = ({
  config,
  onCharactersChanged,
}: {
  config: TradingConfig;
  /** Called after every change made to the roster, so it can be read again. */
  onCharactersChanged: () => void;
}) => {
  const { characters, regions, marketBoardCities } = config;

  const reportingChanges = async (
    change: Promise<RosterChangeResult>,
  ): Promise<RosterChangeResult> => {
    const result = await change;
    if (result.ok) onCharactersChanged();
    return result;
  };

  return (
    <div className="app">
      <title>Characters</title>
      <header>
        <h1>Characters</h1>
      </header>

      {characters.length === 0 && (
        <p className="muted">
          No characters yet. Add one below to start pricing items.
        </p>
      )}

      {characters.map((character) => (
        <CharacterCard
          key={character.id}
          character={character}
          regions={regions}
          marketBoardCities={marketBoardCities}
          onUpdate={(details) =>
            reportingChanges(
              characterService.updateCharacter(character.id, details),
            )
          }
          onRemove={() =>
            reportingChanges(characterService.removeCharacter(character.id))
          }
          onAddRetainer={(details) =>
            reportingChanges(
              characterService.addRetainer(character.id, details),
            )
          }
          onUpdateRetainer={(retainerId, details) =>
            reportingChanges(
              characterService.updateRetainer(
                character.id,
                retainerId,
                details,
              ),
            )
          }
          onRemoveRetainer={(retainerId) =>
            reportingChanges(
              characterService.removeRetainer(character.id, retainerId),
            )
          }
        />
      ))}

      <section className="character-card" aria-label="Add a character">
        <h2>Add a character</h2>
        <CharacterForm
          regions={regions}
          submitLabel="Add character"
          onSubmit={(details) =>
            reportingChanges(characterService.addCharacter(details))
          }
        />
      </section>

      <footer>
        <p>
          The character you're selling as sells on its home world, through its
          retainers — each retainer's city decides the sell tax. Every character
          is also somewhere to buy from: anywhere in its home world's region.
          Retainer names are how your own listings are recognized on the market
          board, so they need to match the names in-game.
        </p>
      </footer>
    </div>
  );
};
