// Temporary, while the FFXIV-styled themes are compared. Remove once one is picked.

export const themes = [
  { id: "plain", label: "Plain" },
  { id: "ff-dark", label: "FF Dark" },
] as const;

export type ThemeId = (typeof themes)[number]["id"];

/** Picks a theme. The select keeps its own current value, so this holds no state of its own. */
export const ThemeTrialSwitcher = ({
  initialTheme,
  onChange,
}: {
  initialTheme: ThemeId;
  onChange: (theme: ThemeId) => void;
}) => (
  <label className="theme-trial-switcher">
    Theme
    <select
      defaultValue={initialTheme}
      onChange={(event) => onChange(event.target.value as ThemeId)}
    >
      {themes.map(({ id, label }) => (
        <option key={id} value={id}>
          {label}
        </option>
      ))}
    </select>
  </label>
);
