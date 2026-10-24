import type { Reel } from '@/entities/dish/model/types';

/** Videos: Pexels (assets/video/CREDITS.txt). Entries without `video` play as Ken-Burns cinemagraphs. */

export const REELS: Reel[] = [
  { id: 'rv-pizza-pull', dishId: 'pz-margherita', title: 'Сыр тянется до потолка', video: require('../../../assets/video/reel-pizza-pull.mp4'), poster: require('../../../assets/video/reel-pizza-pull.webp'), tagAt: 1.5 },
  { id: 'rv-burger-studio', dishId: 'bg-double-bacon', title: 'Две котлеты, никаких компромиссов', video: require('../../../assets/video/reel-burger-studio.mp4'), poster: require('../../../assets/video/reel-burger-studio.webp'), tagAt: 1 },
  { id: 'rv-wok', dishId: 'wk-teriyaki-chicken', title: '3 минуты в огне вока', video: require('../../../assets/video/reel-wok.mp4'), poster: require('../../../assets/video/reel-wok.webp'), tagAt: 2 },
  { id: 'rv-sushi', dishId: 'set-classic', title: 'Сет «Классика» — режем при вас', video: require('../../../assets/video/reel-sushi.mp4'), poster: require('../../../assets/video/reel-sushi.webp'), tagAt: 1.2 },
  { id: 'rv-cheese-photo', dishId: 'pz-four-cheese', title: 'Четыре сыра в одну корочку', poster: 'reel-cheese', tagAt: 1 },
  { id: 'rv-pizza-cheese', dishId: 'pz-meat', title: 'Мясной жар: собираем начинку', video: require('../../../assets/video/reel-pizza-cheese.mp4'), poster: require('../../../assets/video/reel-pizza-cheese.webp'), tagAt: 2 },
  { id: 'rv-ramen', dishId: 'snd-ramen', title: 'Лапша для рамэна — каждый день свежая', video: require('../../../assets/video/reel-ramen-noodles.mp4'), poster: require('../../../assets/video/reel-ramen-noodles.webp'), tagAt: 2.5 },
  { id: 'rv-burger-hands', dishId: 'bg-zhar', title: 'Чизбургер Жар — сочно с первого укуса', video: require('../../../assets/video/reel-burger-hands.mp4'), poster: require('../../../assets/video/reel-burger-hands.webp'), tagAt: 1 },
  { id: 'rv-sashimi', dishId: 'rl-philadelphia', title: 'Лосось толстым слоем', poster: 'reel-sashimi', tagAt: 0.8 },
  { id: 'rv-cakes', dishId: 'des-lava', title: 'Глазурь стекает — значит готово', video: require('../../../assets/video/reel-cakes.mp4'), poster: require('../../../assets/video/reel-cakes.webp'), tagAt: 2 },
  { id: 'rv-noodle-box', dishId: 'wk-beef-pepper', title: 'Вок в коробочке — ешьте на ходу', video: require('../../../assets/video/reel-noodle-box.mp4'), poster: require('../../../assets/video/reel-noodle-box.webp'), tagAt: 1.5 },
  { id: 'rv-pancakes', dishId: 'br-pancakes', title: 'Кленовый сироп по стопке', poster: 'reel-pancakes', tagAt: 1 },
  { id: 'rv-choco', dishId: 'br-porridge', title: 'Утро с шоколадом и ягодами', video: require('../../../assets/video/reel-choco.mp4'), poster: require('../../../assets/video/reel-choco.webp'), tagAt: 1.5 },
  { id: 'rv-shashlik', dishId: 'hot-shashlik', title: 'Угли, дым и шея на шампуре', poster: 'reel-shashlik', tagAt: 1 },
  { id: 'rv-churros', dishId: 'des-churros', title: 'Чуррос в горячий шоколад', poster: 'reel-churros', tagAt: 1 },
  { id: 'rv-fries', dishId: 'snk-fries', title: 'Двойная обжарка — двойной хруст', poster: 'reel-fries', tagAt: 1 },
  { id: 'rv-latte', dishId: 'drk-latte', title: 'Латте-арт к завтраку', poster: 'reel-latte', tagAt: 1 },
];
