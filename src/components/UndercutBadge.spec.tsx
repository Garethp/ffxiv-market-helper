// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { SellListingStatus } from "../types";
import { descriptionOf } from "../testing/descriptionOf";
import { UndercutBadge } from "./UndercutBadge";

type UndercutStatus = Extract<SellListingStatus, { state: "undercut" }>;

const undercutStatus = (
  overrides: Partial<UndercutStatus> = {},
): UndercutStatus => ({
  state: "undercut",
  ourPricePerUnit: 5000,
  rank: 4,
  cheaperListings: [{ pricePerUnit: 1000, quantity: 5 }],
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

  it("should label the listing as undercut", () => {
    render(<UndercutBadge status={undercutStatus()} />);

    expect(screen.getByText("undercut")).not.toBeNull();
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

  it("should list the price and quantity of each cheaper listing, in order", () => {
    render(
      <UndercutBadge
        status={undercutStatus({
          cheaperListings: [
            { pricePerUnit: 1000, quantity: 5 },
            { pricePerUnit: 1250, quantity: 99 },
          ],
        })}
      />,
    );

    const cells = listingRows().map((row) =>
      Array.from(row.querySelectorAll("td")).map((cell) => cell.textContent),
    );
    expect(cells).toEqual([
      [(1000).toLocaleString(), "5"],
      [(1250).toLocaleString(), "99"],
    ]);
  });

  it("should list no cheaper listings when there are none", () => {
    render(<UndercutBadge status={undercutStatus({ cheaperListings: [] })} />);

    expect(listingRows()).toEqual([]);
  });
});
