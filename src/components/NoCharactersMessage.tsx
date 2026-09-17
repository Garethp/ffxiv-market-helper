import { Link } from "react-router-dom";

/** Shown in place of a page that prices items, when there's no character to price them for. */
export const NoCharactersMessage = () => {
  return (
    <div className="app">
      <title>Welcome</title>
      <section className="empty-state">
        <h1>Welcome!</h1>
        <p>
          Before any prices can be worked out, add a character. It will sell on
          its home world, and buy from anywhere in that world's region.
        </p>
        <p>
          Add its retainers as well, so the right sell tax is used and your own
          listings are recognized on the market board.
        </p>
        <Link to="/characters" className="empty-state-action">
          Add your first character
        </Link>
      </section>
    </div>
  );
};
