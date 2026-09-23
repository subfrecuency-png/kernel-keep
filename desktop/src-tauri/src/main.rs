#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
// Optional native shell: shows dist/index.html in a system WebView. No plugins, no filesystem,
// shell, HTTP or updater permissions. Saves stay in the WebView's localStorage.
fn main() {
  tauri::Builder::default()
    .run(tauri::generate_context!())
    .expect("Could not launch Kernel Keep");
}
