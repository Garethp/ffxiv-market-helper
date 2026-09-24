import { useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { CharacterForm } from "../../components/characters/CharacterForm";
import {
  characterService,
  type CharacterDetails,
} from "../../services/characterService";
import type { Character, RegionInfo } from "../../types";
import { validateCharacter } from "../../utils/validation/roster";

/**
 * Where one character's details are changed, on a page of its own so it has the
 * whole screen to itself. Decides whether the details can be saved and what to
 * say when they can't, so the form only has to show it.
 */
export const EditCharacterContainer = ({
  characters,
  regions,
  onCharactersChanged,
}: {
  characters: Character[];
  regions: RegionInfo[];
  /** Called once the details are saved, so the roster can be read again. */
  onCharactersChanged: () => void;
}) => {
  const { characterId } = useParams();
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = useState<string>();

  // Removed in another tab, or an address typed by hand. Replaced rather than
  // pushed, so going back doesn't land here again.
  const character = characters.find(({ id }) => id === characterId);
  if (!character) return <Navigate to="/characters" replace />;

  const onSubmit = (details: CharacterDetails) => {
    const error = validateCharacter(details, characters, regions, character.id);
    // Nothing is attempted while the roster wouldn't accept it.
    if (error) return setErrorMessage(error);

    setErrorMessage(undefined);
    characterService
      .updateCharacter(character.id, details)
      .then(() => {
        onCharactersChanged();
        // Back to the roster, where the changed details show.
        navigate("/characters");
      })
      .catch(() => setErrorMessage("Something went wrong. Try again shortly."));
  };

  return (
    <div className="app">
      <title>{`Edit ${character.name}`}</title>
      <header>
        <h1>Edit {character.name}</h1>
      </header>

      <section className="card" aria-label={`Edit ${character.name}`}>
        <CharacterForm
          label={`Edit ${character.name}`}
          regions={regions}
          initial={character}
          submitLabel="Save character"
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
