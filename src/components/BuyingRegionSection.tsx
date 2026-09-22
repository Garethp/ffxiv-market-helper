import type { ReactNode } from "react";
import type { BuyingRegion } from "../services/tradingConfig";

/** The profit of buying through one region: who buys there, any caveats about doing so, and the table of rows given. */
export const BuyingRegionSection = ({
  buyingRegion,
  children,
}: {
  buyingRegion: BuyingRegion;
  /** The region's rows, laid out however the page wants them. */
  children: ReactNode;
}) => {
  return (
    <section className="character-section">
      <h2>
        Buying via {buyingRegion.characters.map((c) => c.name).join(", ")} (
        {buyingRegion.region})
      </h2>
      {buyingRegion.characters.map((character) =>
        character.note ? (
          <p key={character.id} className="character-note">
            {character.name}: {character.note}
          </p>
        ) : null,
      )}
      {children}
    </section>
  );
};
