// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { SellListingStatus } from "../../types";
import { descriptionOf } from "../../testing/descriptionOf";
import { UndercutBadge } from "./UndercutBadge";

type UndercutStatus = Extract<SellListingStatus, { state: "undercut" }>;

const undercutStatus = (
  overrides: Partial<UndercutStatus> = {},
): UndercutStatus => ({
  state: "undercut",
  ourPricePerUnit: 5000,
  rank: 4,
  cheapestListings: [
    { pricePerUnit: 1000, quantity: 5, retainerName: "Someone", ours: false },
  ],
  ...overrides,
});

const listingRows = () => screen.getAllByRole("row").slice(1);

afterEach(cleanup);

describe("UndercutBadge", () => {
  it("should describe the competition it's been undercut by, reachable without a pointer", () => {
    render(
      <UndercutBadge
        status={undercutStatus({ ourPricePerUnit: 500, rank: 3 })}
      />,
    );

    const badge = screen.getByText("undercut");
    expect(descriptionOf(badge)).toContain("Your listing:");
    expect(badge.getAttribute("tabindex")).toBe("0");
  });

  it("should show our own listing's price and where it ranks", () => {
    render(
      <UndercutBadge
        status={undercutStatus({ ourPricePerUnit: 12345, rank: 7 })}
      />,
    );

    expect(
      screen.getByText(`Your listing: ${(12345).toLocaleString()} (rank #7)`),
    ).not.toBeNull();
  });

  it("should list who posted each of the cheapest listings, at what price and quantity, in order", () => {
    render(
      <UndercutBadge
        status={undercutStatus({
          cheapestListings: [
            {
              pricePerUnit: 1000,
              quantity: 5,
              retainerName: "Alpha",
              ours: false,
            },
            {
              pricePerUnit: 1250,
              quantity: 99,
              retainerName: "Beta",
              ours: false,
            },
          ],
        })}
      />,
    );

    const cells = listingRows().map((row) =>
      Array.from(row.querySelectorAll("td")).map((cell) => cell.textContent),
    );
    expect(cells).toEqual([
      ["Alpha", (1000).toLocaleString(), "5"],
      ["Beta", (1250).toLocaleString(), "99"],
    ]);
  });

  it("should single out our own listings among them", () => {
    render(
      <UndercutBadge
        status={undercutStatus({
          cheapestListings: [
            {
              pricePerUnit: 1000,
              quantity: 5,
              retainerName: "Alpha",
              ours: false,
            },
            {
              pricePerUnit: 5000,
              quantity: 5,
              retainerName: "RetainerA",
              ours: true,
            },
          ],
        })}
      />,
    );

    expect(
      listingRows().map((row) => row.classList.contains("own-listing")),
    ).toEqual([false, true]);
  });
});
