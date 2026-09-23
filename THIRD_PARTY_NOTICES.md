# Third-party notices

The built game (`dist/kernel-keep.html`) bundles these runtime libraries. Their MIT licence texts are in `licenses/`.

| Package | Version | Licence |
|---|---|---|
| react | 19.3.0 | MIT (`licenses/react-LICENSE.txt`) |
| react-dom | 19.3.0 | MIT (`licenses/react-dom-LICENSE.txt`) |
| scheduler | (react-dom dependency) | MIT (`licenses/scheduler-LICENSE.txt`) |

The exact runtime and development dependencies are pinned in `package-lock.json`. Development-only tools (esbuild, TypeScript, tsx, Playwright) are not shipped in the build.

The game uses system fonts only and downloads no web fonts. No third-party game engine is redistributed, and no proprietary game art. All artwork was generated for this project; the provenance is in `ART_AND_UI_GUIDE.md` and `reference/master-0.2/ASSET_MANIFEST.json`.

The optional desktop shell in `desktop/src-tauri` depends on Tauri 2 (MIT/Apache-2.0). It is **not** bundled in the browser build. It is fetched by Cargo only if you choose to build it.
