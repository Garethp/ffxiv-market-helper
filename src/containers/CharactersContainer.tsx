import { CharacterCard } from "../components/CharacterCard";
import { CharacterForm } from "../components/CharacterForm";
import { characterService } from "../services/characterService";
import { validateCharacter } from "../utils/validation/roster";
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

  const reportingChanges = (change: Promise<void>) =>
    change.then(onCharactersChanged);

  return (
    <div className="app">
      <title>Characters</title>
      <header>
        <h1>Characters</h1>
      </header>

      <div className="page-intro">
        <p>
          This is the list of your Final Fantasy XIV characters and their
          retainers. Selecting a character to be "Selling as" will show profits
          if you were to sell in that character's home world. If you have no
          retainers, it'll calculate with the default city tax of 5%, however if
          you add retainers it'll use the actual tax rate for that retainer's
          city.
        </p>
        <p>
          Entering characters over multiple regions (for example, North America
          and Europe) will allow you to see what the profit would be if you were
          to buy in either region and sell in your selected character's home
          world.
        </p>
      </div>

      {characters.length === 0 && (
        <p className="muted">
          No characters yet. Add one below to start pricing items.
        </p>
      )}

      {characters.map((character) => (
        <CharacterCard
          key={character.id}
          character={character}
          roster={characters}
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

      <section className="card" aria-label="Add a character">
        <h2>Add a character</h2>
        <CharacterForm
          regions={regions}
          submitLabel="Add character"
          validate={(details) =>
            validateCharacter(details, characters, {
              regions,
              marketBoardCities,
            })
          }
          onSubmit={(details) =>
            reportingChanges(characterService.addCharacter(details))
          }
        />
      </section>
    </div>
  );
};
