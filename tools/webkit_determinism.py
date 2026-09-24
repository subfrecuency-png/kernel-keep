#!/usr/bin/env python3.12
"""Cross-engine determinism: run the bundled game in WebKitGTK (JavaScriptCore, the engine family behind Safari)
and print the state hash after N ticks for each seed, to compare with Node/V8 (tools/hashes.ts) and Chromium (e2e).
Needs: python3-gi, gir1.2-webkit2-4.1 and a display (e.g. `xvfb-run -a python3 tools/webkit_determinism.py`)."""
import json, os, sys
import gi
gi.require_version('Gtk', '3.0'); gi.require_version('WebKit2', '4.1')
from gi.repository import Gtk, WebKit2, GLib

SEEDS = [int(s) for s in (sys.argv[1].split(',') if len(sys.argv) > 1 else ['777', '1', '42'])]
N = int(sys.argv[2]) if len(sys.argv) > 2 else 3000
page = 'file://' + os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'dist', 'kernel-keep.html'))
results, errors = {}, []

win = Gtk.OffscreenWindow(); view = WebKit2.WebView(); win.add(view); win.set_default_size(1280, 800); win.show_all()
settings = view.get_settings(); settings.set_allow_file_access_from_file_urls(True)

def run_next(i=0):
    if i >= len(SEEDS):
        print(json.dumps({'engine': 'WebKitGTK ' + '.'.join(map(str, (WebKit2.get_major_version(), WebKit2.get_minor_version(), WebKit2.get_micro_version()))), 'ticks': N, 'hashes': results, 'errors': errors}))
        Gtk.main_quit(); return False
    seed = SEEDS[i]
    js = f"(() => {{ window.__kkBoot.newMatch('normal', {seed}); const k = window.__kk; k.cs.paused = true; k.step({N}); return k.hash(); }})()"
    def done(v, res):
        try: results[str(seed)] = v.evaluate_javascript_finish(res).to_string()
        except Exception as ex: errors.append(f'seed {seed}: {ex}')
        GLib.idle_add(run_next, i + 1)
    view.evaluate_javascript(js, -1, None, None, None, done)
    return False

def on_load(v, ev):
    if ev == WebKit2.LoadEvent.FINISHED: GLib.timeout_add(800, run_next)
view.connect('load-changed', on_load)
GLib.timeout_add_seconds(240, lambda: (errors.append('timeout'), print(json.dumps({'hashes': results, 'errors': errors})), Gtk.main_quit()))
view.load_uri(page)
Gtk.main()
