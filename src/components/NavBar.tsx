import { useEffect, useId, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import type { Character } from "../types";
import { CharacterSelection } from "./CharacterSelection";
import { GitHubLink } from "./GitHubLink";

/**
 * Shared across every page: the Current Character picker, then links to the top-level pages,
 * with a link out to the source at the far end. On a narrow screen the links are tucked into a
 * menu that slides out from the side.
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
  const menuId = useId();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const closeMenu = () => setIsMenuOpen(false);

  useEffect(() => {
    if (!isMenuOpen) return;
    // Escape hands focus back to the button, since whatever had it is being hidden.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setIsMenuOpen(false);
      menuButton.current?.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isMenuOpen]);

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <CharacterSelection
          characters={characters}
          currentCharacter={currentCharacter}
          onSelect={onSelectCharacter}
        />
        <div
          id={menuId}
          className={["navbar-links", isMenuOpen ? "navbar-links-open" : ""]
            .filter(Boolean)
            .join(" ")}
        >
          {/* `end` so this link isn't also marked current on every other page. */}
          <NavLink to="/" end className="navbar-link" onClick={closeMenu}>
            Tracked Items
          </NavLink>
          <NavLink
            to="/high-volume-items"
            className="navbar-link"
            onClick={closeMenu}
          >
            High Volume Items
          </NavLink>
          <NavLink
            to="/expert-delivery"
            className="navbar-link"
            onClick={closeMenu}
          >
            Expert Delivery
          </NavLink>
          <NavLink to="/characters" className="navbar-link" onClick={closeMenu}>
            Characters
          </NavLink>
          <NavLink
            to="/manage-items"
            className="navbar-link"
            onClick={closeMenu}
          >
            Manage Items
          </NavLink>
          {/* Inside the links, so it goes into the menu along with them. */}
          <div className="navbar-github">
            <GitHubLink />
          </div>
        </div>
        {/* Covers the page behind the open menu, so a tap anywhere outside it closes it. */}
        {isMenuOpen ? (
          <div className="navbar-backdrop" onClick={closeMenu} />
        ) : null}
        {/* Only shown on a narrow screen, where the links are in the menu. Sits above the open menu,
            so it can close it again. */}
        <button
          ref={menuButton}
          type="button"
          className="navbar-menu-button"
          aria-label="Menu"
          aria-controls={menuId}
          aria-expanded={isMenuOpen}
          onClick={() => setIsMenuOpen((open) => !open)}
        >
          <span aria-hidden="true">{isMenuOpen ? "✕" : "☰"}</span>
        </button>
      </div>
    </nav>
  );
};
