import { TIER_CAPS } from './attributes';
import {
  eligibility,
  eventById,
  grantCard,
  holdsCard,
  ordinal,
  standings,
  tourPosition,
  YOU,
  type CareerState,
  type EventResult,
} from './career';
import {
  CIRCUIT_INFO,
  MAJOR_PLACES,
  roundNames,
  TOUR_CARD_KEEP,
  WEEKS_PER_SEASON,
} from './circuits';
import { SENDERS, type Message, type Sender } from './story';

/**
 * Milestones: rules over the career state that fire once each, opening doors
 * (wildcards, invitations, cards, Q-School places) and sending you messages.
 * Evaluated after every change by `withStory`.
 */
interface Rule {
  /** Key for this firing (the rule can fire again under a new key, e.g. a second wildcard). */
  key(c: CareerState): string;
  when(c: CareerState): boolean;
  apply(c: CareerState): CareerState;
}

const won = (r: EventResult) => r.round === roundNames(r.field).length;
const fromEnd = (r: EventResult) => roundNames(r.field).length - r.round;
const titles = (c: CareerState, circuit: string) =>
  c.results.filter((r) => r.circuit === circuit && won(r)).length;
const finals = (c: CareerState, circuit: string) =>
  c.results.filter((r) => r.circuit === circuit && fromEnd(r) === 1).length;
const fired = (c: CareerState, prefix: string) =>
  c.milestones.filter((m) => m.startsWith(prefix)).length;
const openOffer = (c: CareerState, circuit: string) =>
  c.inbox.some(
    (m) =>
      m.offer?.state === 'open' &&
      eventById(c, m.offer.eventId)?.circuit === circuit &&
      !eventById(c, m.offer.eventId)?.result,
  ) || c.invites.some((id) => eventById(c, id)?.circuit === circuit && !eventById(c, id)?.result);

/** The next open event on a circuit at least a week away, for an invitation. */
function nextOpen(c: CareerState, circuit: string) {
  return c.calendar.find(
    (e) => e.circuit === circuit && e.kind === 'open' && e.week > c.week && !e.result,
  );
}

export function send(
  c: CareerState,
  from: Sender,
  subject: string,
  body: string,
  offer?: Message['offer'],
): CareerState {
  const msg: Message = {
    id: `m${c.inbox.length + 1}-${c.season}-${c.week}`,
    season: c.season,
    week: c.week,
    from,
    subject,
    body,
    read: false,
    offer,
  };
  return { ...c, inbox: [...c.inbox, msg] };
}

const RULES: Rule[] = [
  {
    key: () => 'first-win',
    when: (c) => c.stats.wins >= 1 && c.tier === 0,
    apply: (c) =>
      send(
        c,
        'landlord',
        'First win on the board',
        `Saw that, ${c.you}! Not bad at all for your first night. Keep turning up on Fridays and people will start to notice.`,
      ),
  },
  {
    key: () => 'first-title',
    when: (c) => c.trophies.length >= 1,
    apply: (c) => {
      const t = c.trophies[0]!;
      return send(
        c,
        'reporter',
        `First title: ${t.name}`,
        t.circuit === 'pub'
          ? `"${c.you} took the ${t.name} this week, and the regulars are already talking." A few lines in the Gazette, and a picture by the board. It's a start.`
          : `"${c.you} won the ${t.name} this week." The first title of what could be quite a career.`,
      );
    },
  },

  // The pub to the county: wildcards, then a card for a good run.
  {
    key: (c) => `county-wildcard-${fired(c, 'county-wildcard-')}`,
    when: (c) => {
      if (c.cards.county || openOffer(c, 'county')) return false;
      const n = fired(c, 'county-wildcard-');
      if (n >= 3 || !nextOpen(c, 'county')) return false;
      const earned = titles(c, 'pub') + finals(c, 'pub') * 0.5;
      return earned >= n + 1 || (n === 0 && c.reputation >= 60);
    },
    apply: (c) => {
      const e = nextOpen(c, 'county')!;
      const first = fired(c, 'county-wildcard-') === 0;
      return send(
        c,
        'secretary',
        first ? 'A wildcard for the county' : 'Another wildcard',
        first
          ? `I was in the Red Lion the other week and you've impressed a few of us. We've a spare place at the ${e.name} in week ${e.week} if you want it. Go deep there (win a match or two) and we'll talk about a County card.`
          : `You're still winning down the pub, so here's another go: a place at the ${e.name} in week ${e.week}. Win a match there and the County card is yours.`,
        { eventId: e.id, state: 'open' },
      );
    },
  },
  {
    key: () => 'county-card',
    when: (c) => !c.cards.county && c.results.some((r) => r.circuit === 'county' && r.round >= 1),
    apply: (c) => grantCard(c, 'county'),
  },
  {
    key: () => 'county-card-msg',
    when: (c) => c.cards.county,
    apply: (c) =>
      send(
        send(
          c,
          'secretary',
          "You've got your County card",
          `Welcome to the county. Every County Open is open to you now, and the top 16 on the merit play the County Championship. Finish high and there's a Q-School place in it.`,
        ),
        'coach',
        'Your ceiling has risen',
        `I'll work with you from here. With proper coaching there's more in your arm: your attributes can now reach ${TIER_CAPS[1]}.`,
      ),
  },

  // The county to the Challenge Tour.
  {
    key: (c) => `challenge-invite-${fired(c, 'challenge-invite-')}`,
    when: (c) => {
      if (!c.cards.county || c.cards.challenge || openOffer(c, 'challenge')) return false;
      const n = fired(c, 'challenge-invite-');
      if (n >= 2 || !nextOpen(c, 'challenge')) return false;
      return titles(c, 'county') >= n + 1 || (n === 0 && c.reputation >= 250);
    },
    apply: (c) => {
      const e = nextOpen(c, 'challenge')!;
      return send(
        c,
        'challenge',
        'Invitation: Challenge Tour',
        `Your county results have been noticed. We'd like to offer you an invitation to the ${e.name} in week ${e.week}. Reach the quarter-finals and you'll earn a Challenge Tour card.`,
        { eventId: e.id, state: 'open' },
      );
    },
  },
  {
    key: () => 'challenge-card',
    when: (c) =>
      !c.cards.challenge && c.results.some((r) => r.circuit === 'challenge' && r.round >= 2),
    apply: (c) => grantCard(c, 'challenge'),
  },
  {
    key: () => 'challenge-card-msg',
    when: (c) => c.cards.challenge,
    apply: (c) =>
      send(
        c,
        'challenge',
        'Welcome to the Challenge Tour',
        `You hold a Challenge Tour card. The top 2 on the Challenge merit each season win Tour Cards, and Q-School is there too. Your attributes can now reach ${TIER_CAPS[2]}.`,
      ),
  },

  // Q-School places: a strong county or Challenge season.
  {
    key: (c) => `qschool-place-${c.season}`,
    when: (c) => {
      if (c.week < 13 || c.qschoolPlace || holdsCard(c, 'tour') || !c.cards.county) return false;
      const pos = (circuit: 'county' | 'challenge') =>
        standings(c, circuit).findIndex((s) => s.id === YOU) + 1;
      const champs = c.results.some(
        (r) => r.season === c.season && r.kind === 'finals' && r.circuit === 'county' && won(r),
      );
      return (
        champs ||
        (c.merit.county[YOU] !== undefined && pos('county') <= 4) ||
        (c.merit.challenge[YOU] !== undefined && pos('challenge') <= 8)
      );
    },
    apply: (c) =>
      send(
        { ...c, qschoolPlace: true },
        'challenge',
        'Your Q-School place',
        `Your season has earned you a free place at Q-School this week. The last four come away with a Tour Card; the quarter-finalists earn a Challenge Tour card.`,
      ),
  },

  // The Pro Tour.
  {
    // Once per card won (a card regained after losing one is a new one).
    key: (c) => `tour-card-${fired(c, 'card-lost-')}`,
    when: (c) => c.cards.tour !== null,
    apply: (c) =>
      send(
        c,
        'tour',
        'Welcome to the Pro Tour',
        `Congratulations on your Tour Card, valid through season ${c.cards.tour}. Every Players Championship is open to you. The top ${MAJOR_PLACES} on the ranking go straight into the majors, and there are qualifiers for the rest. To keep the card, be inside the top ${TOUR_CARD_KEEP} when it runs out. Your attributes can now reach ${TIER_CAPS[3]}.`,
      ),
  },
  {
    key: (c) => {
      const e = c.calendar.find((x) => x.kind === 'major' && !x.result && eligibility(c, x).ok);
      return `major-in-${e?.id ?? 'none'}`;
    },
    when: (c) =>
      holdsCard(c, 'tour') &&
      c.calendar.some((x) => x.kind === 'major' && !x.result && eligibility(c, x).ok),
    apply: (c) => {
      const e = c.calendar.find((x) => x.kind === 'major' && !x.result && eligibility(c, x).ok)!;
      const via = eligibility(c, e);
      return send(
        c,
        'tour',
        `You're in the ${e.name}`,
        via.ok && via.via === 'invite'
          ? `Through the qualifier and onto the stage: you have a place in the ${e.name} in week ${e.week}. ${e.field} players, the TV cameras, and a walk-on.`
          : `Your ranking (${ordinal(tourPosition(c) ?? 0)}) puts you straight into the ${e.name} in week ${e.week}. ${e.field} players, the TV cameras, and a walk-on.`,
      );
    },
  },
  {
    key: (c) => `card-danger-${c.season}`,
    when: (c) =>
      c.cards.tour === c.season && c.week >= 8 && (tourPosition(c) ?? Infinity) > TOUR_CARD_KEEP,
    apply: (c) =>
      send(
        c,
        'tour',
        'Your Tour Card is at risk',
        `Your card runs out at the end of this season and you're ${ordinal(tourPosition(c) ?? 0)} on the ranking. Get inside the top ${TOUR_CARD_KEEP} by week ${WEEKS_PER_SEASON - 1} or it's back to Q-School.`,
      ),
  },
  {
    key: (c) => `card-lost-${c.lastSeason?.season ?? 0}`,
    when: (c) => !!c.lastSeason?.changes.some((x) => x.startsWith('Tour Card lost')),
    apply: (c) =>
      send(
        c,
        'tour',
        'Your Tour Card has expired',
        `You finished outside the top ${TOUR_CARD_KEEP}, so your card has gone. You keep your Challenge Tour card, and Q-School in week ${WEEKS_PER_SEASON} is the way back.`,
      ),
  },
  {
    key: (c) => `season-review-${c.lastSeason?.season ?? 0}`,
    when: (c) => !!c.lastSeason,
    apply: (c) => {
      const s = c.lastSeason!;
      const titles = c.trophies.filter((t) => t.season === s.season).map((t) => t.name);
      const places = s.places
        .map((p) => `${ordinal(p.position)} on the ${CIRCUIT_INFO[p.circuit].name}`)
        .join(', ');
      return send(
        c,
        'reporter',
        `Season ${s.season} in review`,
        [
          places ? `${c.you} finished ${places}.` : `A quiet season for ${c.you}.`,
          titles.length ? `Titles: ${titles.join(', ')}.` : '',
          s.changes.length ? `${s.changes.join('. ')}.` : '',
        ]
          .filter(Boolean)
          .join(' '),
      );
    },
  },
  {
    key: () => 'first-major',
    when: (c) => c.trophies.some((t) => SENDS_MAJOR.has(t.name)),
    apply: (c) =>
      send(
        c,
        'reporter',
        'Major champion',
        `From the Red Lion to a major title. ${c.you} is a name the whole sport knows now.`,
      ),
  },
];

const SENDS_MAJOR = new Set(['Grand Prix', 'Matchplay', 'Masters', 'World Championship']);

/** Run the rules until nothing more fires. */
export function evaluate(c: CareerState): CareerState {
  for (let pass = 0; pass < 8; pass++) {
    let changed = false;
    for (const rule of RULES) {
      const key = rule.key(c);
      if (c.milestones.includes(key) || !rule.when(c)) continue;
      c = { ...rule.apply(c), milestones: [...c.milestones, key] };
      changed = true;
    }
    if (!changed) break;
  }
  return c;
}

/** Apply a career action, then let the story react. */
export const withStory = (c: CareerState, action: (c: CareerState) => CareerState) =>
  evaluate(action(c));

/** Accept or decline an offer in a message. */
export function answerOffer(c: CareerState, messageId: string, accept: boolean): CareerState {
  const msg = c.inbox.find((m) => m.id === messageId);
  if (!msg?.offer || msg.offer.state !== 'open') return c;
  const inbox = c.inbox.map((m) =>
    m.id === messageId
      ? { ...m, read: true, offer: { ...m.offer!, state: accept ? 'accepted' : 'declined' } }
      : m,
  ) as Message[];
  return {
    ...c,
    inbox,
    invites: accept ? [...c.invites, msg.offer.eventId] : c.invites,
  };
}

export const markRead = (c: CareerState, id: string): CareerState => ({
  ...c,
  inbox: c.inbox.map((m) => (m.id === id ? { ...m, read: true } : m)),
});
export const unread = (c: CareerState) => c.inbox.filter((m) => !m.read).length;
export const senderOf = (m: Message) => SENDERS[m.from];
export const circuitName = (id: keyof typeof CIRCUIT_INFO) => CIRCUIT_INFO[id].name;
