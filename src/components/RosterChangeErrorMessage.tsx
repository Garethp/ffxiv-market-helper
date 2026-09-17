import type { RosterChangeError } from "../services/characterService";

const describe = (error: RosterChangeError): string => {
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
    case "character-not-found":
      return "This character has since been removed. Refresh the page to see the current roster.";
    case "retainer-not-found":
      return "This retainer has since been removed. Refresh the page to see the current roster.";
  }
};

/** Why a change to the character roster wasn't made. */
export const RosterChangeErrorMessage = ({
  error,
}: {
  error: RosterChangeError;
}) => {
  return (
    <p role="alert" className="form-error">
      {describe(error)}
    </p>
  );
};
