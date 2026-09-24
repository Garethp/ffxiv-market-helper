// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Character, RegionInfo } from "../../types";
import { CharacterCard } from "./CharacterCard";

const regions: RegionInfo[] = [
  {
    name: "Europe",
    dataCenters: [{ name: "Light", worlds: ["Raiden", "Odin"] }],
  },
];

const aCharacter = (overrides: Partial<Character> = {}): Character => ({
  id: "alice",
  name: "Alice",
  homeWorld: "Raiden",
  retainers: [],
  ...overrides,
});

const renderCard = (
  character: Character,
  {
    onRemove = vi.fn(),
    children,
  }: {
    onRemove?: () => void;
    children?: ReactNode;
  } = {},
) => {
  render(
    <MemoryRouter>
      <CharacterCard
        character={character}
        regions={regions}
        editHref="/characters/alice/edit"
        addRetainerHref="/characters/alice/retainers/new"
        onRemove={onRemove}
      >
        {children}
      </CharacterCard>
    </MemoryRouter>,
  );
  return { onRemove };
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("CharacterCard", () => {
  describe("showing the character", () => {
    it("should show the character's name, home world and region", () => {
      renderCard(aCharacter({ name: "Alice", homeWorld: "Odin" }));

      expect(
        screen.getByRole("heading", { level: 2, name: "Alice Odin (Europe)" }),
      ).toBeTruthy();
    });

    it("should say the region is unknown when the home world isn't in the directory", () => {
      renderCard(aCharacter({ homeWorld: "Nowhere" }));

      expect(
        screen.getByRole("heading", {
          level: 2,
          name: "Alice Nowhere (Unknown region)",
        }),
      ).toBeTruthy();
    });

    it("should show the character's note", () => {
      renderCard(aCharacter({ note: "Needs a manual meetup" }));

      expect(screen.getByText("Needs a manual meetup")).toBeTruthy();
    });
  });

  describe("showing the retainers", () => {
    it("should list the retainer rows it's given", () => {
      renderCard(
        aCharacter({
          retainers: [{ id: "r1", name: "Amarana", city: "Ul'dah" }],
        }),
        { children: <li>Amarana's row</li> },
      );

      const list = screen.getByRole("list", { name: "Alice's retainers" });
      expect(within(list).getByText("Amarana's row")).toBeTruthy();
    });

    it("should say when the character has no retainers yet", () => {
      renderCard(aCharacter({ retainers: [] }));

      expect(screen.getByText("No retainers yet.")).toBeTruthy();
      expect(screen.queryByRole("list")).toBeNull();
    });
  });

  it.each([
    ["Edit Alice", "/characters/alice/edit"],
    ["Add a retainer for Alice", "/characters/alice/retainers/new"],
  ])("should lead to the page for %s", (name, href) => {
    renderCard(aCharacter());

    expect(screen.getByRole("link", { name }).getAttribute("href")).toBe(href);
  });

  describe("removing the character", () => {
    it("should report the removal once it's confirmed", () => {
      vi.spyOn(window, "confirm").mockReturnValue(true);
      const { onRemove } = renderCard(aCharacter());

      fireEvent.click(screen.getByRole("button", { name: "Remove Alice" }));

      expect(onRemove).toHaveBeenCalledOnce();
    });

    it("should report nothing when removing it isn't confirmed", () => {
      vi.spyOn(window, "confirm").mockReturnValue(false);
      const { onRemove } = renderCard(aCharacter());

      fireEvent.click(screen.getByRole("button", { name: "Remove Alice" }));

      expect(onRemove).not.toHaveBeenCalled();
    });
  });
});
