import { describe, expect, it } from "vitest";
import { asBasePath } from "./vite.config";

describe("the base path a build is served from", () => {
  it("should be the root when nothing says otherwise", () => {
    expect(asBasePath(undefined)).toBe("/");
  });

  it("should be the root for a site served from the root of a domain", () => {
    expect(asBasePath("")).toBe("/");
  });

  it("should add the trailing slash Vite needs to a project site's prefix", () => {
    expect(asBasePath("/ffxiv-market-helper")).toBe("/ffxiv-market-helper/");
  });

  it("should leave an already well-formed prefix alone", () => {
    expect(asBasePath("/ffxiv-market-helper/")).toBe("/ffxiv-market-helper/");
  });

  it("should add the leading slash Vite needs to a bare prefix", () => {
    expect(asBasePath("ffxiv-market-helper")).toBe("/ffxiv-market-helper/");
  });
});
