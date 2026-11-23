# Darts

A 3D darts game for the browser — mobile first. Built with Vite, TypeScript, React Three Fiber and a custom deterministic ballistics engine. Deployed on Vercel.

See [`docs/PLAN.md`](docs/PLAN.md) for the full implementation plan and milestones.

## How to play

- Pick a game in the menu: **501 / 301 / 701** (double-out or straight-out, optional double-in, 1–5 legs, 1–4 players passing one device) or **Practice**.
- **Drag** anywhere to move the aim marker (it moves slower than your finger for fine control).
- **Flick up and release** to throw. Flick speed sets the weight — too hard lands high, too soft lands low; tilting the flick pushes the dart sideways. Releasing slowly just finishes aiming.
- The camera follows the dart and holds a close-up on where it lands; touch to skip. **Reduced motion** (Settings) cuts between shots instead.
- A checkout route is suggested when you're on a finish. After a turn (three darts, a bust or a checkout), tap to collect your darts.

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
