# Career mode v2: plan

Status: built. All six phases are in (see [What shipped](#what-shipped) for where it differs from the plan).

## Where we are

`engine/career/` is solid underneath. It's pure and seeded, has a 48-player fictional roster over
four tiers, runs 8-player knockouts, and simulates AI-only matches through the real throw model.
The problems are mostly at the surface:

- **One long scrolling sheet** (`ui/CareerSheet.tsx`). The next match, the bracket, the merit
  table, the trophies and the Retire button are all stacked in a single dialog.
- **No calendar.** You only ever see the event you're in. You can't see what's coming, what you
  played, or what you're working towards.
- **No sense of a career.** There are no career stats, no form, no story. Promotion is a bare
  "top 2 go up", and the only real decision you get is Retire.
- **Rigid ladder.** Four events a season, the top two move up, and every tier plays the same way.

## Goals

1. **A proper career hub.** Tabs for your next fixture, the season calendar, the rankings, your
   profile and an inbox.
2. **A story with firm progression.** You start at your local pub, impress people, get messages
   offering wildcards into county events, earn a tour card at Q-School, and keep it by staying in
   the rankings. Every gate has a stated requirement and a progress bar. Nothing is random luck.
3. **A real RPG: you get better.** You start as a rough pub thrower. Your darts scatter more,
   wild darts happen, doubles drift and the aim shakes under pressure. Playing and training raise
   four **attributes** (Scoring, Finishing, Nerve, Rhythm) until, at the top, you throw as cleanly
   as the normal game, or a touch better under pressure. See [Player attributes](#player-attributes).
   Progression also comes from **access**, **reputation**, **ranking** and **unlocks**.

## The path (player's view)

| Stage            | Where you play                                                              | How you get in                                                                                       | How you move on                                                                                |
| ---------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **1. The Local** | Weekly pub knockouts at your local, plus the Pub League table               | From the start                                                                                       | Earn reputation, then a **wildcard** to a County Open                                          |
| **2. County**    | County Opens, County League, County Championship                            | Wildcard first. A County card if you go deep in a wildcard event or finish high in the County League | Top of the county ranking earns a **Q-School place**. Big results earn Challenge Tour invites  |
| **3. Q-School**  | One end-of-season qualifier: 3 days, each a knockout, with points per round | Q-School place, or pay the entry fee once you've earned enough                                       | Top N on Q-School points earn a **Tour Card** (2 seasons)                                      |
| **4. Pro Tour**  | Players Championships (floor events) and Euro/World Series                  | Tour Card                                                                                            | Rolling money ranking. Drop out of the top 64 when your card expires and it's back to Q-School |
| **5. Majors**    | Grand Prix, Matchplay, Masters, World Championship                          | Ranking top 16 or 32, or win a **qualifier** for the last spots                                      | Trophies, legacy                                                                               |

Example season 1, as a player would see it:

> **Week 1:** Red Lion Friday Knockout. You lose in the semi-final.
> **Week 3:** You win the Anchor Arms Cup. 📬 _"Saw you at the Anchor on Friday, that 121 finish was
> something. We've got a spare spot at the Northfield County Open in week 6. Fancy it? (Dave
> Marlow, Northfield DA secretary)"_ You **accept the wildcard**, and the event appears on the
> calendar.
> **Week 6:** Northfield Open. You reach the quarter-final. 📬 _"Good showing. You've earned your
> County card: county events are open to you from next season."_
> **End of season:** The Pub League finals night, then a season review: _Reputation 240 → "Known
> locally". Next: a County card ✔, Q-School place (finish top 4 in the County ranking)._

## Systems

### 1. Season calendar

- A season is a set number of **weeks** (start at 12 and tune it). Each week holds 0–3 events from
  the circuits you can see, generated from the seed (`calendar.ts`).
- Each event is data:
  `{ id, name, circuit, kind: 'open'|'league'|'invitational'|'qualifier'|'major', week, fieldSize, format, entry: EntryRule, prize, points, venue }`.
- `EntryRule = open | card(circuit) | invite | rankingTop(n) | qualifierFor(eventId) | fee(£)`.
  `entry.ts` holds a pure `eligibility(state, event)` that returns
  `{ ok } | { locked, reason, progress }`. The UI shows the reason, e.g. _"Top 16 in the ranking
  (you're 23rd)"_.
- You **choose** what to enter each week, or rest. Weeks you skip are simulated.
- Tier-locked events still show on the calendar, dimmed with a padlock. Seeing the Worlds sitting
  there in week 12 is part of the pull.

### 2. Reputation and milestones (the "you've impressed" engine)

- Reputation is earned per match and per event: wins, rounds reached, beating a higher-ranked
  player, 180s, ton-plus checkouts, a high average, a title. It has named bands ("Unknown",
  "Known locally", "County name", "Tour regular", "Star", "Legend"), and each band shows on the
  profile.
- `milestones.ts` is a list of data rules: `{ id, when(state): boolean, once: true, effect, message }`.
  For example:
  - `county-wildcard`: you win a pub event, or reputation ≥ 150. You get an invite to the next
    County Open and a message from the county secretary.
  - `county-card`: you reach the QF of a county event. You get a County card.
  - `qschool-place`: you finish in the County ranking top 4, or win the County Championship.
  - `nickname`: reputation ≥ 400. You pick a nickname, and the caller and the back of your shirt
    use it.
  - `major-invite`: you're in the ranking top 16 at the cut-off date.
- `evaluateMilestones(prev, next)` runs after every recorded result. It returns the new state plus
  any new messages. It's pure and deterministic, so it's easy to unit test: "win event X, expect
  message Y".

### 3. Inbox

- `messages: { id, week, season, from, subject, body, action? }[]`, with an unread badge on the
  Career tile and the hub tab.
- `action` lets a message offer something: "Accept wildcard" or "Decline", "Choose nickname",
  "Sign sponsor".
- Senders are a small fictional cast who recur through the career: the pub landlord, the county
  secretary, a local reporter, the tour's PR person, a rival.
- Message bodies are templates with slots for names, events and stats. That keeps them seeded and
  offline, with no LLM.

### 4. Rankings

- **Circuit tables** work like the order of merit today: Pub League, County ranking.
- **Tour ranking** is rolling prize money over the last 2 seasons, as in the real thing. It decides
  seedings, major invites and whether you keep your tour card.
- Brackets get **seeded** by ranking, and fields can be bigger: 16 or 32 players, with byes where
  needed.

### 5. Simulation at scale

- Bigger fields and simulated weeks mean far more AI-vs-AI matches. Full-physics `simulateMatch` is
  too slow for a 64-player event.
- Add `quickSim.ts`: per-level leg-win probabilities, and averages drawn from the calibrated
  distributions. A test fits the table from `simulateMatch` runs, so it stays honest when the AI is
  retuned.
- Keep full physics for matches the player watches or is near in the bracket, if that's
  affordable. Measure it first.

### 6. Career stats and profile

- Record every career match into `careerStats`: matches, wins, average, best average, 180s, highest
  checkout, checkout %, form (last 5), and head-to-head per opponent. The data is already there:
  `engine/stats/lifetime.ts` does the same job for lifetime stats.
- **Profile tab** has your avatar (`appearanceFor`), name or nickname, reputation band, status
  (cards held), a stats grid, a trophy shelf and a career timeline ("S1 W3: first title, Anchor
  Arms Cup").

### 7. Flavour (later)

- **Rivals.** The player who beats you most, or knocks you out of a final, becomes a rival. They
  get pre-match lines, a head-to-head shown on the walk-on card, and rival messages.
- **Venues.** Pass a `venue` per event to the scene: the pub as it is now, a county hall (strip
  lights, folding tables), a floor event (rows of boards), and a TV stage (walk-on, crowd, lights)
  for majors.
- **Money.** Entry fees for opens and Q-School make earnings matter. Earnings can also unlock
  cosmetics: barrels, flights, shirt designs, walk-on music. Money only buys cosmetics, never attribute points.

### 8. Player attributes

Your career player has four attributes, each rated 1–99. They only affect **career** matches and
career training. Quick play and practice are unchanged. The attributes scale the existing throw
model: `computeLaunch` gets a career-adjusted `AssistTuning`, and the pressure sway gets a
multiplier. So everything still comes from your own aim and flick. A low rating just makes the
consequences of a slightly-off dart bigger, and adds the odd shocker.

| Attribute     | What a low rating does (the pub you)                                                | Mechanic                                                           | Trained by                                  |
| ------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------- |
| **Scoring**   | Darts spray around the treble, and now and then one goes wild (well out of the bed) | Base scatter ×2.0 → ×1.0, wild-dart chance 10% → 0% (2.5× scatter) | Trebles hit, 100+ visits, 180s              |
| **Finishing** | Doubles and the bull drift off the wire                                             | Extra scatter on darts aimed at a double or bull, ×1.6 → ×1.0      | Doubles attempted and hit, checkouts        |
| **Nerve**     | The aim swings hard on a match dart, and a pressure dart scatters more              | Sway ×1.8 → ×0.7, pressure scatter +60% → 0                        | Darts hit under pressure, deciding legs won |
| **Rhythm**    | A slightly snatched or mistimed flick is punished hard                              | Unsteadiness scatter ×2.0 → ×0.8, power dead zone ×0.5 → ×1.2      | Clean releases, steady turns                |

The numbers are starting points. A calibration test (like `ai/calibration.test.ts`) simulates
perfect-technique legs at ratings 1 and 99. The target is that a rating-1 player with perfect
technique averages about pub/club level, and a rating-99 player with perfect technique plays
exactly like the normal game.

**How you improve (XP).** It's a mix of use-based and chosen:

- **Use-based XP.** Each attribute gains XP from the matching actions in career matches (see the
  table). Ratings rise as XP crosses thresholds, and each point costs more than the last.
- **Level-ups.** Match XP (more for wins, upsets and titles) raises your **player level**. Each
  level gives a **skill point** to spend on any attribute, so you choose your build. Fix your
  doubles, or become a heavy scorer.
- **Training.** Between events you can do **one training session**, a drill using the existing
  modes: Around the Clock → Scoring, Bob's 27 → Finishing, a 121 checkout ladder → Finishing and
  Nerve, a pressure drill → Nerve. You earn XP scaled by how well you did. With the calendar,
  training uses a week instead of an event.
- **Stage caps.** Your ceiling rises as you climb: 40 at the Pub, 60 at County, 80 on the Challenge
  Tour, 99 on the Pro Tour. A promotion message says so: _"Northfield's county coach has offered to
  work with you. Your ceiling has risen to 60."_ You can't max out at the Red Lion, and moving up
  always means you can get better.
- The HUD shows nothing new. The **pre-match card** shows your ratings next to the opponent's
  level, and the **post-match strip** shows the XP gained and any rating that went up
  ("Finishing 23 → 24").

## UI plan

Replace the single sheet with a full-screen **Career Hub** that uses the existing `Segmented`
tabs:

1. **Home:** a next-fixture card (event, round, venue, opponent card with avatar, level, form,
   head-to-head, "what's at stake: win to earn a County card"), the latest 2–3 messages, your form
   strip (W W L W L) and a **"Next goal"** progress bar.
2. **Calendar:** the season as a vertical week list. Each event card shows a circuit colour, its
   kind, prize, format and status: _entered / eligible / locked (reason) / result_. Tapping one
   opens its details and bracket.
3. **Rankings:** circuit table and tour ranking, highlighting you, the promotion or cut lines,
   and movement arrows.
4. **Profile:** attributes with XP bars and skill points to spend, stats, trophies, timeline. Retire lives here, behind a confirm.
5. **Inbox:** the message list with action buttons.

Other screens:

- **Event screen:** a seeded bracket that grows with the rounds and highlights your path.
- **Pre-match walk-on card:** before each career match, shows the stakes and the opponent.
- **Post-match:** `MatchOver` gets a career strip with reputation gained, ranking movement, and
  "📬 1 new message".
- **Season review:** a full-screen summary at season end showing results, ranking, status changes
  and goals for next season.
- **Look:** each stage gets its own accent. The Local is chalk and wood, County is club green, the
  Tour is broadcast navy and gold. The UI changes as you climb, so progress shows.

## Engine and file layout

```
engine/career/
  career.ts       state, newCareer, recordResult (slimmed: orchestrates the modules below)
  circuits.ts     replaces tiers.ts: circuits, event templates, formats, prizes, points
  calendar.ts     seeded season generation, week advance
  entry.ts        eligibility + reasons + progress
  bracket.ts      N-round seeded knockouts, byes (out of career.ts)
  quickSim.ts     fast statistical match results
  ranking.ts      circuit tables, rolling tour ranking
  reputation.ts   rep gain per match/event, bands
  milestones.ts   rules → effects + messages
  messages.ts     templates, cast of senders
  stats.ts        career stats + h2h
  attributes.ts   ratings, XP, levels, caps, and the career-adjusted throw tuning
  migrate.ts      v1 → v2 save migration
store/useCareer.ts  v2 state, actions: enterEvent, skipWeek, acceptInvite, readMessage…
ui/career/        Hub.tsx, HomeTab, CalendarTab, RankingsTab, ProfileTab, InboxTab,
                  EventScreen, WalkOnCard, SeasonReview
```

- Save key `darts.career.v2`. `migrate.ts` maps a v1 save to the right v2 status: your tier, plus
  trophies, results and earnings carried over. Nobody loses their career.
- The engine stays pure and the store stays thin, as now. Everything in the engine is unit-tested
  with fixed seeds, including a **"career playthrough" test**: a bot that wins everything reaches
  the Pro Tour in the expected number of seasons, and one that loses everything never leaves the
  pub.

## Phases

Each phase ships on its own and leaves the game playable.

1. **Hub and visibility.** Build the tabbed hub on the _current_ engine: Home, Calendar (the 4
   events of the season with results and what's next), Rankings, Profile with career stats. Add
   the walk-on card and the post-match strip. _This fixes the menus and the "can't see anything"
   problem straight away._
2. **Player attributes.** Ratings, XP and levels, skill points, the career throw tuning, the
   calibration test, and training sessions between events. This works on the current engine.
3. **Calendar and circuits (v2 model).** Weeks, choosing events, entry rules with locked reasons,
   seeded brackets, `quickSim`, v1→v2 migration.
4. **Reputation, milestones and inbox.** The wildcard storyline from the pub to the County card.
5. **The pro game.** Q-School, tour cards, rolling ranking, majors and their qualifiers, losing
   your card.
6. **Flavour.** Rivals, nicknames, venues, cosmetics and entry fees.

## Decisions (agreed)

- **Money:** entry fees and cosmetics.
- **Throwing skill:** real RPG attributes. You start debuffed and train up (see
  [Player attributes](#player-attributes)).
- **Pace:** pub → Pro Tour in 4–6 seasons of about 12 weeks each.
- **Stakes:** Tour Cards can be lost. County status is kept.
- **Saves:** existing careers are migrated. Old saves start with attributes at the level of their
  current tier.

## What shipped

All six phases are built. Where the result differs from the plan above:

- **Training** is one session per week, alongside that week's event. It doesn't use up the week.
- **Entry fees:** pub events are free, County Opens cost £25, Challenge Tour opens £100, and
  Q-School £500 without a place. Wildcards and invitations are free. Kit is cosmetic: 12 shirts
  (£150 each) and 6 patterns (£400 each). Your balance is earnings minus spending.
- **Tour Card:** valid for two seasons. When it runs out you keep it only inside the top 48 (the
  tour has 63 regulars). The tour ranking is seeded with a season-0 of money, so it has shape
  from the start.
- **Ways up, all of them firm:**
  - **County card:** win a match at a County event (through a wildcard), or finish top 2 on the
    Pub League.
  - **Challenge card:** reach a Challenge Tour quarter-final (through an invitation), finish top 2
    on the County merit, or reach a Q-School quarter-final.
  - **Tour Card:** reach the Q-School semi-finals, or finish top 2 on the Challenge merit.
  - **Majors:** top 14 on the ranking, or reach a qualifier final.
- **Simulation:** AI-only matches use `quickSim` (lognormal darts-per-leg per level, fitted to the
  physics and checked by a test). Your own matches are real.
- **Not built:** flight colours (every dart shares one material), walk-on music, and AI players
  moving between circuits.

Code: `engine/career/` holds `career.ts` (state, weeks, events, seasons), `circuits.ts` (the
calendar as data), `attributes.ts`, `milestones.ts` and `story.ts` (rules, messages,
reputation), `bracket.ts`, `quickSim.ts`, `goals.ts`, `kit.ts`, `stats.ts` and `migrate.ts`. The UI
lives in `ui/career/`. Venues are styled in `game/scene/Room.tsx`, and your kit and nickname
reach the scene through `setLookOverride` in `appearance.ts`.
