// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { descriptionOf } from "../testing/descriptionOf";
import type {
  TrackedItemChangeResult,
  TrackedItemSettings,
} from "../services/trackedItemService";
import { pricingHints } from "./pricingHints";
import { TrackedItemSettingsForm } from "./TrackedItemSettingsForm";

type Initial = {
  quality: "NQ" | "HQ" | null;
  targetQuantity: number;
  sellPriceCeiling?: number;
};

const succeeds = (): TrackedItemChangeResult => ({ ok: true });

const renderForm = ({
  initial = { quality: null, targetQuantity: 999 },
  submitLabel = "Track item",
  onSubmit = vi.fn(async () => succeeds()),
  onCancel = vi.fn(),
}: {
  initial?: Initial;
  submitLabel?: string;
  onSubmit?: (
    settings: TrackedItemSettings,
  ) => Promise<TrackedItemChangeResult>;
  onCancel?: () => void;
} = {}) => {
  render(
    <TrackedItemSettingsForm
      label="Track Cordial"
      initial={initial}
      submitLabel={submitLabel}
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
  describe("explaining the settings", () => {
    it.each([
      ["target quantity", pricingHints.targetQuantity],
      ["sell price ceiling", pricingHints.sellPriceCeiling],
    ])("should explain what the %s means", (setting, explanation) => {
      renderForm();

      expect(
        descriptionOf(screen.getByRole("button", { name: `About ${setting}` })),
      ).toBe(explanation);
    });

    it("should not submit when an explanation is opened", () => {
      const { onSubmit } = renderForm({
        initial: { quality: "NQ", targetQuantity: 999 },
      });

      fireEvent.click(
        screen.getByRole("button", { name: "About target quantity" }),
      );

      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  it("should be named as given", () => {
    renderForm();

    expect(screen.getByRole("form", { name: "Track Cordial" })).toBeTruthy();
  });

  describe("starting values", () => {
    it("should have neither NQ nor HQ chosen when no quality is given", () => {
      renderForm();

      expect(qualityOption("NQ").checked).toBe(false);
      expect(qualityOption("HQ").checked).toBe(false);
    });

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
    it("should label the submit button as given", () => {
      renderForm({
        initial: { quality: "NQ", targetQuantity: 999 },
        submitLabel: "Save",
      });

      expect(submitButton("Save")).toBeTruthy();
    });

    it("should only allow submitting once NQ or HQ has been chosen", () => {
      renderForm();

      expect(submitButton().disabled).toBe(true);
      fireEvent.click(qualityOption("HQ"));
      expect(submitButton().disabled).toBe(false);
    });

    it("should submit HQ and the target quantity and sell price ceiling as entered", async () => {
      const { onSubmit } = renderForm();

      fireEvent.click(qualityOption("HQ"));
      setField(targetQuantityField(), "60");
      setField(sellPriceCeilingField(), "5000");
      fireEvent.click(submitButton());

      await waitFor(() =>
        expect(onSubmit).toHaveBeenCalledWith({
          hq: true,
          targetQuantity: 60,
          sellPriceCeiling: 5000,
        }),
      );
    });

    it("should submit NQ as not HQ", async () => {
      const { onSubmit } = renderForm();

      fireEvent.click(qualityOption("NQ"));
      fireEvent.click(submitButton());

      await waitFor(() =>
        expect(onSubmit).toHaveBeenCalledWith({
          hq: false,
          targetQuantity: 999,
          sellPriceCeiling: undefined,
        }),
      );
    });

    it("should submit an emptied target quantity as 0", async () => {
      const { onSubmit } = renderForm({
        initial: { quality: "NQ", targetQuantity: 999 },
      });

      setField(targetQuantityField(), "");
      fireEvent.click(submitButton());

      await waitFor(() =>
        expect(onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({ targetQuantity: 0 }),
        ),
      );
    });

    it("should submit an emptied sell price ceiling as no ceiling", async () => {
      const { onSubmit } = renderForm({
        initial: { quality: "NQ", targetQuantity: 999, sellPriceCeiling: 5000 },
      });

      setField(sellPriceCeilingField(), "");
      fireEvent.click(submitButton());

      await waitFor(() =>
        expect(onSubmit).toHaveBeenCalledWith({
          hq: false,
          targetQuantity: 999,
          sellPriceCeiling: undefined,
        }),
      );
    });
  });

  describe("when the change is refused", () => {
    const refuse = async (): Promise<TrackedItemChangeResult> => ({
      ok: false,
      error: { reason: "already-tracked", name: "Cordial", hq: true },
    });

    it("should explain why", async () => {
      renderForm({ onSubmit: refuse });

      fireEvent.click(qualityOption("HQ"));
      fireEvent.click(submitButton());

      expect((await screen.findByRole("alert")).textContent).toBe(
        "Cordial is already tracked as HQ.",
      );
    });

    it("should keep the settings as entered, so they can be corrected", async () => {
      renderForm({ onSubmit: refuse });

      fireEvent.click(qualityOption("HQ"));
      setField(targetQuantityField(), "60");
      setField(sellPriceCeilingField(), "5000");
      fireEvent.click(submitButton());
      await screen.findByRole("alert");

      expect(qualityOption("HQ").checked).toBe(true);
      expect(targetQuantityField().value).toBe("60");
      expect(sellPriceCeilingField().value).toBe("5000");
    });
  });

  describe("when a later change is made", () => {
    it("should no longer explain an earlier refusal", async () => {
      const onSubmit = vi
        .fn<
          (settings: TrackedItemSettings) => Promise<TrackedItemChangeResult>
        >()
        .mockResolvedValueOnce({
          ok: false,
          error: { reason: "invalid-target-quantity" },
        })
        .mockResolvedValueOnce(succeeds());
      renderForm({ onSubmit });
      fireEvent.click(qualityOption("NQ"));
      fireEvent.click(submitButton());
      await screen.findByRole("alert");

      fireEvent.click(submitButton());

      await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
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
