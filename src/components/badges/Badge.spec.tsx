// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { descriptionOf } from "../../testing/descriptionOf";
import { Badge } from "./Badge";

afterEach(cleanup);

describe("Badge", () => {
  it("should be explained by its tooltip, reachable without a pointer", () => {
    render(
      <Badge className="gap-badge" tooltip="Room to undercut">
        gap
      </Badge>,
    );

    const badge = screen.getByText("gap");
    expect(descriptionOf(badge)).toBe("Room to undercut");
    expect(badge.getAttribute("tabindex")).toBe("0");
  });

  it("should take the look it's given", () => {
    render(
      <Badge className="gap-badge" tooltip="Room to undercut">
        gap
      </Badge>,
    );

    expect(screen.getByText("gap").className).toBe("gap-badge");
  });
});
