import type { TrackedItemChangeError } from "../services/trackedItemService";

const describe = (error: TrackedItemChangeError): string => {
  switch (error.reason) {
    case "invalid-target-quantity":
      return "Target quantity needs to be a whole number of at least 1.";
    case "invalid-sell-price-ceiling":
      return "Sell price ceiling needs to be a whole number of gil, or left empty.";
    case "already-tracked":
      return `${error.name} is already tracked as ${error.hq ? "HQ" : "NQ"}.`;
    case "not-found":
      return "This item is no longer tracked. Refresh the page to see the current list.";
  }
};

/** Why a change to the tracked items wasn't made. */
export const TrackedItemChangeErrorMessage = ({
  error,
}: {
  error: TrackedItemChangeError;
}) => {
  return (
    <p role="alert" className="form-error">
      {describe(error)}
    </p>
  );
};
