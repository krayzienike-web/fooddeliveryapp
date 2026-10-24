import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, View, useWindowDimensions, type ScrollViewInstance, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { TAB_BAR_SPACE } from '@/app/navigation/TabBar';
import type { TabParamList } from '@/app/navigation/types';
import { useMenu } from '@/entities/dish/model/store';
import type { CategoryId, Dish } from '@/entities/dish/model/types';
import type { DietMode } from '@/entities/user/model/types';
import { useSession } from '@/features/auth/model/store';
import { fitsDiet } from '@/features/recommendations/model/engine';
import { haptic } from '@/shared/lib/haptics';
import { plural } from '@/shared/lib/format';
import { motion, space, useTheme } from '@/shared/theme';
import { Button, Chip, IconButton, PressableScale, Screen, Sheet, Skeleton, Txt } from '@/shared/ui';
import { DishCard } from '@/widgets/dish-card/DishCard';

const GRID: CategoryId[] = ['pizza', 'burgers', 'desserts', 'wok', 'combo', 'sets', 'breakfast', 'pasta', 'hot'];

type FilterId = 'no_spicy' | 'veg' | 'gluten_free' | 'no_lactose' | 'kids' | 'light' | 'halal';
const FILTERS: Array<{ id: FilterId; label: string; test: (d: Dish) => boolean }> = [
  { id: 'no_spicy', label: 'Без острого', test: (d) => !d.tags.includes('spicy') && d.taste.spicy < 0.5 },
  { id: 'veg', label: 'Вегетарианское', test: (d) => d.tags.includes('veg') || d.tags.includes('vegan') },
  { id: 'gluten_free', label: 'Без глютена', test: (d) => !d.allergens.includes('gluten') },
  { id: 'no_lactose', label: 'Без лактозы', test: (d) => !d.allergens.includes('lactose') },
  { id: 'kids', label: 'Детское', test: (d) => d.tags.includes('kids') },
  { id: 'light', label: 'До 500 ккал', test: (d) => d.nutrition.kcal <= 500 },
  { id: 'halal', label: 'Халяль', test: (d) => d.tags.includes('halal') || d.taste.meat < 0.2 },
];

const DIET_LABEL: Record<DietMode, string> = { none: '', pp: 'Режим ПП', gluten_free: 'Без глютена', halal: 'Халяль', veg: 'Вегетарианец' };

export function MenuScreen() {
  const { c } = useTheme();
  const nav = useNavigation();
  const route = useRoute<RouteProp<TabParamList, 'Menu'>>();
  const { width } = useWindowDimensions();
  const status = useMenu((s) => s.status);
  const categories = useMenu((s) => s.categories);
  const dishes = useMenu((s) => s.dishes);
  const stopList = useMenu((s) => s.stopList);
  const diet = useSession((s) => s.user?.diet ?? 'none');
  const [active, setActive] = useState<CategoryId>('combo');
  const [filters, setFilters] = useState<FilterId[]>([]);
  const [draft, setDraft] = useState<FilterId[]>([]);
  const [sheet, setSheet] = useState(false);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const tabsRef = useRef<ScrollViewInstance>(null);
  const sectionY = useRef<Record<string, number>>({});
  const tabX = useRef<Record<string, { x: number; w: number }>>({});
  const suppressSpy = useRef(false);
  const [indicator, setIndicator] = useState({ x: 0, w: 0 });

  const apply = (list: Dish[], fs: FilterId[]) => list.filter((d) => fitsDiet(d, diet) && fs.every((f) => FILTERS.find((x) => x.id === f)!.test(d)));
  const visible = useMemo(() => apply(dishes, filters), [dishes, filters, diet]); // eslint-disable-line react-hooks/exhaustive-deps
  const draftCount = useMemo(() => apply(dishes, draft).length, [dishes, draft, diet]); // eslint-disable-line react-hooks/exhaustive-deps
  const sections = useMemo(
    () =>
      categories
        .map((cat) => {
          const items = visible.filter((d) => d.categoryId === cat.id);
          // unavailable dishes go last, dimmed — never silently hidden
          return { cat, items: [...items.filter((d) => !stopList.includes(d.id)), ...items.filter((d) => stopList.includes(d.id))] };
        })
        .filter((s) => s.items.length),
    [categories, visible, stopList],
  );

  const scrollTo = (id: CategoryId) => {
    const y = sectionY.current[id];
    if (y === undefined) return;
    suppressSpy.current = true;
    setActive(id);
    haptic.tick();
    scrollRef.current?.scrollTo({ y: Math.max(0, y - 4), animated: true });
    setTimeout(() => (suppressSpy.current = false), 600);
  };

  useEffect(() => {
    const id = route.params?.categoryId as CategoryId | undefined;
    if (id && status === 'ready') setTimeout(() => scrollTo(id), 350);
  }, [route.params?.categoryId, status]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const t = tabX.current[active];
    if (!t) return;
    setIndicator(t);
    tabsRef.current?.scrollTo({ x: Math.max(0, t.x - width / 3), animated: true });
  }, [active, width]);

  const indicatorStyle = useAnimatedStyle(() => ({ transform: [{ translateX: withSpring(indicator.x, motion.springCalm) }], width: withSpring(indicator.w, motion.springCalm) }), [indicator]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (suppressSpy.current) return;
    const y = e.nativeEvent.contentOffset.y + 80;
    let cur: CategoryId = sections[0]?.cat.id ?? 'combo';
    for (const s of sections) if ((sectionY.current[s.cat.id] ?? Infinity) <= y) cur = s.cat.id;
    if (cur !== active) setActive(cur);
  };

  const colW = (width - space.l * 2 - space.m) / 2;

  return (
    <Screen testID="menu-screen">
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.l, paddingTop: space.s, gap: space.s }}>
        <Txt v="displayM" style={{ flex: 1 }}>
          Меню
        </Txt>
        <IconButton testID="menu-search" icon="magnify" label="Поиск" onPress={() => nav.navigate('Search')} />
        <IconButton
          testID="menu-filters"
          icon="tune-variant"
          label="Фильтры"
          badge={filters.length || undefined}
          onPress={() => {
            setDraft(filters);
            setSheet(true);
          }}
        />
      </View>
      {diet !== 'none' ? (
        <Txt v="caption" color="accent" style={{ paddingHorizontal: space.l }}>
          {DIET_LABEL[diet]} — меню перестроено под вас
        </Txt>
      ) : null}

      {/* Sticky category tabs with scroll-spy */}
      <View style={{ borderBottomWidth: 1, borderBottomColor: c.outline }}>
        <ScrollView ref={tabsRef} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.s }}>
          {sections.map((s) => (
            <PressableScale
              key={s.cat.id}
              testID={`menu-tab-${s.cat.id}`}
              onPress={() => scrollTo(s.cat.id)}
              accessibilityState={{ selected: active === s.cat.id }}
              pressedScale={0.95}
              onLayout={(e: LayoutChangeEvent) => {
                tabX.current[s.cat.id] = { x: e.nativeEvent.layout.x + space.m, w: e.nativeEvent.layout.width - space.m * 2 };
                if (s.cat.id === active) setIndicator(tabX.current[s.cat.id]);
              }}
              style={{ height: 48, justifyContent: 'center', paddingHorizontal: space.m }}
            >
              <Txt v="label" color={active === s.cat.id ? 'textPrimary' : 'textSecondary'} style={{ fontSize: 14 }}>
                {s.cat.title}
              </Txt>
            </PressableScale>
          ))}
          <Animated.View style={[{ position: 'absolute', bottom: 0, left: space.s, height: 3, borderRadius: 2, backgroundColor: c.accent }, indicatorStyle]} />
        </ScrollView>
      </View>

      {filters.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: space.l, gap: space.s }}>
          {filters.map((f) => (
            <Chip key={f} small selected icon="close" label={FILTERS.find((x) => x.id === f)!.label} onPress={() => setFilters(filters.filter((x) => x !== f))} />
          ))}
        </ScrollView>
      ) : null}

      <ScrollView ref={scrollRef} onScroll={onScroll} scrollEventThrottle={32} contentContainerStyle={{ paddingBottom: TAB_BAR_SPACE }}>
        {status !== 'ready'
          ? Array.from({ length: 5 }, (_, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: space.m, padding: space.l }}>
                <Skeleton w={104} h={104} r={16} />
                <View style={{ flex: 1, gap: space.s }}>
                  <Skeleton w="70%" />
                  <Skeleton w="90%" h={12} />
                  <Skeleton w="40%" />
                </View>
              </View>
            ))
          : sections.map((s) => (
              <View key={s.cat.id} onLayout={(e) => (sectionY.current[s.cat.id] = e.nativeEvent.layout.y)} testID={`menu-section-${s.cat.id}`}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.s, paddingHorizontal: space.l, paddingTop: space.xxl, paddingBottom: space.m }}>
                  <Txt v="headline">{s.cat.title}</Txt>
                  <Txt v="caption" color="textTertiary">
                    {s.items.length}
                  </Txt>
                </View>
                {GRID.includes(s.cat.id) ? (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.m, paddingHorizontal: space.l }}>
                    {s.items.map((d) => (
                      <DishCard key={d.id} dish={d} width={colW} />
                    ))}
                  </View>
                ) : (
                  s.items.map((d) => <DishCard key={d.id} dish={d} variant="row" />)
                )}
              </View>
            ))}
        {status === 'ready' && !sections.length ? (
          <View style={{ padding: space.xl, gap: space.m, alignItems: 'center' }}>
            <Txt v="titleL">Под эти фильтры ничего нет</Txt>
            <Button kind="tonal" title="Сбросить фильтры" onPress={() => setFilters([])} />
          </View>
        ) : null}
      </ScrollView>

      <Sheet
        open={sheet}
        onClose={() => setSheet(false)}
        title="Фильтры"
        testID="menu-filters-sheet"
        footer={
          <View style={{ flexDirection: 'row', gap: space.m }}>
            <Button kind="ghost" title="Сбросить" onPress={() => setDraft([])} />
            <Button
              testID="menu-filters-primary-cta"
              style={{ flex: 1 }}
              title={`Показать ${draftCount} ${plural(draftCount, 'блюдо', 'блюда', 'блюд')}`}
              onPress={() => {
                setFilters(draft);
                setSheet(false);
              }}
            />
          </View>
        }
      >
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s, paddingHorizontal: space.xl, paddingVertical: space.m }}>
          {FILTERS.map((f) => (
            <Chip key={f.id} testID={`menu-filter-${f.id}`} label={f.label} selected={draft.includes(f.id)} onPress={() => setDraft(draft.includes(f.id) ? draft.filter((x) => x !== f.id) : [...draft, f.id])} />
          ))}
        </View>
      </Sheet>
    </Screen>
  );
}
