# Optional desktop shell (Tauri 2) — status: Proposed / untested

The default way to play is to open `dist/kernel-keep.html` in a browser, offline. This folder is only an **optional** native window around that same build. It was adapted from the Kernel Keep Master v0.2 kit.

**Status:** it has not been compiled or run. The build machine had no Rust toolchain, so nothing here is claimed to work until someone builds it on a Mac.

How it is set up:
- `productName` is Kernel Keep. `frontendDist` is `../../dist`, and `beforeBuildCommand` runs the web build first.
- It has no plugins and an empty capability set: no filesystem, shell, HTTP or updater access.
- `bundle.active` is false and signing is ad-hoc (`"-"`).
- There is **no** Apple Developer enrollment, **no** notarization and **no** distribution. An ad-hoc-signed app runs only on the machine that built it. Gatekeeper will warn about it elsewhere.
- CSP is `script-src 'self'`. The web build inlines its script and CSS into one HTML file. Tauri 2 normally adds hashes for inline assets it finds in `frontendDist` at compile time. **Verify this on the first build.** If the window is blank, check the WebView console for CSP errors.

To try it on the Mac (this needs Rust and the Tauri CLI; both are free):
```sh
# once: curl https://sh.rustup.rs -sSf | sh   and   cargo install tauri-cli --version "^2"
cd desktop
cargo tauri dev        # opens a window showing ../dist/index.html
```
Saves live in the WebView's localStorage, which is separate from the browser's. Use Export/Import save in the pause menu to move a game between them.
