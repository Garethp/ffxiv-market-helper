import { useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { RetainerForm } from "../../components/characters/RetainerForm";
import {
  characterService,
  type RetainerDetails,
} from "../../services/characterService";
import type { Character } from "../../types";
import { validateRetainer } from "../../utils/validation/roster";

/**
 * Where a new retainer is added to one character, on a page of its own so it
 * has the whole screen to itself. Decides whether the retainer can be added and
 * what to say when it can't, so the form only has to show it.
 */
export const AddRetainerContainer = ({
  characters,
  marketBoardCities,
  onCharactersChanged,
}: {
  characters: Character[];
  marketBoardCities: string[];
  /** Called once the retainer is added, so the roster can be read again. */
  onCharactersChanged: () => void;
}) => {
  const { characterId } = useParams();
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = useState<string>();

  // Removed in another tab, or an address typed by hand. Replaced rather than
  // pushed, so going back doesn't land here again.
  const character = characters.find(({ id }) => id === characterId);
  if (!character) return <Navigate to="/characters" replace />;

  const onSubmit = (details: RetainerDetails) => {
    const error = validateRetainer(
      details,
      character.retainers,
      marketBoardCities,
    );
    // Nothing is attempted while the character wouldn't accept it.
    if (error) return setErrorMessage(error);

    setErrorMessage(undefined);
    characterService
      .addRetainer(character.id, details)
      .then(() => {
        onCharactersChanged();
        // Back to the roster, where the new retainer shows.
        navigate("/characters");
      })
      .catch(() => setErrorMessage("Something went wrong. Try again shortly."));
  };

  return (
    <div className="app">
      <title>{`Add a Retainer for ${character.name}`}</title>
      <header>
        <h1>Add a Retainer for {character.name}</h1>
      </header>

      <section
        className="card"
        aria-label={`Add a retainer for ${character.name}`}
      >
        <RetainerForm
          label={`Add a retainer for ${character.name}`}
          marketBoardCities={marketBoardCities}
          initial={{ name: "", city: "" }}
          submitLabel="Add retainer"
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
