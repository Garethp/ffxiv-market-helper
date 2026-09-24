import { useState } from "react";
import { Link } from "react-router-dom";
import { CharacterCard } from "../../components/characters/CharacterCard";
import { RetainerRow } from "../../components/characters/RetainerRow";
import { ErrorMessage } from "../../components/ErrorMessage";
import { characterService } from "../../services/characterService";
import type { Character, RegionInfo } from "../../types";

/**
 * Where the character roster is listed, with the way to each character's and
 * retainer's own page and the way to remove either. Says so when a change
 * couldn't be made.
 */
export const CharactersContainer = ({
  characters,
  regions,
  onCharactersChanged,
}: {
  characters: Character[];
  regions: RegionInfo[];
  /** Called after every change made to the roster, so it can be read again. */
  onCharactersChanged: () => void;
}) => {
  const [errorMessage, setErrorMessage] = useState<string>();

  // The change was just asked for, so the message doesn't need to say which
  // character or retainer it was about.
  const makeChange = (change: () => Promise<void>) => {
    setErrorMessage(undefined);
    change()
      .then(onCharactersChanged)
      .catch(() => setErrorMessage("Something went wrong. Try again shortly."));
  };

  return (
    <div className="app">
      <title>Characters</title>
      <header>
        <h1>Characters</h1>
      </header>

      {errorMessage && <ErrorMessage>{errorMessage}</ErrorMessage>}

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

      <Link to="/characters/new" className="page-action">
        Add a character
      </Link>

      {characters.length === 0 && (
        <p className="muted">
          No characters yet. Add one to start pricing items.
        </p>
      )}

      {characters.map((character) => (
        <CharacterCard
          key={character.id}
          character={character}
          regions={regions}
          editHref={`/characters/${character.id}/edit`}
          addRetainerHref={`/characters/${character.id}/retainers/new`}
          onRemove={() =>
            makeChange(() => characterService.removeCharacter(character.id))
          }
        >
          {character.retainers.map((retainer) => (
            <RetainerRow
              key={retainer.id}
              retainer={retainer}
              editHref={`/characters/${character.id}/retainers/${retainer.id}/edit`}
              onRemove={() =>
                makeChange(() =>
                  characterService.removeRetainer(character.id, retainer.id),
                )
              }
            />
          ))}
        </CharacterCard>
      ))}
    </div>
  );
};
