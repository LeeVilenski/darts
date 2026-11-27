import {
  holdsCard,
  ordinal,
  PROMOTION_PLACES,
  standings,
  tourPosition,
  YOU,
  type CareerState,
} from './career';
import {
  CIRCUIT_INFO,
  MAJOR_PLACES,
  TOUR_CARD_KEEP,
  WEEKS_PER_SEASON,
  type CircuitId,
} from './circuits';

export interface Goal {
  title: string;
  detail: string;
  /** 0–1, or null when there's nothing to measure. */
  progress: number | null;
  done?: boolean;
}

/** Where you stand on a circuit's order of merit. */
function race(c: CareerState, circuit: CircuitId, places: number) {
  const table = standings(c, circuit);
  const position = table.findIndex((s) => s.id === YOU) + 1;
  const points = c.merit[circuit][YOU] ?? 0;
  const line = table.filter((s) => s.id !== YOU)[places - 1]?.points ?? 0;
  const inPlace = position > 0 && position <= places;
  return { position, points, gap: inPlace ? 0 : Math.max(0, line - points + 1), inPlace };
}

const weeksLeft = (c: CareerState) => WEEKS_PER_SEASON - c.week + 1;

function meritGoal(c: CareerState, circuit: CircuitId, reward: string): Goal {
  const r = race(c, circuit, PROMOTION_PLACES);
  return {
    title: `Top ${PROMOTION_PLACES} on the ${CIRCUIT_INFO[circuit].name}`,
    detail:
      !r.points && c.week <= 1
        ? `The season starts here: ${reward} for the top ${PROMOTION_PLACES}.`
        : r.inPlace
          ? `You're ${ordinal(r.position)}: ${reward} if you hold on. ${weeksLeft(c)} week${weeksLeft(c) === 1 ? '' : 's'} left.`
          : `${ordinal(r.position || standings(c, circuit).length)} with ${r.points} pt${r.points === 1 ? '' : 's'}, ${r.gap} behind ${ordinal(PROMOTION_PLACES)}. Earns ${reward}.`,
    progress: r.inPlace ? 1 : r.points / Math.max(1, r.points + r.gap),
  };
}

/** What you're working towards right now, most important first. */
export function goals(c: CareerState): Goal[] {
  const out: Goal[] = [];
  if (holdsCard(c, 'tour')) {
    const pos = tourPosition(c) ?? 999;
    const expiring = c.cards.tour === c.season;
    out.push({
      title: expiring
        ? `Keep your Tour Card: top ${TOUR_CARD_KEEP} by season's end`
        : `Build your ranking (card valid to season ${c.cards.tour})`,
      detail: `You're ${ordinal(pos)} on the tour ranking.${
        expiring
          ? pos <= TOUR_CARD_KEEP
            ? ' Inside the line: hold on.'
            : ` Outside the line with ${weeksLeft(c)} weeks left.`
          : ` Next season it has to be top ${TOUR_CARD_KEEP} to keep it.`
      }`,
      progress: Math.min(1, TOUR_CARD_KEEP / pos),
    });
    out.push({
      title: `The majors: top ${MAJOR_PLACES} go straight in`,
      detail:
        pos <= MAJOR_PLACES
          ? `You're ${ordinal(pos)}: in the majors automatically.`
          : `You're ${ordinal(pos)}. Reach a qualifier final to get in.`,
      progress: Math.min(1, MAJOR_PLACES / pos),
    });
    return out;
  }
  if (c.cards.challenge) {
    out.push(meritGoal(c, 'challenge', 'a Tour Card'));
    out.push({
      title: 'Q-School (week 13)',
      detail: 'Reach the semi-finals for a Tour Card.',
      progress: null,
    });
    return out;
  }
  if (c.cards.county) {
    out.push(meritGoal(c, 'county', 'a Challenge Tour card'));
    out.push({
      title: 'Q-School (week 13)',
      detail: 'Pay the entry fee and reach the semi-finals for a Tour Card.',
      progress: null,
    });
    return out;
  }
  out.push(meritGoal(c, 'pub', 'a County card'));
  return out;
}
