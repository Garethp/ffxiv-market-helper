# Working conventions

## Tooling

- Yarn, not npm.
- Dependency versions are exact — no `^` or `~`. Any `yarn add` should land pinned.
- Prettier with default settings. No custom `.prettierrc` overrides.
- Vitest for tests.
- Run `format`, `test`, and `build` after making changes, before calling something done.

## Tests

- Follow red-green TDD. Write a test for the next piece of behavior first, run it and watch it fail for the expected reason, then write the minimum code to make it pass, then refactor with the tests green.
- Bug fixes start with a failing test that reproduces the bug.
- `it("should ...")` / `describe(...)`, phrased as sentences.
- A test suite should read as a description of intended behavior, not a trace of the implementation. Group by behavior, not by which function happens to implement it.

## Writing style (docs, comments, explanations)

- State things plainly. Don't set up a misconception to knock down ("it's not X, it's Y") when nobody's confused yet.
- Be concise. No filler, no restating the obvious, no padding a summary to look thorough.
- Domain documentation is domain vocabulary only — no file paths, function names, or architecture commentary in it. That kind of thing goes in code comments, not a glossary.

## Don't guess

- Verify facts (API behavior, IDs, URL schemes, library behavior) against a real source before relying on them. Don't state something as true because it's plausible or remembered.
- If a real bug is spotted incidentally, fix it and say so, rather than leaving it or working around it silently.

## Decisions and scope

- Don't infer intent from data and act on it silently (e.g. collapsing two roster entries because they look like duplicates). Flag it and leave the data alone.
- Ambiguous design calls: make the reasonable default and say what was chosen and why, rather than blocking on a question — but say it plainly so it can be overridden.
- Implement what was asked. No unrequested refactors, cleanup, or scope expansion alongside a requested change.

## Code preferences

- Discriminated unions over one flat type with a lot of nullable fields, for anything that's really a set of distinct states.
- Composition over inheritance for bolting UI-only or incidental fields onto a domain type.
- Don't store something that's derivable from something else already stored — derive it instead of risking the copies drifting apart.
- Centralize tunable/config values in one place rather than scattering constants across files.
