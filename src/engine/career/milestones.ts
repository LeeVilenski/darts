import { TIER_CAPS } from './attributes';
import {
  eventById,
  grantCard,
  holdsCard,
  standings,
  YOU,
  type CareerState,
  type EventResult,
} from './career';
import { CIRCUIT_INFO, roundNames } from './circuits';
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
    when: (c) => c.stats.wins >= 1,
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
        `Local winner: ${t.name}`,
        `"${c.you} took the ${t.name} this week, and the regulars are already talking." A few lines in the Gazette, and a picture by the board. It's a start.`,
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
];

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
