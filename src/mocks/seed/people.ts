import type { Chef, Courier } from '@/entities/order/model/types';

export const CHEFS: Chef[] = [
  { id: 'ch-artem', name: 'Артём', rating: 4.9, avatar: 'АР', specialty: 'Пицца и гриль' },
  { id: 'ch-aigul', name: 'Айгуль', rating: 4.9, avatar: 'АЙ', specialty: 'Роллы и поке' },
  { id: 'ch-dmitry', name: 'Дмитрий', rating: 4.8, avatar: 'ДМ', specialty: 'Вок и супы' },
  { id: 'ch-olga', name: 'Ольга', rating: 5.0, avatar: 'ОЛ', specialty: 'Десерты' },
  { id: 'ch-timur', name: 'Тимур', rating: 4.8, avatar: 'ТИ', specialty: 'Бургеры' },
];

export const COURIERS: Courier[] = [
  { id: 'cr-ivan', name: 'Иван', rating: 4.9, vehicle: 'bike', avatar: 'ИВ', maskedPhone: '+7 (812) 407-00-00, доб. 1842' },
  { id: 'cr-sardor', name: 'Сардор', rating: 4.95, vehicle: 'scooter', avatar: 'СА', maskedPhone: '+7 (812) 407-00-00, доб. 2219' },
  { id: 'cr-maria', name: 'Мария', rating: 4.9, vehicle: 'bike', avatar: 'МА', maskedPhone: '+7 (812) 407-00-00, доб. 3301' },
  { id: 'cr-kirill', name: 'Кирилл', rating: 4.8, vehicle: 'car', avatar: 'КИ', maskedPhone: '+7 (812) 407-00-00, доб. 4410' },
];

export const REVIEW_AUTHORS = ['Анна К.', 'Михаил', 'Света', 'Дмитрий П.', 'Катя', 'Олег', 'Наташа', 'Игорь', 'Алина', 'Сергей В.', 'Юля', 'Павел', 'Ника', 'Рустам', 'Лена М.', 'Гоша'];
