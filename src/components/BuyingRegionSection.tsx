import type { BuyingRegion } from "../services/tradingConfig";
import type { DisplayRow } from "../types";
import { ProfitTable } from "./ProfitTable";

/** The profit of buying through one region: who buys there, any caveats about doing so, and the resulting rows. */
export const BuyingRegionSection = ({
  buyingRegion,
  rows,
  staleWarningThresholdMs,
  sellWorld,
}: {
  buyingRegion: BuyingRegion;
  rows: DisplayRow[];
  staleWarningThresholdMs: number | null;
  sellWorld: string;
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
      <ProfitTable
        rows={rows}
        staleWarningThresholdMs={staleWarningThresholdMs}
        sellWorld={sellWorld}
      />
    </section>
  );
};
