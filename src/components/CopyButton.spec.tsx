// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CopyButton } from "./CopyButton";

afterEach(cleanup);

const renderButton = ({
  isCopied = false,
  onCopy = () => {},
}: { isCopied?: boolean; onCopy?: () => void } = {}) =>
  render(
    <CopyButton label="Copy item name" isCopied={isCopied} onCopy={onCopy} />,
  );

describe("CopyButton", () => {
  it("should be named after what it copies, since it's only an icon", () => {
    renderButton();

    expect(screen.getByRole("button", { name: "Copy item name" })).toBeTruthy();
  });

  it("should ask to copy when pressed", () => {
    const onCopy = vi.fn();
    renderButton({ onCopy });

    fireEvent.click(screen.getByRole("button", { name: "Copy item name" }));

    expect(onCopy).toHaveBeenCalledTimes(1);
  });

  it("should confirm only once something's been copied", () => {
    const { rerender } = renderButton();
    expect(screen.queryByText("Copied!")).toBeNull();

    rerender(
      <CopyButton label="Copy item name" isCopied={true} onCopy={() => {}} />,
    );

    expect(screen.queryByText("Copied!")).not.toBeNull();
  });
});
