import type { OrderStatus } from '@/entities/order/model/types';
import type { IconName } from '@/shared/ui';

export function statusIcon(s: OrderStatus): IconName {
  switch (s) {
    case 'created':
    case 'accepted':
      return 'receipt-text-check-outline';
    case 'cooking':
      return 'fire';
    case 'packing':
      return 'package-variant-closed';
    case 'courier_assigned':
      return 'account-check-outline';
    case 'on_the_way':
      return 'bike-fast';
    case 'arriving':
      return 'map-marker-radius';
    case 'delivered':
    case 'picked_up':
      return 'check-decagram';
    case 'ready_for_pickup':
      return 'shopping-outline';
    case 'cancelled':
      return 'close-circle-outline';
  }
}
