# Add Tabler icons

Run from `mobile` (Node.js 22.13 or newer):

```sh
npm run addItems star heart
npm run addItem -- --outline arrow-right arrow-left
```

Both npm commands are aliases. Filled is the default; use `--outline` or
`--filled` after npm's `--` separator to select a variant. Not all outline icons
exist in the filled collection. Missing names fail before any icons are copied.

On first use, the script downloads the Tabler GitHub `main` archive and caches
the filled and outline SVGs in `scripts/addIcons/icons` (gitignored). Later runs
work offline. To refresh, remove only that cache directory and run again.

Selected SVGs and Tabler's MIT license are copied into `src/assets/tabler`.
The script regenerates `src/app/assets/icons/iconsMap.ts` from every SVG in
the destination folders, sorting imports and object keys. Do not edit the
generated file manually. Re-running a command does not duplicate entries.

`arrow-right` becomes `TIconArrowRight`; outline becomes
`TIconArrowRightOutline`. Import the animated components like this:

```tsx
import { icons } from "@/app/assets/icons/iconsMap";

<icons.TIconArrowRightOutline width={24} height={24} color="black" />;
```

SVG imports use the Expo SVG transformer with forwarded refs for Reanimated.
After changing Metro configuration, restart with `npm run start:clear`.

Run script tests with `npm run test:icons`.
