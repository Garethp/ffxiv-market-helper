// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TrackedItemSettings } from "../services/trackedItemService";
import { TrackedItemSettingsForm } from "./TrackedItemSettingsForm";

type Initial = {
  quality: "NQ" | "HQ" | null;
  targetQuantity: number;
  sellPriceCeiling?: number;
};

const renderForm = ({
  initial = { quality: null, targetQuantity: 999 },
  submitLabel = "Track item",
  errorMessage,
  onSubmit = vi.fn(),
  onCancel = vi.fn(),
}: {
  initial?: Initial;
  submitLabel?: string;
  errorMessage?: string | null;
  onSubmit?: (settings: TrackedItemSettings) => void;
  onCancel?: () => void;
} = {}) => {
  render(
    <TrackedItemSettingsForm
      label="Track Cordial"
      initial={initial}
      submitLabel={submitLabel}
      errorMessage={errorMessage}
      onSubmit={onSubmit}
      onCancel={onCancel}
    />,
  );
  return { onSubmit, onCancel };
};

const qualityOption = (quality: "NQ" | "HQ") =>
  screen.getByLabelText(quality) as HTMLInputElement;
const targetQuantityField = () =>
  screen.getByLabelText("Target quantity") as HTMLInputElement;
const sellPriceCeilingField = () =>
  screen.getByLabelText("Sell price ceiling") as HTMLInputElement;
const submitButton = (name = "Track item") =>
  screen.getByRole("button", { name }) as HTMLButtonElement;

const setField = (field: HTMLInputElement, value: string) =>
  fireEvent.change(field, { target: { value } });

afterEach(cleanup);

describe("TrackedItemSettingsForm", () => {
  it("should be named as given", () => {
    renderForm();

    expect(screen.getByRole("form", { name: "Track Cordial" })).toBeTruthy();
  });

  describe("starting values", () => {
    it("should have the given quality chosen", () => {
      renderForm({ initial: { quality: "HQ", targetQuantity: 999 } });

      expect(qualityOption("NQ").checked).toBe(false);
      expect(qualityOption("HQ").checked).toBe(true);
    });

    it("should start with the given target quantity and sell price ceiling filled in", () => {
      renderForm({
        initial: { quality: "NQ", targetQuantity: 60, sellPriceCeiling: 5000 },
      });

      expect(targetQuantityField().value).toBe("60");
      expect(sellPriceCeilingField().value).toBe("5k");
    });

    it("should leave the sell price ceiling empty when none is given", () => {
      renderForm();

      expect(sellPriceCeilingField().value).toBe("");
    });
  });

  describe("submitting", () => {
    it("should only allow submitting once NQ or HQ has been chosen", () => {
      renderForm();

      expect(submitButton().disabled).toBe(true);
      fireEvent.click(qualityOption("HQ"));
      expect(submitButton().disabled).toBe(false);
    });

    it("should submit HQ and the target quantity and sell price ceiling as entered", () => {
      const { onSubmit } = renderForm();

      fireEvent.click(qualityOption("HQ"));
      setField(targetQuantityField(), "60");
      setField(sellPriceCeilingField(), "5000");
      fireEvent.click(submitButton());

      expect(onSubmit).toHaveBeenCalledWith({
        hq: true,
        targetQuantity: 60,
        sellPriceCeiling: 5000,
      });
    });

    it("should submit NQ as not HQ", () => {
      const { onSubmit } = renderForm();

      fireEvent.click(qualityOption("NQ"));
      fireEvent.click(submitButton());

      expect(onSubmit).toHaveBeenCalledWith({
        hq: false,
        targetQuantity: 999,
        sellPriceCeiling: undefined,
      });
    });

    it("should submit an emptied target quantity as 0", () => {
      const { onSubmit } = renderForm({
        initial: { quality: "NQ", targetQuantity: 999 },
      });

      setField(targetQuantityField(), "");
      fireEvent.click(submitButton());

      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ targetQuantity: 0 }),
      );
    });
  });

  describe("what went wrong with the last change", () => {
    it("should show the message it's given, whatever the reason was", () => {
      renderForm({ errorMessage: "Cordial is already tracked as HQ." });

      expect(screen.getByRole("alert").textContent).toBe(
        "Cordial is already tracked as HQ.",
      );
    });

    it("should show nothing when there's no message to show", () => {
      renderForm({ errorMessage: null });

      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("should still submit, leaving it to the caller whether to try again", () => {
      const { onSubmit } = renderForm({
        errorMessage: "Something went wrong.",
      });

      fireEvent.click(qualityOption("NQ"));
      fireEvent.click(submitButton());

      expect(onSubmit).toHaveBeenCalledOnce();
    });
  });

  describe("cancelling", () => {
    it("should report the cancellation without submitting anything", () => {
      const { onSubmit, onCancel } = renderForm();

      fireEvent.click(qualityOption("NQ"));
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

      expect(onCancel).toHaveBeenCalledOnce();
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });
});
