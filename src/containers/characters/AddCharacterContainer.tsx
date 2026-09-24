import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CharacterForm } from "../../components/characters/CharacterForm";
import {
  characterService,
  type CharacterDetails,
} from "../../services/characterService";
import type { Character, RegionInfo } from "../../types";
import { validateCharacter } from "../../utils/validation/roster";

/**
 * Where a new character is added to the roster, on a page of its own so it has
 * the whole screen to itself. Decides whether the character can be added and
 * what to say when it can't, so the form only has to show it.
 */
export const AddCharacterContainer = ({
  characters,
  regions,
  onCharactersChanged,
}: {
  characters: Character[];
  regions: RegionInfo[];
  /** Called once the character is added, so the roster can be read again. */
  onCharactersChanged: () => void;
}) => {
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = useState<string>();

  const onSubmit = (details: CharacterDetails) => {
    const error = validateCharacter(details, characters, regions);
    // Nothing is attempted while the roster wouldn't accept it.
    if (error) return setErrorMessage(error);

    setErrorMessage(undefined);
    characterService
      .addCharacter(details)
      .then(() => {
        onCharactersChanged();
        // Back to the roster, where the new character shows.
        navigate("/characters");
      })
      .catch(() => setErrorMessage("Something went wrong. Try again shortly."));
  };

  return (
    <div className="app">
      <title>Add a Character</title>
      <header>
        <h1>Add a Character</h1>
      </header>

      <section className="card" aria-label="Add a character">
        <CharacterForm
          label="Add a character"
          regions={regions}
          initial={{ name: "", homeWorld: "" }}
          submitLabel="Add character"
          errorMessage={errorMessage}
          onSubmit={onSubmit}
          onCancel={() => navigate("/characters")}
        />
      </section>

      <Link to="/characters" className="page-action">
        Back to characters
      </Link>
    </div>
  );
};
