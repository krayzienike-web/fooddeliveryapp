import type { IconName } from '@/shared/ui';

/** Achievements (C13). Unlocked ids live on User.achievements; the rules are evaluated server-side. */
export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: IconName;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-order', title: 'Первый заказ', description: 'Сделать первый заказ в ЖАР', icon: 'fire' },
  { id: 'pizza-lover', title: 'Пиццеман', description: 'Заказать 10 пицц', icon: 'pizza' },
  { id: 'night-owl', title: 'Ночная сова', description: 'Заказ после 23:00', icon: 'owl' },
  { id: 'soup-season', title: 'Суповой сезон', description: '5 супов за осень', icon: 'pot-steam-outline' },
  { id: 'explorer', title: 'Гурман', description: 'Блюда из 10 разных категорий', icon: 'compass-outline' },
  { id: 'streak-4', title: '4 недели подряд', description: 'Хотя бы один заказ каждую неделю месяц', icon: 'calendar-check-outline' },
  { id: 'critic', title: 'Критик', description: '5 отзывов с фото', icon: 'camera-outline' },
  { id: 'party', title: 'Душа компании', description: 'Собрать групповой заказ', icon: 'account-group-outline' },
];
