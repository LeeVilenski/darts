# Darts

A 3D darts game for the browser — mobile first. Built with Vite, TypeScript, React Three Fiber and a custom deterministic ballistics engine. Deployed on Vercel.

See [`docs/PLAN.md`](docs/PLAN.md) for the full implementation plan and milestones.

## How to play

- **Career mode:** start in the Pub League and work up through the County Circuit and Challenge Tour to
  the Pro Tour. Each season is 4 knockout events against a fictional tour; the other matches are
  simulated through the same physics. Top 2 on the order of merit go up a tier. Earnings and a trophy
  cabinet are saved on the device.
- Pick a game: **x01 (501 / 301 / 701)** in legs or **sets**, **Cricket** (standard or **cut-throat**),
  **Around the Clock**, **Shanghai**, **Killer**, **Halve-It**, **Bob's 27**, the **121 checkout ladder**,
  or **Practice** (with a heatmap). Up to 4 players share one device; any seat can be an AI opponent
  (Pub / Club / County / Pro). Multi-player matches can start with a **bull-up** to decide who throws
  first, and the throw alternates every leg (and every set).
- **Drag** to move the aim marker, then **flick up and release** to throw. Flick speed is the weight
  (too hard lands high, too soft low); tilting the flick pushes the dart sideways.
- Prefer a power bar? Settings → Throwing → **Power meter**: hold the Throw button and release in the green.
- **Keyboard:** arrow keys aim (Shift for fine), hold **Space** and release in the green to throw,
  Space also collects darts and skips replays.
- Darts already in the board get in the way: a tight group can **deflect** the next dart off a barrel,
  brush the flights, knock it out of the board, or, very rarely, let it bury itself in the back of
  another dart (a **Robin Hood**: it stays there and scores nothing).
- AI opponents feel the **pressure** of leg and match darts, missed doubles and an opponent on a finish,
  and each has a character derived from its name (nerves, throwing tempo, favourite double), shown under
  its seat in the menu. County and Pro bots aim around their own darts in a covered treble, or switch to T19.
- You see the next dart in your hand; your eye follows each throw in, with a chase cam on the last dart
  of a turn and on finishing darts. AI turns get a TV board cam held on the target, and 180s, checkouts,
  bounce-outs and Robin Hoods get a slow-motion replay from behind the thrower (tap to skip).
  **Reduced motion** in Settings turns the follow, sway and shake off.
- A first-run tutorial walks through aiming and throwing; replay it from the menu.
- **Stats** keeps lifetime records per player; optional accounts sync them (docs/ACCOUNTS.md).
- Installable as an app and playable offline after the first visit.

## Settings

Aim assist, bounce-outs (realistic / low / off; also how often a dart is knocked out by another), throwing (flick / power meter), board colours
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
