import type { BillItem, SplitMode } from '@/entities/table/model/types';

/** Bill splitting at the table (C17). Pure. */

export const TIP_OPTIONS = [0, 5, 10, 15];

export interface BillSplit {
  /** What this guest pays for food. */
  subtotal: number;
  tips: number;
  total: number;
  /** Whole table, for reference. */
  tableTotal: number;
}

export const itemsTotal = (items: BillItem[]) => items.reduce((s, i) => s + i.price * i.qty, 0);

export function splitBill(items: BillItem[], opts: { mode: SplitMode; people: number; mine: string[]; tipsPercent: number }): BillSplit {
  const tableTotal = itemsTotal(items);
  const people = Math.max(1, Math.floor(opts.people));
  const subtotal =
    opts.mode === 'all' ? tableTotal : opts.mode === 'equal' ? Math.ceil(tableTotal / people) : itemsTotal(items.filter((i) => opts.mine.includes(i.id)));
  const tips = Math.round((subtotal * Math.max(0, opts.tipsPercent)) / 100);
  return { subtotal, tips, total: subtotal + tips, tableTotal };
}
