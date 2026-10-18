This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed

Expo ships breaking changes every SDK release. If needed, get up to date data:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run prettier, lint and typecheck before declaring any task done.

## Rules

- Use `interface` only for contracts implemented by classes; use `type` for data shape.
- Use camelCase or CamelCase for application source filenames, not kebab-case or snake_case. Preserve names required by tools/frameworks. Do not rename existing files solely to enforce this convention unless explicitly requested.
- Use the `@/` alias (mapped to `src/`) for cross-module imports instead of long relative paths such as `../../platform/...` or `./src/...`. Short same-directory imports may remain relative.
- Separate logical blocks, class methods and top-level declarations with a blank line. Group related statements together and use blank lines between setup, guards, operations and result handling where they form distinct logical steps.
- Do not put styles in the same line, each style is on the new line. 
- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md
