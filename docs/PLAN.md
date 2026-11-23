# 3D Darts — Implementation Plan

Status: **draft, awaiting confirmation of open decisions (§6)**. No application code yet.

---

## 1. Tech stack & repo architecture

### Recommended stack

| Concern | Choice | Why |
|---|---|---|
| Language | **TypeScript (strict)** | Rules, scoring and physics are pure logic that benefit heavily from types and unit tests. |
| Build | **Vite** (static SPA) | A canvas game gets nothing from SSR. Vite gives fast HMR, a plain static `dist/` that Vercel serves from its CDN with zero serverless functions, and predictable chunk splitting. Next.js adds weight and hydration concerns for no gain. |
| 3D | **Three.js via React Three Fiber (R3F) + drei** | R3F keeps scene graph, HUD and menus in one React tree; drei gives `useGLTF`, KTX2/Meshopt loaders, `Environment`, `CameraControls`, `PerformanceMonitor`. The hot loop (flight sim) runs in `useFrame` and mutates refs, never React state. |
| State | **Zustand** (UI/session) + **pure TS game engine** | Game rules live in a framework-free `engine/` package: deterministic reducers, 100% unit-testable, reusable by the AI and (later) a multiplayer server. |
| Physics | **Custom ballistic integrator** (no Rapier/Cannon) | See §2.2. |
| Audio | **Howler.js** (or raw WebAudio) | Sprite sheets, mobile unlock handling, pooled one-shots. |
| UI | React + CSS modules (or Tailwind) | HUD/menus are DOM overlays above the canvas — crisper text, accessible, cheaper than in-scene text. |
| Testing | **Vitest** (engine, hit detection, physics), **Playwright** (smoke: app boots, a throw registers) | |
| Tooling | pnpm, ESLint, Prettier, `@gltf-transform/cli`, `size-limit` | |

### Folder structure

```
darts/
├─ .github/workflows/ci.yml        # typecheck, lint, test, build, size budget
├─ assets-src/                      # raw .blend/.glb/.png sources (Git LFS or kept out of repo)
├─ public/
│  └─ assets/                       # OPTIMIZED, deployable assets only
│     ├─ models/   *.glb            # meshopt + KTX2
│     ├─ textures/ *.ktx2
│     ├─ env/      studio_1k.hdr
│     ├─ audio/    sfx.webm + sfx.mp3 (sprite)
│     └─ basis/ draco/              # decoder wasm (self-hosted)
├─ scripts/
│  └─ optimize-assets.ts            # gltf-transform pipeline (assets-src -> public/assets)
├─ src/
│  ├─ engine/                       # PURE TS — no React, no Three
│  │  ├─ board/geometry.ts          # standard board dimensions, sector order
│  │  ├─ board/resolveHit.ts        # (x,y) on board plane -> Segment | Bounce | Miss
│  │  ├─ physics/ballistics.ts      # fixed-step integrator, plane intersection
│  │  ├─ physics/throwModel.ts      # gesture -> launch params (+ seeded noise)
│  │  ├─ modes/{x01,cricket,aroundTheClock}.ts
│  │  ├─ modes/types.ts             # GameMode interface
│  │  ├─ match/machine.ts           # match/turn state machine (reducer)
│  │  ├─ ai/{strategy,checkouts,skill}.ts
│  │  └─ rng.ts                     # seeded PRNG (replays, tests, multiplayer)
│  ├─ game/                         # R3F glue
│  │  ├─ scene/{Board,Dart,Room,Lighting}.tsx
│  │  ├─ camera/CameraDirector.tsx  # aim -> follow -> close-up
│  │  ├─ input/useThrowGesture.ts   # pointer sampling
│  │  └─ systems/FlightSystem.tsx   # useFrame-driven dart flight
│  ├─ ui/{Hud,Menus,Scoreboard,Settings}.tsx
│  ├─ audio/
│  ├─ store/                        # zustand slices
│  └─ main.tsx
├─ tests/e2e/
├─ vercel.json                      # cache headers
└─ docs/PLAN.md
```

**Vercel-specific notes**
- Pure static output → no function size limits apply; build is `pnpm build`, output `dist`.
- Deployment upload limits and build time are non-issues if raw sources stay out of `public/`. Commit only optimized assets; keep raw sources in `assets-src/` under Git LFS (enable LFS in Vercel project settings, or exclude via `.vercelignore`).
- `vercel.json` sets `Cache-Control: public, max-age=31536000, immutable` on `/assets/*` (filenames content-hashed by the optimize script) and the Vite `/assets` JS chunks.
- Three.js is ~150 KB gz; code-split the 3D scene (`React.lazy`) so the menu paints instantly.

---

## 2. Core gameplay & mechanics

### 2.1 Throwing & input model

Recommended model: **"aim, then flick"** — one model for mouse and touch, via Pointer Events.

1. **Aim phase.** Pointer down anywhere = grab the dart. While held, moving the pointer moves the dart/aim reticle in screen space (with a sensitivity curve; fine-aim slows movement near rest). The reticle is the *intended* impact point at "perfect" power.
2. **Flick phase.** Pull back slightly and push forward/up, then release. We keep a ring buffer of `{x, y, t}` samples (last ~100 ms, from `getCoalescedEvents()` for high-rate input).
3. **Release → launch parameters** (all computed at `pointerup`):
   - **Power** = flick speed along the throw axis (px/s, normalized by viewport height so phones and desktops feel alike). Mapped against a *sweet-spot band*; too slow → dart lands low, too fast → high. Band width is the main difficulty knob.
   - **Lateral error** = angle between flick direction and vertical → horizontal deviation of launch yaw.
   - **Release timing/consistency** = flick acceleration profile; a jerky release (high variance in the last samples) adds launch pitch noise.
   - **Wobble** = curvature of the flick path → initial angular velocity of the dart around its pitch/yaw axes (visual + a small aerodynamic effect on final angle of entry).
   - **Spin** = roll around the long axis; purely cosmetic (real dart spin has negligible effect on trajectory).
4. **Assist level** (settings): shows a trajectory hint / power meter, widens sweet spot, and blends final launch toward aim (`launch = lerp(raw, ideal, assist)`).
5. **Desktop alternative**: optional "click-hold-release" power meter mode for trackpads and accessibility.

Touch specifics: `touch-action: none` on the canvas, a single active pointer ID, ignore multi-touch, and haptics (`navigator.vibrate`) on impact where supported.

### 2.2 Trajectory & physics — decision: **custom lightweight ballistics**

A full physics engine (Rapier/Cannon) buys nothing here: there is one rigid body, one planar target, no stacking or joints, and we need **determinism** (seeded replays, AI using the same pipeline, future multiplayer validation) and **millimetre-accurate** board resolution. Rapier would add ~400 KB wasm and make the result harder to reason about.

Model:
- Real-world units (metres, seconds). Oche at 2.37 m from the board face, bull centre 1.73 m high.
- Fixed-step integration at 240 Hz (semi-implicit Euler) — decoupled from render frame rate; render interpolates.
  `v += (g + drag(v)) * dt; p += v * dt` with g = 9.81 m/s² and a small quadratic drag term (tunable; can be zero).
- Typical launch ≈ 5–7 m/s, flight ≈ 0.35–0.45 s, i.e. a real upward arc — this is what makes it feel like darts.
- **Orientation**: dart's forward axis slerps toward the velocity vector (weathervane effect of flights) with a damped oscillation for wobble: `θ(t) = θ₀·e^(−ζt)·sin(ωt)`. Roll accumulates from spin.
- **Impact**: analytic segment–plane intersection between the last two steps (no tunnelling, exact hit point). Embed depth and final angle derive from entry velocity/angle.
- Solver for "ideal launch": given an aim point, solve the launch velocity for a fixed flight time (closed form) — used by assist, AI, and the power sweet-spot.
- Same code runs headless in tests and in the AI.

### 2.3 Dartboard hit detection — decision: **mathematical polar coordinates**

Mesh colliders are imprecise at wire-level tolerance and expensive to author. Instead convert the impact point into board-local 2D `(x, y)` in mm, then:

```
r = hypot(x, y)
θ = atan2(x, y) in degrees, measured clockwise from 12 o'clock
sector = SECTORS[floor(((θ + 9) mod 360) / 18)]
SECTORS = [20,1,18,4,13,6,10,15,2,17,3,19,7,16,8,11,14,9,12,5]
```

Regulation radii (mm, to wire centre — configurable in `geometry.ts`):

| Zone | Radius |
|---|---|
| Inner bull (50) | 0 – 6.35 |
| Outer bull (25) | 6.35 – 15.9 |
| Inner single | 15.9 – 99 |
| Treble | 99 – 107 |
| Outer single | 107 – 162 |
| Double | 162 – 170 |
| Miss (off-score) | > 170 |

**Wire bounce-outs**: wires have a half-width ≈ 0.6 mm (ring wires) / spider. If the dart point lands within `wireHalfWidth + tipRadius` of any ring radius or radial boundary, it's a *wire contact*. Then roll a seeded probability (scales with how centred on the wire and with entry angle; e.g. 25% at dead centre → 0% at edge, configurable or off). Bounce → dart falls with a short scripted animation, scores 0, counts as thrown. Non-bounce → deflected to the side the tip centre lies on.

Output type: `{ kind: 'score', segment: 'T20', base: 20, multiplier: 3, points: 60, ring, sector, r, θ }` | `{ kind: 'bounce' }` | `{ kind: 'miss' }`.

The **visual board is generated procedurally from the same `geometry.ts`** (ring/sector geometry + canvas-generated or baked texture), so visuals and scoring can never drift apart. Unit tests sweep known points (every segment centre, every boundary ±ε).

---

## 3. Game modes & state machine

### 3.1 Engine shape

Pure reducer: `next = reduce(state, event)`. Events: `START_MATCH`, `THROW_RESOLVED(hit)`, `END_TURN`, `UNDO`, `FORFEIT`. Each mode implements:

```ts
interface GameMode<S> {
  id: 'x01' | 'cricket' | 'atc';
  init(players, options): S;
  applyDart(s: S, player, hit): { state: S; outcome: 'ok' | 'bust' | 'win' };
  turnSummary(s: S): TurnSummary;     // for HUD/caller
  suggestTargets(s: S, player): Target[]; // used by AI and checkout hints
}
```

### 3.2 Modes

- **x01 (301/501/701)** — options: double-in (off by default), double-out (default on), master-out.
  Bust when: remaining < 0, remaining == 1 (double-out), or remaining == 0 without a double/inner-bull finish. On bust the turn's score reverts to the turn-start value and the turn ends immediately. Win on legal checkout. Legs/sets support (first to N legs). Stats: 3-dart average, checkout %, 180s.
- **Cricket** — numbers 15–20 + bull. Single/double/treble = 1/2/3 marks; 3 marks closes. Marks beyond 3 on a number score points only if any opponent hasn't closed it. Win: all closed and points ≥ every opponent. Variant: cut-throat (later).
- **Around the Clock** — hit 1→20 then bull in order; optional "doubles advance 2 / trebles advance 3". Great as the tutorial.
- (Later) Practice/Free-throw with heatmap, Shanghai, Killer.

### 3.3 Turn/flow state machine (UI + camera layer)

```
Menu → MatchSetup → [LegStart]
  → Aiming ──release──▶ InFlight ──impact──▶ Impact (≈0.6 s close-up, score pop)
       ▲                                         │
       └──── darts left in turn & not bust ◀─────┤
                                                 ├─ bust/3 darts → TurnSummary → (retrieve darts) → NextPlayer → Aiming
                                                 └─ win → LegOver → (MatchOver | LegStart)
```

Implemented as a small typed FSM (hand-rolled, or XState if the graph grows); the engine reducer is called only at `Impact`.

### 3.4 Camera transitions

| State | Camera |
|---|---|
| Aiming | First-person at oche, eye height ~1.65 m, slight FOV zoom-in while holding; optional subtle hand sway at higher difficulty. |
| InFlight | Chase cam: spring-follow behind/above the dart, look-at blends from dart to board; slow-mo on near-boundary hits (optional). |
| Impact | Close-up dolly to impact point (~0.35 m from board), hold, then return. |
| TurnSummary | Board close-up framing all three darts. |
| AI turn | Same pipeline, or a faster "TV" angle with skip button. |

All transitions via critically-damped springs (drei `CameraControls` or custom), interruptible, with a **"reduced motion"** setting that cuts instead of flies and skips follow-cam.

### 3.5 AI opponent

- **Strategy layer** picks an intended target per dart: x01 uses a checkout table (e.g. 170 = T20 T20 Bull) plus "setup shots" leaving preferred doubles (D16/D20/D8); outside checkout range aims T20 (or T19 when T20 is blocked/bad luck). Cricket: close the highest open number where it's behind, score where opponent is open.
- **Execution layer** converts target → aim point → ideal launch, then applies **2D Gaussian scatter** in mm at the board (σ by level, e.g. Pub ≈ 45 mm, Club ≈ 28 mm, County ≈ 18 mm, Pro ≈ 11 mm) plus rare "bad dart" outliers. Scatter is applied to launch params so the dart visibly flies the arc — same physics, same resolver, same seeded RNG.
- Personality: think-time jitter, small tilt toward safer doubles at lower levels.
- Calibrate by headless simulation (Vitest bench): target 3-dart averages ≈ 40 / 60 / 80 / 100.

---

## 4. Phased milestones

Each milestone ends deployed to a Vercel preview and merged to `main` (→ production).

| # | Milestone | Scope | Exit criteria |
|---|---|---|---|
| **M0** | Scaffold & pipeline | Vite+TS+R3F, lint/test/CI, Vercel project linked, `vercel.json`, empty scene with board placeholder. | Green CI; PR previews auto-deploy; prod on `main`. |
| **M1** | **Playable prototype** | Procedural board from `geometry.ts`; polar hit resolver + tests; ballistic integrator; aim-then-flick input (mouse + touch); one dart, static camera; text readout of last score. | Can throw and see correct score on desktop and phone. |
| **M2** | Real turns & 501 | Three darts per turn, retrieval, x01 engine with bust/double-out, HUD scoreboard, 1–2 local players (hot-seat), checkout hints. | A full 501 leg playable start-to-finish. |
| **M3** | Feel & camera | Camera director (aim/follow/close-up), dart orientation + wobble, impact embed, wire bounce-outs, assist levels, tuning pass on gesture mapping. | Blind playtest: throws "feel fair". |
| **M4** | AI opponents | Strategy + scatter model, 4 difficulty levels, sim-calibrated. | Averages within ±5 of targets. |
| **M5** | More modes | Cricket, Around the Clock (as tutorial), match options (legs/sets), stats screen. | All modes covered by engine tests. |
| **M6** | Audio | Throw whoosh, thud (varies by segment/wire), bounce clink, crowd/ambient bed, optional score caller sprite. Mobile audio unlock. | Audio toggles persist; no clipping/latency on iOS. |
| **M7** | Environment & lighting | Pub/arena room GLB, HDRI, baked lightmaps / AO, board spotlight + soft shadows, quality tiers (`PerformanceMonitor` auto-downgrade). | ≥ 60 fps mid-range desktop, ≥ 30 fps on 3-yr-old phone; LCP < 2.5 s on 4G. |
| **M8** | Polish | Menus, settings, onboarding, accessibility (reduced motion, colour-blind board palette, remappable assist), PWA/offline, local stats persistence, analytics. | Lighthouse perf ≥ 85 mobile. |
| M9+ | Optional | Online multiplayer, leaderboards, cosmetics (dart skins). | — |

---

## 5. GitHub & Vercel workflow

### Branching
- `main` = production (protected: PR required, CI must pass, linear history/squash merge).
- Short-lived feature branches `feat/*`, `fix/*`, `chore/*` → PR → Vercel **Preview Deployment** auto-commented on the PR.
- Conventional Commits; optional `release-please` for changelog/tags later.

### CI (GitHub Actions, `.github/workflows/ci.yml`, on PR + push to main)
1. `pnpm install --frozen-lockfile` (cached)
2. `pnpm typecheck` (`tsc --noEmit`)
3. `pnpm lint`
4. `pnpm test` (Vitest — engine, resolver, physics, AI sims)
5. `pnpm build`
6. `size-limit` — fail if initial JS > budget (e.g. 350 KB gz) or any `public/assets` file over its budget
7. (M3+) Playwright smoke against the Vercel preview URL (triggered by `deployment_status` event)

Vercel's Git integration handles deploys itself; CI only gates merges (no Vercel token in Actions needed).

### Asset optimization pipeline
- `scripts/optimize-assets.ts` with **glTF-Transform**:
  `dedup → prune → weld → simplify (LODs) → resample → meshopt compression → textures to KTX2 (UASTC for normal maps, ETC1S for albedo/ORM) → resize (max 2048, most 1024)`
- Prefer **Meshopt** over Draco (smaller decoder, faster decode, also compresses animations). Self-host decoder wasm in `public/assets/`.
- HDRI: 1k `.hdr` (or prefiltered PMREM `.ktx2`), < 1.5 MB.
- Audio: single sprite, `webm/opus` + `mp3` fallback.
- Load order: menu (no 3D) → board + dart (critical, < 500 KB) → room/HDRI streamed in behind a Suspense fallback with a neutral studio light. `useGLTF.preload` while the player is in menus.
- Budgets: first interactive throw ≤ 1.5 MB transferred; full environment ≤ 6 MB.
- Content-hashed filenames + immutable cache headers.

---

## 6. Open decisions (prioritized) — please confirm

| # | Question | Impact | **Recommended default** |
|---|---|---|---|
| 1 | **Single-player vs. multiplayer scope** for v1? | Architecture (server, auth, netcode) | **Single-player vs AI + local hot-seat (2–4 players).** Keep engine deterministic/seeded so online can be added later without rewrites. |
| 2 | **Art style & asset sourcing** | Load size, timeline, look | **Stylized-realistic, mostly procedural** (board generated in code, dart modelled simply in-house), plus one CC0 pub room + CC0 HDRI (Poly Haven) in M7. No paid assets. |
| 3 | **Input model** | Core feel | **Aim-then-flick** (drag to aim, flick to throw) for both mouse and touch; click-hold power meter as an alternate setting. |
| 4 | **Aim assist level default** | Accessibility vs. skill ceiling | **Three presets (Casual / Standard / Pro)**, default **Standard**: no trajectory line, moderate sweet-spot, mild launch correction. |
| 5 | **Realism of wire bounce-outs** | Frustration vs. authenticity | **On, low probability (~10% max)**, toggle in settings. |
| 6 | **Game modes for v1** | Scope | **501 (double-out), Cricket, Around the Clock**; 301/701 as x01 options. |
| 7 | **Platform priority** | Input & perf tuning | **Desktop and mobile equally; mobile portrait supported**, landscape preferred. |
| 8 | **Framework** | Dev speed | **Vite + React Three Fiber** (vs. plain Three.js or Next.js). |
| 9 | **Camera style** | Motion sickness / spectacle | **Cinematic follow + close-up with "reduced motion" option**; skippable AI turns. |
| 10 | **Sound & UI polish** | Timeline | **SFX + ambient bed in M6; no voice caller in v1** (add a synthesized/recorded caller later). |
| 11 | **Persistence / accounts** | Backend needs | **None** — local stats in `localStorage`. No backend in v1. |
| 12 | **Analytics** | Privacy | **Vercel Web Analytics** (cookie-less) only. |
| 13 | **Package manager / repo** | Minor | **pnpm, single package** (no monorepo until a server exists). |

Once these are confirmed (or adjusted), implementation starts at **M0 → M1**.
