# Optional desktop shell (Tauri 2)

**Status:** Linux build Tested (0.3.2). macOS is still untested and has no signed or notarized build.

The default way to play is still to open `dist/kernel-keep.html` in a browser, offline. This folder is an **optional** native window around that same build. It was adapted from the Kernel Keep Master v0.2 kit.

## What was verified (container, 2026-09-23)

- `cargo build --release --features custom-protocol` compiled 270 crates in about 6½ minutes on Linux, with rustc 1.95 and WebKitGTK 2.52.6. The result is a 12 MB binary.
- Under Xvfb, the window opened and showed the title screen. The inline game script ran under the CSP `script-src 'self'`, which means Tauri hashed the inline assets at compile time as expected.
- Clicking **New match** started a match, and the clock advanced. Screenshots: `docs/test-logs/tauri-title.webp` and `tauri-match.webp`. Script: `tools/tauri-smoke-linux.sh`.
- WebKit runs the simulation identically: `tools/webkit_determinism.py` gives the same state hashes as Node/V8 and Chromium (see TEST_REPORT.md).

## How it is set up

- `productName` is Kernel Keep. `frontendDist` is `../../dist`, and it is embedded into the binary at compile time, so **rebuild the web build first**: `npm run build`.
- It has no plugins and an empty capability set: no filesystem, shell, HTTP or updater access. Saves live in the WebView's localStorage.
- `bundle.active` is false. Signing is ad-hoc (`"-"`). There is no Apple Developer enrollment, no notarization and no distribution.
- The `custom-protocol` cargo feature serves the embedded files. Plain `cargo build` without it expects a dev server.

## Try it on the Mac (untested there; the tools are free)

```sh
# once: install the Xcode Command Line Tools (xcode-select --install) and Rust (https://rustup.rs)
npm run build
cd desktop/src-tauri
cargo build --release --features custom-protocol
./target/release/kernel-keep
```

Optional: to get a `Kernel Keep.app`, install the Tauri CLI (`cargo install tauri-cli --version "^2"`), set `"bundle": { "active": true, "targets": ["app"], … }`, then run `cargo tauri build`. An ad-hoc-signed app runs only on the Mac that built it; Gatekeeper warns about it elsewhere.
