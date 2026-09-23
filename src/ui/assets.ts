// Art derived from Kernel_Keep_Master_v0.2 concept sheets (generated concept art; see ART_AND_UI_GUIDE.md).
// esbuild inlines these as data: URIs so the game stays a single offline file.
// Portraits are the same cut-out sprites the battlefield uses, so the HUD and the world show one set of images.
import menuBg from '../../assets/art/derived/menu-background.webp';
import sheetRoles from '../../assets/art/derived/sheet-six-roles.webp';
import sheetStructures from '../../assets/art/derived/sheet-ten-structures.webp';
import icon from '../../assets/icons/icon.svg';
import { SPRITE_URLS } from '../client/sprites.ts';

export const ART = { menuBg, sheetRoles, sheetStructures, icon };
/** Portrait per simulation type id (units and buildings): the player's (cyan) sprite. */
export const PORTRAITS: Record<string, string> = Object.fromEntries(Object.entries(SPRITE_URLS).map(([k, v]) => [k, v[0]]));
/** Rival (red-shifted) variant, for the codex. */
export const RIVAL_PORTRAITS: Record<string, string> = Object.fromEntries(Object.entries(SPRITE_URLS).map(([k, v]) => [k, v[1]]));
