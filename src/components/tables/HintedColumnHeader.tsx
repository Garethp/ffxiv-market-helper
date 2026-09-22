import type { ReactNode } from "react";
import { Hint } from "../Hint";

/**
 * A column header with a hint explaining how the column is worked out. Named
 * after the column alone, so the explanation isn't read out with every cell.
 */
export const HintedColumnHeader = ({
  name,
  hint,
}: {
  name: string;
  hint: ReactNode;
}) => (
  <th aria-label={name}>
    {name} <Hint about={name}>{hint}</Hint>
  </th>
);
