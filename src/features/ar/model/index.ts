import { buildBurger } from './burger';
import { buildCheesecake } from './cheesecake';
import type { DishModel } from './kit';
import { buildPizza } from './pizza';
import { buildPoke } from './poke';
import { buildRolls } from './rolls';

export type ArKind = 'burger' | 'pizza' | 'rolls' | 'poke' | 'cheesecake';

export const AR_KINDS: ArKind[] = ['burger', 'pizza', 'rolls', 'poke', 'cheesecake'];

/** Builds a dish at real scale (1 unit = 1 cm). Deterministic: same kind and size → same model. */
export function buildDish(kind: ArKind, opts: { sizeCm?: number } = {}): DishModel {
  switch (kind) {
    case 'pizza':
      return buildPizza(opts.sizeCm ?? 35);
    case 'rolls':
      return buildRolls();
    case 'poke':
      return buildPoke();
    case 'cheesecake':
      return buildCheesecake();
    case 'burger':
      return buildBurger();
  }
}

export type { DishModel, Part } from './kit';
