import { View } from 'react-native';
import { rub } from '@/shared/lib/format';
import { space } from '@/shared/theme';
import { Txt } from './Txt';

/** Prices are never painted in accent (guidebook §1.3). Old price — tertiary, struck through. */
export function Price({ value, old, size = 'm', testID }: { value: number; old?: number; size?: 'm' | 'l'; testID?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.s }}>
      <Txt testID={testID} v={size === 'l' ? 'priceL' : 'priceM'}>
        {rub(value)}
      </Txt>
      {old && old > value ? (
        <Txt v="caption" color="textTertiary" style={{ textDecorationLine: 'line-through' }} tabular>
          {rub(old)}
        </Txt>
      ) : null}
    </View>
  );
}
