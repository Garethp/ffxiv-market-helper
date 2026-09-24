import { useRef, useState } from "react";

/** How long a copy stays marked as copied. */
const COPIED_DISPLAY_MS = 1500;

/**
 * Copies text to the clipboard, remembering which copy was made most recently
 * for a short while so it can be marked as copied. Each copy is told apart by
 * a key, so that of several places copying the same text, only the one used
 * is marked.
 */
export const useCopyText = () => {
  const [copiedKey, setCopiedKey] = useState<string>();
  // Restarted by every copy, so an earlier copy never cuts a later one short.
  const clearTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const copyText = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      clearTimeout(clearTimer.current);
      clearTimer.current = setTimeout(
        () => setCopiedKey(undefined),
        COPIED_DISPLAY_MS,
      );
    } catch {
      // Clipboard access can be denied (permissions, non-secure context) — nothing to recover, just don't show "copied".
    }
  };

  return { copiedKey, copyText };
};
