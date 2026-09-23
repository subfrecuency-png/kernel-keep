// Art derived from Kernel_Keep_Master_v0.2 concept sheets (generated concept art; see ART_AND_UI_GUIDE.md).
// esbuild inlines these as data: URIs so the game stays a single offline file.
import menuBg from '../../assets/art/derived/menu-background.webp';
import sheetRoles from '../../assets/art/derived/sheet-six-roles.webp';
import sheetStructures from '../../assets/art/derived/sheet-ten-structures.webp';
import runner from '../../assets/art/derived/role-runner.webp';
import ping from '../../assets/art/derived/role-ping.webp';
import bulwark from '../../assets/art/derived/role-bulwark.webp';
import lancer from '../../assets/art/derived/role-lancer.webp';
import patcher from '../../assets/art/derived/role-patcher.webp';
import breaker from '../../assets/art/derived/role-breaker.webp';
import core from '../../assets/art/derived/structure-core.webp';
import cache from '../../assets/art/derived/structure-cache.webp';
import compiler from '../../assets/art/derived/structure-compiler.webp';
import rig from '../../assets/art/derived/structure-rig.webp';
import node from '../../assets/art/derived/structure-node.webp';
import bank from '../../assets/art/derived/structure-bank.webp';
import grid from '../../assets/art/derived/structure-grid.webp';
import wall from '../../assets/art/derived/structure-wall.webp';
import gate from '../../assets/art/derived/structure-gate.webp';
import tower from '../../assets/art/derived/structure-tower.webp';
import icon from '../../assets/icons/icon.svg';

export const ART = { menuBg, sheetRoles, sheetStructures, icon };
/** Portrait per simulation type id (units and buildings). */
export const PORTRAITS: Record<string, string> = { runner, ping, bulwark, lancer, patcher, breaker, core, cache, compiler, rig, node, bank, grid, wall, gate, tower };
