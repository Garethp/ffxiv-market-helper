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
 * Where one retainer's details are changed, on a page of its own so it has the
 * whole screen to itself. Decides whether the details can be saved and what to
 * say when they can't, so the form only has to show it.
 */
export const EditRetainerContainer = ({
  characters,
  marketBoardCities,
  onCharactersChanged,
}: {
  characters: Character[];
  marketBoardCities: string[];
  /** Called once the details are saved, so the roster can be read again. */
  onCharactersChanged: () => void;
}) => {
  const { characterId, retainerId } = useParams();
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = useState<string>();

  // Removed in another tab, or an address typed by hand. Replaced rather than
  // pushed, so going back doesn't land here again.
  const character = characters.find(({ id }) => id === characterId);
  const retainer = character?.retainers.find(({ id }) => id === retainerId);
  if (!character || !retainer) return <Navigate to="/characters" replace />;

  const onSubmit = (details: RetainerDetails) => {
    const error = validateRetainer(
      details,
      character.retainers,
      marketBoardCities,
      retainer.id,
    );
    // Nothing is attempted while the character wouldn't accept it.
    if (error) return setErrorMessage(error);

    setErrorMessage(undefined);
    characterService
      .updateRetainer(character.id, retainer.id, details)
      .then(() => {
        onCharactersChanged();
        // Back to the roster, where the changed details show.
        navigate("/characters");
      })
      .catch(() => setErrorMessage("Something went wrong. Try again shortly."));
  };

  return (
    <div className="app">
      <title>{`Edit ${retainer.name}`}</title>
      <header>
        <h1>Edit {retainer.name}</h1>
      </header>

      <section className="card" aria-label={`Edit ${retainer.name}`}>
        <RetainerForm
          label={`Edit ${retainer.name}`}
          marketBoardCities={marketBoardCities}
          initial={retainer}
          submitLabel="Save retainer"
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
