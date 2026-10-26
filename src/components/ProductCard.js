import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../utils/colors';
import { formatMoney } from '../utils/helpers';

export default function ProductCard({ item, onPress, selected = false }) {
  return (
    <TouchableOpacity style={[styles.card, selected && styles.selected]} onPress={onPress}>
      <View style={styles.top}>
        <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
        <View style={styles.totalBadge}>
          <Text style={styles.totalX}>×{item.total}</Text>
          <Text style={styles.totalLabel}>stock</Text>
        </View>
      </View>
      <Text style={styles.code}>Código: {item.code}</Text>
      <View style={styles.row}>
        <View style={[styles.pill, { backgroundColor: '#e7f5ea' }]}>
          <Text style={[styles.pillText, { color: colors.available }]}>Disp {item.disp}</Text>
        </View>
        <View style={[styles.pill, { backgroundColor: '#fdf0dc' }]}>
          <Text style={[styles.pillText, { color: colors.reserved }]}>Res {item.resv}</Text>
        </View>
        <View style={[styles.pill, { backgroundColor: '#e3edf9' }]}>
          <Text style={[styles.pillText, { color: colors.sold }]}>Vend {item.vend}</Text>
        </View>
        <Text style={styles.price}>{formatMoney(item.price)}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
  },
  selected: {
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.accentLight,
  },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  name: { fontSize: 16, fontWeight: '900', color: colors.primaryDark, flex: 1, marginRight: 10 },
  totalBadge: {
    backgroundColor: colors.accentLight,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignItems: 'center',
  },
  totalX: { fontSize: 17, fontWeight: '900', color: colors.primaryDark },
  totalLabel: { fontSize: 10, fontWeight: '700', color: colors.subtext },
  code: { color: colors.subtext, marginTop: 4 },
  row: { flexDirection: 'row', gap: 6, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' },
  pill: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  pillText: { fontWeight: '800', fontSize: 12 },
  price: { fontSize: 15, fontWeight: '900', color: colors.primary, marginLeft: 'auto' },
});
