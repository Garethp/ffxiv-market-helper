import type { RosterValidationError } from "../utils/validation/roster";
import { ErrorMessage } from "./ErrorMessage";

const describe = (error: RosterValidationError): string => {
  switch (error.reason) {
    case "missing-name":
      return "A name is needed.";
    case "unknown-world":
      return `${error.world || "That"} isn't a known world.`;
    case "unknown-city":
      return `${error.city || "That"} isn't a market board city.`;
    case "duplicate-character":
      return `There's already a character named ${error.name} on ${error.world}.`;
    case "duplicate-retainer":
      return `This character already has a retainer named ${error.name}.`;
  }
};

/** Why the roster wouldn't accept the details as entered. */
export const RosterChangeErrorMessage = ({
  error,
}: {
  error: RosterValidationError;
}) => {
  return <ErrorMessage>{describe(error)}</ErrorMessage>;
};
