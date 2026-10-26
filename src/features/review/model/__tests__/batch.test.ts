import { batchParts, formatItem, MAX_NOTE, type ReviewDraft } from '../batch';

const d = (id: string, anchor: string, text: string, extra: Partial<ReviewDraft> = {}): ReviewDraft => ({
  id,
  anchor,
  route: anchor.split(/[(›]/)[0].trim(),
  label: '',
  kind: 'change',
  text,
  createdAt: Number(id.replace(/\D/g, '')) || 0,
  ...extra,
});

const bytes = (s: string) => new TextEncoder().encode(s).length;

describe('review batch', () => {
  it('formats an item with kind, anchor, what the reviewer saw and an indented note', () => {
    const s = formatItem(d('1', 'Dish(bg-zhar) › dish-add', 'Кнопка мелкая\nи сливается', { kind: 'bug', label: 'Блюдо · В корзину' }), 3);
    expect(s).toBe('3. [Баг] Dish(bg-zhar) › dish-add — «Блюдо · В корзину»\n   Кнопка мелкая\n   и сливается');
  });

  it('omits the label when it only repeats the screen title', () => {
    expect(formatItem(d('1', 'Home › screen', 'Пусто', { label: 'Главная' }), 1)).toBe('1. [Правка] Home › screen\n   Пусто');
  });

  it('groups notes by screen in order of first note and numbers them through', () => {
    const [p] = batchParts([d('1', 'Home › a', 'один'), d('2', 'Cart › b', 'два'), d('3', 'Home › c', 'три')]);
    expect(p.text).toMatch(/^Пачка правок из ревью демо ЖАР: 3 шт\. Возьми в работу\./);
    expect(p.text.indexOf('1. [Правка] Home › a')).toBeLessThan(p.text.indexOf('2. [Правка] Home › c'));
    expect(p.text).toContain('3. [Правка] Cart › b');
    expect(p.ids).toEqual(['1', '3', '2']);
  });

  it('splits into parts under 4 KiB, every draft in exactly one part', () => {
    const drafts = Array.from({ length: 12 }, (_, i) => d(`${i + 1}`, `Menu › menu-item-${i}`, 'Ж'.repeat(MAX_NOTE)));
    const parts = batchParts(drafts);
    expect(parts.length).toBeGreaterThan(1);
    for (const p of parts) expect(bytes(p.text)).toBeLessThanOrEqual(4096);
    expect(parts.flatMap((p) => p.ids).sort()).toEqual(drafts.map((x) => x.id).sort());
    expect(parts[0].text).toContain(`Часть 1/${parts.length}`);
    expect(parts[parts.length - 1].text).toContain(`12. [Правка]`);
  });

  it('caps an overlong note', () => {
    const [p] = batchParts([d('1', 'Home › a', 'x'.repeat(5000))]);
    expect(p.text.length).toBeLessThan(MAX_NOTE + 300);
  });

  it('returns nothing for an empty batch', () => {
    expect(batchParts([])).toEqual([]);
  });
});
