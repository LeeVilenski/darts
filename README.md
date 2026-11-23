# Darts

A 3D darts game for the browser — mobile first. Built with Vite, TypeScript, React Three Fiber and a custom deterministic ballistics engine. Deployed on Vercel.

See [`docs/PLAN.md`](docs/PLAN.md) for the full implementation plan and milestones.

## How to play

- Pick a game: **x01 (501 / 301 / 701)**, **Cricket**, **Around the Clock** or **Practice** (with a heatmap).
  Up to 4 players share one device; any seat can be an AI opponent (Pub / Club / County / Pro).
- **Drag** to move the aim marker, then **flick up and release** to throw. Flick speed is the weight
  (too hard lands high, too soft low); tilting the flick pushes the dart sideways.
- Prefer a power bar? Settings → Throwing → **Power meter**: hold the Throw button and release in the green.
- **Keyboard:** arrow keys aim (Shift for fine), hold **Space** and release in the green to throw,
  Space also collects darts and skips replays.
- The camera follows your dart, AI throws get a TV side angle, and 180s, checkouts and bounce-outs get a
  slow-motion replay (tap to skip). **Reduced motion** in Settings turns this off.
- A first-run tutorial walks through aiming and throwing; replay it from the menu.
- **Stats** keeps lifetime records per player; optional accounts sync them (docs/ACCOUNTS.md).
- Installable as an app and playable offline after the first visit.

## Settings

Aim assist, bounce-outs (realistic / low / off), throwing (flick / power meter), board colours
(classic / colour-blind), camera (cinematic / reduced motion), replays, graphics (auto / high / battery
saver), sound, caller and pub ambience.

## Development

```bash
pnpm install
pnpm dev          # http://localhost:5173
pnpm test         # engine unit tests (Vitest)
pnpm typecheck && pnpm lint
pnpm build && pnpm size   # production build + bundle-size budget
```

## Layout

```
src/engine/   pure TypeScript: board geometry, hit resolution, ballistics, throw model, RNG (unit-tested)
src/game/     React Three Fiber scene, input handling
src/ui/       DOM HUD overlay
src/store/    zustand game store
```

## Deployment

Vercel builds every push: pull requests get preview deployments, `main` deploys to production. CI (`.github/workflows/ci.yml`) runs typecheck, lint, tests, build and the size budget.

- Caller voice packs: docs/VOICE.md
- Accounts / cloud save: docs/ACCOUNTS.md
- Analytics: enable **Web Analytics** in the Vercel project (Analytics tab) to start collecting.
