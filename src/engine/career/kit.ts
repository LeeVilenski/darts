import { balance, type CareerState } from './career';
import { KIT_PRICES, type KitPattern } from './story';

export type KitItem = { kind: 'shirt'; index: number } | { kind: 'pattern'; pattern: KitPattern };

const keyOf = (i: KitItem) => (i.kind === 'shirt' ? `shirt:${i.index}` : `pattern:${i.pattern}`);
export const owns = (c: CareerState, i: KitItem) => c.kit.owned.includes(keyOf(i));
export const priceOf = (i: KitItem) => KIT_PRICES[i.kind];

/** Buy an item (if you can afford it) and wear it. */
export function buyKit(c: CareerState, item: KitItem): CareerState {
  if (owns(c, item)) return wearKit(c, item);
  if (balance(c) < priceOf(item)) return c;
  return wearKit(
    {
      ...c,
      spent: c.spent + priceOf(item),
      kit: { ...c.kit, owned: [...c.kit.owned, keyOf(item)] },
    },
    item,
  );
}

/** Wear an item you own. */
export function wearKit(c: CareerState, item: KitItem): CareerState {
  if (!owns(c, item)) return c;
  return {
    ...c,
    kit:
      item.kind === 'shirt' ? { ...c.kit, shirt: item.index } : { ...c.kit, pattern: item.pattern },
  };
}

/** Back to the shirt you started in. */
export const plainKit = (c: CareerState): CareerState => ({
  ...c,
  kit: { ...c.kit, shirt: null, pattern: null },
});
