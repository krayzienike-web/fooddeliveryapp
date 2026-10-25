/** «За столом» (C17): a dine-in session opened by scanning the QR code on the table. */
export interface BillItem {
  id: string;
  dishId: string;
  name: string;
  price: number;
  qty: number;
  status: 'cooking' | 'served';
}

export interface TableSession {
  id: string;
  restaurantId: string;
  tableLabel: string;
  waiter: string;
  items: BillItem[];
  openedAt: number;
  paid: boolean;
}

export type SplitMode = 'all' | 'equal' | 'items';

/** Gift certificate (C18). */
export interface Gift {
  id: string;
  amount: number;
  design: 'fire' | 'party' | 'thanks';
  recipientName: string;
  recipientPhone: string;
  message: string;
  sendAt: string;
  code: string;
  createdAt: number;
}
