# Visual checkpoint — frozen 2026-11-11

**Identity for the first release**
- Primary theme: Field Paper · Ember with shaded relief.
- Secondary theme: Aurora Night.
- Type: Source Serif 4 + Public Sans.
- The other six palettes stay in the picker as "review only" and are not part of the first presentation.
- No further broad visual redesign. Only fixes that affect readability, accuracy or usability.

## What is frozen and where

- Folder: `checkpoints/visual-signoff-2026-11-11/` (read-only) and the same content as `checkpoints/visual-signoff-2026-11-11.tar.gz` (41 MB, SHA-256 in the `.sha256` file beside it).
- `MANIFEST.json` lists all 80 files with SHA-256 and size.
- Contents: the build (`build/`), every data file, font and library it loads (`assets/`), the single-file offline build, the sign-off notes, 17 sign-off review boards, 21 Aurora Night screenshots, and the test logs.
- Source revision: branch `design/field-atlas-prototype`, commit `18d1e5e`, **plus uncommitted work**. The sign-off build has never been committed; the checkpoint folder is the record of its exact content. Committing it (and tagging the commit) is the stronger form of freeze and needs your go-ahead.
- Tests recorded against these exact files: 43 data tests passed; 59/59 browser checks passed.

## Aurora Night inspection

Rendered from the frozen build with no page errors and viewed: people at desktop full size; flows, income and population change at desktop two-thirds size; people, flows, income, selected province (sheet half open) and Toronto rent on phone at full size; people, flows, federal seats and a no-value state on tablet at reduced size.

Finding: Aurora Night works as the dark alternative. Columns, arcs, labels, over-scale markers and the stippled no-value state all read clearly. Shaded relief is nearly invisible on the dark land, so the dark theme is effectively a flat map; that is acceptable and avoids any clash with data colours.

## Remaining visual and usability defects, in priority order

1. **Election map shows British Columbia 2025 for the wrong party** (data defect C1 in the audit; visible in both themes). Accuracy — fix before any election content.
2. **Tied provinces on the election map look like wins** (C2). Accuracy.
3. **Phone people map is crowded:** eight values plus abbreviations at 390 px. Readable; track, don't block.
4. **Flow legend note wraps beside the swatches** on phone and desktop. Cosmetic; track.
5. **"Suppressed" marker in the rent legend never applies** to the series shown (C5). Small accuracy/clarity fix.
6. **Value labels on the darkest fills look heavy** on the light theme. Cosmetic.
7. **Population density marks the pre-1991 combined territories "below scale"** in many years. Widen that one scale or accept.
8. **Palette or surface change reloads the page.** Usability, low.

Nothing in 3–8 should delay development.
