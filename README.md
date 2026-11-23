# Xmas Rensbo 2: The 3D-ening

**[Play here](https://henkrik.github.io/xmas-rensbo-2/)**

A 3D third-person Christmas murder-mystery & action-adventure game built from scratch in vanilla TypeScript with **zero external runtime dependencies**. Originally prototyped as a 2D SNES-style top-down adventure, the project evolved into a cel-shaded N64 / *Wind Waker HD*–inspired 3D shooter featuring destructible interior walls, multi-stage boss fights, procedural chiptune audio, and full desktop + mobile support.

---

## 1. Implementation Strategies & Technical Architecture

### Dual-Backend 3D Engine (WebGPU + WebGL2)
- **Zero-Dependency Custom Renderer:** Instead of pulling in Three.js or Babylon.js, the game implements its own 3D pipeline with a shared `Hardware3DRenderer` interface backed by both **WebGPU** ([`src/rendering/webgpuRenderer.ts`](src/rendering/webgpuRenderer.ts)) and **WebGL2** ([`src/rendering/webglRenderer.ts`](src/rendering/webglRenderer.ts)).
- **Automatic Platform Selection:** Desktop browsers default to WebGPU with automatic fallback to WebGL2; iOS Safari prefers WebGL2 by default for driver stability (overrideable via `?renderer=webgpu` or `?renderer=webgl`).
- **Cel-Shaded + Ink Outline Visuals:** Meshes are built procedurally via a custom `MeshBuilder` ([`src/rendering/models3d.ts`](src/rendering/models3d.ts)) with guaranteed outward CCW winding and rendered with banded cel-shading, dynamic point lights (fireballs, rockets, explosions, chandeliers), and an inverted-hull outline pass.
- **Static vs. Dynamic Mesh Split & Cache Invalidation:** Static level geometry (sloped snow terrain, roof, walls, ceilings, furniture) is cached per level and automatically rebuilt only when `state.mapVersion` increments (e.g., when a bazooka rocket destroys an interior wall/door or blackens an outer border wall). Dynamic entities (characters, projectiles, blood, flames, drops) are rebuilt per frame.
- **Procedural Texture Atlas & 2D HUD Overlay:** Surface textures (snow, pine, brick, wood grain, fabric, bathroom tile) are generated procedurally into a single GPU atlas ([`src/rendering/textures3d.ts`](src/rendering/textures3d.ts)). A transparent HTML5 2D `<canvas>` sits atop the 3D canvas ([`src/rendering/renderer.ts`](src/rendering/renderer.ts)) to draw pixel-art dialogue boxes, character portraits, equipment/health/armor HUDs, screen flashes, and 3D-projected NPC/Cat health billboards.

### Decoupled 2.5D Simulation & 3D Camera
- **Pure-TypeScript Game Simulation:** All movement, AABB/tilemap collision, combat, AI, and dialogue state machines live in pure TypeScript modules (`src/core/`, `src/world/`, `src/entities/`) completely decoupled from DOM/Canvas/GPU APIs. This allows the entire 79-test Vitest suite (`npm test`) to execute deterministically in Node in ~1 second.
- **Sloped Terrain, Roof Walking & 3D Camera:** Levels operate on 32×28 tilemaps (`TILE_SIZE = 16`) with continuous height functions (`getTerrainHeight`, `getMainHouseRoofElevation`) for sloped snow, stairs, jumping, and pitched-roof navigation ([`src/rendering/math3d.ts`](src/rendering/math3d.ts)).
- **Obstacle-Aware Over-the-Shoulder Camera:** `updateCamera3D` smoothly blends into an over-the-right-shoulder view when a weapon is equipped, uses temporary `LineOfSight` probes to pull the camera forward away from walls (with shoulder wall-clearance margins and center fallback), and projects the look target forward whenever `effectiveDistance` approaches zero so the camera never collapses into Santa looking at the floor.

### Combat, AI, Bosses & Destructible Environments
- **Arsenal & Mechanics:** Six equipment slots — Empty (jump/interact), Unarmed (punch), Uzi (30-round mag, 1.5s reload, spread), Flamethrower (ignites NPCs, wood stacks, and the player with burn DoT + 4× Uzi spread while charred), Katana (wide melee slash), and Bazooka (fast rockets with splash damage that destroy interior walls/doors over 1s and char outer walls).
- **NPC AI & Sight:** Armed NPCs patrol or guard rooms using ray-sampled `ConeOfSight` detection ([`src/entities/sight.ts`](src/entities/sight.ts)), react with a 0.5s blinking `!` alert, propagate alerts to nearby NPCs, navigate around obstacles via A* pathfinding ([`src/world/pathfinding.ts`](src/world/pathfinding.ts)), and enter frantic burning mode when ignited. Damaging any outside NPC turns all outside NPCs hostile with Uzis; shooting the outside dog kills it instantly.
- **Bosses & Hazards:** Includes two boss encounters (Anne-Marie with 500 HP, 25% damage reduction, and periodic 4× katana sprints; Rosanna/"Other Santa" jumping through the kitchen window with a bazooka), a hostile headcrab-style cat that leaps onto the right side of Santa's face (immune to projectiles while latched, 4× Uzi spread penalty, 5× punch damage to knock off), military body armor (200 HP navy bar; medkits heal life only up to 100 HP), and a C4 house-demolition finale.

### Procedural N64-Style Web Audio & iOS Support
- **100% Procedural Soundtrack & SFX:** [`src/core/audio.ts`](src/core/audio.ts) synthesizes all music and sound effects at runtime using the Web Audio API (oscillators, filtered noise buffers, dynamics compressor, warm N64 DAC low-pass filter, and stereo delay bus).
- **Adaptive Music & State-Observer SFX:** Plays a festive Christmas track during exploration, switches to a high-intensity track strictly during the Rosanna and Anne-Marie boss fights, and transitions to a victory fanfare during the C4 demolition. A state observer diffs `GameState` snapshots each tick to trigger footsteps, barks/meows, locked doors, 4-stage Uzi reloads, flames, embers, glass shattering, and explosions.
- **iOS Safari Reliability:** Uses `navigator.audioSession.type = 'playback'` (plus a silent HTML5 `<audio>` fallback) so audio plays even with the iPhone Silent switch on, capture-phase unlock listeners on `touchstart`/`touchend`/`pointerdown`/`pointerup`/`click`, synchronous 1-sample silent buffer priming, and recovery from iOS's `'interrupted'` state.

### Desktop & Mobile Controls
- **Desktop:** `WASD` movement (camera-relative strafing when a weapon is equipped), `Arrow` keys to turn/pitch camera, `Space` to jump/interact/fire (with a 0.25s post-interaction weapon cooldown and 0.5s anti-skip dialogue lock), `1–6` to switch equipment.
- **Mobile:** Dual virtual joysticks (left move, right camera), tap-and-hold anywhere on the game canvas to fire, mobile-only top-right `"Toggle weapon"` button, context-sensitive Action button, and FOV auto-aim toward the closest hostile NPC whenever the right joystick is idle.

---

## 2. NPM Scripts & URL Query Flags

| Command | Description |
| :--- | :--- |
| `npm start` | Exports `docs/` and serves it locally on `http://localhost:8080/` via a minimal static server (zero injected scripts/polling). |
| `npm test` | Runs the Vitest unit test suite (`vitest run`). Use `npm run test:watch` for watch mode. |
| `npm run typecheck` | Runs `tsc --noEmit` for strict TypeScript verification. |
| `npm run export` | Typechecks and bundles the release build into `docs/` (`index.html`, `style.css`, `secret.txt`, `game.js` with PNGs inlined as Data URLs). |
| `npm run generate-assets` | Regenerates spritesheets and pixel-art character portraits. |

**Useful URL query parameters:** `?debug` (on-screen debug log), `?cheat` (invincibility + pre-placed ladder + infinite Uzi refills), `?fps` (FPS counter), `?level=outside|basement|upstairs|people` (jump straight to a level with Uzi), `?renderer=webgl|webgpu` (force 3D backend), `?giveUpSorry` (Secret Santa ending screen).

---

## 3. Directory Structure

```text
xmas-rensbo-2/
├── src/
│   ├── main.ts                  # Browser bootstrap, WebGPU/WebGL2 init, input & mobile controls, RAF loop
│   ├── style.css                # Responsive desktop/mobile layout & virtual joystick styles
│   ├── assets/index.ts          # Static ES module PNG asset imports (inlined by esbuild)
│   ├── core/                    # audio.ts (Web Audio synth), input.ts, debugConsole.ts, secretSantaDB.ts
│   ├── entities/                # player.ts, npcCombat.ts, cat.ts, dog.ts, snowball.ts, sight.ts
│   ├── world/
│   │   ├── gameState.ts         # Central simulation tick, projectiles, combat, pickups, dialogues
│   │   ├── tilemap.ts           # Map definitions, collision helpers, landmarks
│   │   ├── interaction.ts       # Interactables & dialogue state types
│   │   ├── pathfinding.ts       # A* tile pathfinder
│   │   └── levels/              # levelOutside.ts, levelBasement.ts, levelUpstairs.ts, levelPeople.ts
│   └── rendering/               # webgpuRenderer.ts, webglRenderer.ts, models3d.ts, textures3d.ts, math3d.ts, renderer.ts, pixelFont.ts
├── test/player.test.ts          # Comprehensive 79-test Vitest simulation, 3D mesh & audio suite
├── scripts/                     # export-docs.mjs (esbuild bundler), dev-server.mjs, asset generators
└── docs/                        # Static GitHub Pages release bundle (see export.md)
```
