import { balance, type CareerState } from '../../engine/career/career';
import { owns, priceOf, type KitItem } from '../../engine/career/kit';
import { KIT_PATTERNS } from '../../engine/career/story';
import { SHIRTS } from '../../game/scene/appearance';
import { useCareer } from '../../store/useCareer';

const money = (n: number) => `£${n.toLocaleString('en-GB')}`;

/** Spend your winnings on a shirt and a pattern; worn at the oche in every match. */
export function KitShop({ c }: { c: CareerState }) {
  const buy = useCareer((s) => s.buy);
  const plain = useCareer((s) => s.plainKit);
  const bank = balance(c);
  const label = (item: KitItem) =>
    owns(c, item)
      ? 'Owned'
      : bank >= priceOf(item)
        ? money(priceOf(item))
        : `${money(priceOf(item))} 🔒`;
  return (
    <div className="hub-card kit" data-testid="kit">
      <div className="attrs-head">
        <div>
          <div className="eyebrow">Kit</div>
          <span className="muted small">
            {money(bank)} to spend. Your shirt shows at the oche and in replays.
          </span>
        </div>
        {(c.kit.shirt !== null || c.kit.pattern) && (
          <button type="button" className="ghost-btn small" onClick={plain}>
            Plain
          </button>
        )}
      </div>
      <div className="swatches" role="group" aria-label="Shirts">
        {SHIRTS.map(([shirt, trim], index) => {
          const item: KitItem = { kind: 'shirt', index };
          const on = c.kit.shirt === index;
          const can = owns(c, item) || bank >= priceOf(item);
          return (
            <button
              key={index}
              type="button"
              className={`swatch ${on ? 'on' : ''}`}
              style={{ background: shirt, borderColor: trim }}
              disabled={!can}
              onClick={() => buy(item)}
              aria-label={`Shirt ${index + 1}: ${on ? 'wearing' : label(item)}`}
              title={label(item)}
            >
              {owns(c, item) ? '' : <span className="price">{priceOf(item)}</span>}
            </button>
          );
        })}
      </div>
      <div className="pattern-row" role="group" aria-label="Patterns">
        {KIT_PATTERNS.map((pattern) => {
          const item: KitItem = { kind: 'pattern', pattern };
          const on = c.kit.pattern === pattern;
          const can = owns(c, item) || bank >= priceOf(item);
          return (
            <button
              key={pattern}
              type="button"
              className={`chip ${on ? 'gold' : ''}`}
              disabled={!can}
              onClick={() => buy(item)}
            >
              {pattern} · {on ? 'wearing' : label(item)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
