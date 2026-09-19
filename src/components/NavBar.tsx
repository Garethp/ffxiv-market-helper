import { NavLink } from "react-router-dom";
import type { Character } from "../types";
import { CharacterSelection } from "./CharacterSelection";
import { GitHubLink } from "./GitHubLink";

/**
 * Shared across every page: the Current Character picker, then links to the top-level pages,
 * with a link out to the source at the far end.
 */
export const NavBar = ({
  characters,
  currentCharacter,
  onSelectCharacter,
}: {
  characters: Character[];
  currentCharacter: Character | null;
  onSelectCharacter: (character: Character) => void;
}) => {
  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <CharacterSelection
          characters={characters}
          currentCharacter={currentCharacter}
          onSelect={onSelectCharacter}
        />
        <div className="navbar-links">
          {/* `end` so this link isn't also marked current on every other page. */}
          <NavLink to="/" end className="navbar-link">
            Tracked Items
          </NavLink>
          <NavLink to="/high-volume-items" className="navbar-link">
            High Volume Items
          </NavLink>
          <NavLink to="/expert-delivery" className="navbar-link">
            Expert Delivery
          </NavLink>
          <NavLink to="/characters" className="navbar-link">
            Characters
          </NavLink>
          <NavLink to="/manage-items" className="navbar-link">
            Manage Items
          </NavLink>
        </div>
        <div className="navbar-github">
          <GitHubLink />
        </div>
      </div>
    </nav>
  );
};
