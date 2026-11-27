import { eventById, type CareerState } from '../../engine/career/career';
import { senderOf } from '../../engine/career/milestones';
import { repBand, type Message } from '../../engine/career/story';
import { useCareer } from '../../store/useCareer';

/** Your messages, newest first, with offers to accept or decline. */
export function InboxTab({ c }: { c: CareerState }) {
  const msgs = [...c.inbox].reverse();
  if (!msgs.length)
    return <p className="muted">Nothing yet. Win a few matches and people will start to notice.</p>;
  return (
    <div className="inbox" data-testid="inbox">
      {msgs.map((m) => (
        <MessageCard key={m.id} c={c} m={m} />
      ))}
    </div>
  );
}

export function MessageCard({ c, m, compact }: { c: CareerState; m: Message; compact?: boolean }) {
  const answer = useCareer((s) => s.answer);
  const read = useCareer((s) => s.read);
  const choose = useCareer((s) => s.choose);
  const who = senderOf(m);
  const offer = m.offer;
  const event = offer ? eventById(c, offer.eventId) : null;
  const expired = !!event?.result || (event && event.week < c.week);
  return (
    <article
      className={`hub-card message ${m.read ? 'read' : 'unread'}`}
      onClick={() => !m.read && !offer && !m.choice && read(m.id)}
      data-testid="message"
    >
      <header>
        <span className="msg-from">
          <b>{who.name}</b> <span className="muted small">· {who.role}</span>
        </span>
        <span className="muted small">
          S{m.season} W{m.week}
        </span>
      </header>
      <b className="msg-subject">
        {!m.read && <span className="dot" aria-label="Unread" />}
        {m.subject}
      </b>
      {!compact && <p>{m.body}</p>}
      {offer && offer.state === 'open' && !expired && (
        <div className="msg-actions">
          <button
            type="button"
            className="primary-btn small"
            onClick={() => answer(m.id, true)}
            data-testid="accept-offer"
          >
            Accept
          </button>
          <button type="button" className="ghost-btn small" onClick={() => answer(m.id, false)}>
            Decline
          </button>
        </div>
      )}
      {offer && offer.state !== 'open' && (
        <span className={`chip ${offer.state === 'accepted' ? 'gold' : ''}`}>
          {offer.state === 'accepted'
            ? `Accepted: ${event?.name}, week ${event?.week}`
            : 'Declined'}
        </span>
      )}
      {offer && offer.state === 'open' && expired && <span className="chip">Expired</span>}
      {m.choice &&
        (m.choice.picked ? (
          <span className="chip gold">You chose “{m.choice.picked}”</span>
        ) : (
          <div className="msg-actions wrap">
            {m.choice.options.map((o) => (
              <button
                key={o}
                type="button"
                className="primary-btn small"
                onClick={() => choose(m.id, o)}
                data-testid="choose-option"
              >
                {o}
              </button>
            ))}
          </div>
        ))}
    </article>
  );
}

/** Reputation and its band, for the profile. */
export function Reputation({ c }: { c: CareerState }) {
  const band = repBand(c.reputation);
  const progress = band.next ? (c.reputation - band.floor) / (band.next - band.floor) : 1;
  return (
    <div className="hub-card rep" data-testid="reputation">
      <div className="attrs-head">
        <div>
          <div className="eyebrow">Reputation</div>
          <b>{band.name}</b>
        </div>
        <span className="attr-val">{c.reputation}</span>
      </div>
      <div className="progress thin" aria-hidden="true">
        <span style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>
      <span className="muted small">
        {band.next
          ? `${band.next - c.reputation} to the next band. Wins, titles, upsets, 180s and big finishes all count.`
          : 'As famous as darts gets.'}
      </span>
    </div>
  );
}
