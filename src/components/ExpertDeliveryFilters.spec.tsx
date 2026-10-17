import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExpertDeliveryFilters } from "./ExpertDeliveryFilters";

const onMinimumSealsPerGilChange = vi.fn();
const onMaximumPricePerUnitChange = vi.fn();

const renderFilters = () =>
  render(
    <ExpertDeliveryFilters
      minimumSealsPerGil={4}
      onMinimumSealsPerGilChange={onMinimumSealsPerGilChange}
      maximumPricePerUnit={1000}
      onMaximumPricePerUnitChange={onMaximumPricePerUnitChange}
    />,
  );

const getField = (label: string) =>
  screen.getByLabelText<HTMLInputElement>(label);

const type = (label: string, value: string) =>
  fireEvent.change(getField(label), { target: { value } });

const advanceTime = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

describe("ExpertDeliveryFilters", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
    vi.useRealTimers();
  });

  it("should show the limits in use", () => {
    renderFilters();

    expect(getField("Minimum seals / gil").value).toBe("4");
    expect(getField("Maximum price").value).toBe("1k");
  });

  it.each([
    [
      "Minimum seals / gil",
      onMinimumSealsPerGilChange,
      onMaximumPricePerUnitChange,
    ],
    ["Maximum price", onMaximumPricePerUnitChange, onMinimumSealsPerGilChange],
  ])(
    "should report the %s typed once typing pauses, and only then",
    (label, onChange, onOtherChange) => {
      renderFilters();

      type(label, "3");
      advanceTime(299);

      expect(getField(label).value).toBe("3");
      expect(onChange).not.toHaveBeenCalled();
      advanceTime(1);
      expect(onChange).toHaveBeenCalledExactlyOnceWith(3);
      expect(onOtherChange).not.toHaveBeenCalled();
    },
  );

  it("should report only the last value when typing carries on before the pause", () => {
    renderFilters();

    type("Minimum seals / gil", "0");
    advanceTime(200);
    type("Minimum seals / gil", "0.");
    advanceTime(200);
    type("Minimum seals / gil", "0.1");
    advanceTime(300);

    expect(onMinimumSealsPerGilChange).toHaveBeenCalledExactlyOnceWith(0.1);
  });

  it("should wait for the pause after a key that leaves the value unchanged", () => {
    renderFilters();

    type("Minimum seals / gil", "0");
    advanceTime(200);
    // Still 0, but more is on its way.
    type("Minimum seals / gil", "0.");
    advanceTime(299);

    expect(onMinimumSealsPerGilChange).not.toHaveBeenCalled();
    advanceTime(1);
    expect(onMinimumSealsPerGilChange).toHaveBeenCalledExactlyOnceWith(0);
  });

  it("should stop waiting to report once it's gone", () => {
    const { unmount } = renderFilters();

    type("Minimum seals / gil", "3");
    unmount();
    advanceTime(300);

    expect(onMinimumSealsPerGilChange).not.toHaveBeenCalled();
  });

  it("should report a cleared field as no limit", () => {
    renderFilters();

    type("Maximum price", "");
    advanceTime(300);

    expect(onMaximumPricePerUnitChange).toHaveBeenCalledExactlyOnceWith(
      undefined,
    );
  });

  it("should report nothing when a field is typed back to the limit in use", () => {
    renderFilters();

    type("Minimum seals / gil", "5");
    advanceTime(200);
    type("Minimum seals / gil", "4");
    advanceTime(300);

    expect(onMinimumSealsPerGilChange).not.toHaveBeenCalled();
  });
});
