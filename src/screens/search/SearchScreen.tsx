import { useNavigation } from '@react-navigation/native';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { useMenu } from '@/entities/dish/model/store';
import { didYouMean, searchDishes } from '@/features/search/model/fuzzy';
import { radius, space, type as typeScale, useTheme } from '@/shared/theme';
import { Button, Chip, Icon, IconButton, Screen, Txt } from '@/shared/ui';
import { DishCard } from '@/widgets/dish-card/DishCard';

const POPULAR = ['Филадельфия', 'Пепперони', 'Том ям', 'Бургер', 'Сырники', 'Острое', 'Веган'];

export function SearchScreen() {
  const { c } = useTheme();
  const nav = useNavigation();
  const dishes = useMenu((s) => s.dishes);
  const categories = useMenu((s) => s.categories);
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [recent, setRecent] = useState<string[]>(['пицца', 'том ям']);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 150);
    return () => clearTimeout(t);
  }, [q]);

  const results = useMemo(() => (debounced.trim().length >= 2 ? searchDishes(dishes, debounced) : []), [dishes, debounced]);
  const hint = useMemo(() => (debounced.trim().length >= 3 && results.length === 0 ? didYouMean(dishes, debounced) : null), [dishes, debounced, results.length]);
  const grouped = useMemo(
    () => categories.map((cat) => ({ cat, items: results.filter((d) => d.categoryId === cat.id) })).filter((g) => g.items.length),
    [categories, results],
  );

  const commit = (v: string) => {
    setQ(v);
    setRecent([v, ...recent.filter((r) => r !== v)].slice(0, 5));
  };

  return (
    <Screen testID="search-screen">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.s, paddingVertical: space.s }}>
        <IconButton testID="search-back" icon="arrow-left" label="Назад" tone="none" onPress={() => nav.goBack()} />
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.s, height: 48, borderRadius: radius.full, backgroundColor: c.surfaceRaised, paddingHorizontal: space.l }}>
          <Icon name="magnify" size={20} color="textTertiary" />
          <TextInput
            testID="search-input"
            autoFocus
            value={q}
            onChangeText={setQ}
            onSubmitEditing={() => q.trim() && commit(q.trim())}
            placeholder="Блюдо, ингредиент или «острое»"
            placeholderTextColor={c.textTertiary}
            returnKeyType="search"
            style={[typeScale.bodyL, { flex: 1, color: c.textPrimary, outlineStyle: 'none' } as object]}
          />
          {q ? <IconButton testID="search-clear" icon="close-circle" label="Очистить" tone="none" size={36} onPress={() => setQ('')} /> : null}
        </View>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 120 }}>
        {debounced.trim().length < 2 ? (
          <View style={{ padding: space.l, gap: space.xl }}>
            {recent.length ? (
              <View style={{ gap: space.s }}>
                <Txt v="label" color="textTertiary" upper>
                  Недавние
                </Txt>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
                  {recent.map((r) => (
                    <Chip key={r} icon="history" label={r} onPress={() => setQ(r)} />
                  ))}
                </View>
              </View>
            ) : null}
            <View style={{ gap: space.s }}>
              <Txt v="label" color="textTertiary" upper>
                Популярное
              </Txt>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s }}>
                {POPULAR.map((p) => (
                  <Chip key={p} testID={`search-popular-${p}`} label={p} onPress={() => commit(p)} />
                ))}
              </View>
            </View>
          </View>
        ) : results.length ? (
          grouped.map((g) => (
            <View key={g.cat.id}>
              <Txt v="label" color="textTertiary" upper style={{ paddingHorizontal: space.l, paddingTop: space.l, paddingBottom: space.xs }}>
                {g.cat.title}
              </Txt>
              {g.items.map((d) => (
                <DishCard key={d.id} dish={d} variant="row" />
              ))}
            </View>
          ))
        ) : (
          <View style={{ padding: space.l, gap: space.l }}>
            <Txt v="titleL">Ничего не нашли по «{debounced}»</Txt>
            {hint ? (
              <Chip testID="search-did-you-mean" icon="auto-fix" label={`Возможно, вы имели в виду «${hint}»`} onPress={() => setQ(hint)} />
            ) : null}
            <Button testID="search-ask-ai" kind="tonal" icon="creation" title="Спросить у Шефа ИИ" onPress={() => nav.navigate('Tabs', { screen: 'Assistant', params: { prompt: debounced } })} />
            <Txt v="label" color="textTertiary" upper>
              Может, это?
            </Txt>
            {dishes
              .slice()
              .sort((a, b) => b.popularity - a.popularity)
              .slice(0, 3)
              .map((d) => (
                <DishCard key={d.id} dish={d} variant="row" />
              ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
