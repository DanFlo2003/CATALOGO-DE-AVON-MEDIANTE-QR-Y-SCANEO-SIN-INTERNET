import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../utils/colors';
import { formatMoney } from '../utils/helpers';

export default function ProductCard({ item, onPress, selected = false }) {
  return (
    <TouchableOpacity style={[styles.card, selected && styles.selected]} onPress={onPress}>
      <View style={styles.top}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.price}>{formatMoney(item.price)}</Text>
      </View>
      <Text style={styles.code}>Código: {item.code}</Text>
      <View style={styles.row}>
        <Text style={[styles.pill, { color: colors.available }]}>Disp: {item.disp}</Text>
        <Text style={[styles.pill, { color: colors.reserved }]}>Res: {item.resv}</Text>
        <Text style={[styles.pill, { color: colors.sold }]}>Vend: {item.vend}</Text>
        <Text style={styles.pill}>Total: {item.total}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor:'#fff',
    borderRadius:16,
    padding:14,
    borderWidth:1,
    borderColor:colors.border,
    marginBottom:10,
  },
  selected: {
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.accentLight,
  },
  top: { flexDirection:'row', justifyContent:'space-between', alignItems:'center' },
  name: { fontSize:16, fontWeight:'900', color:colors.primaryDark, flex:1, marginRight:10 },
  price: { fontSize:16, fontWeight:'900', color:colors.primary },
  code: { color:colors.subtext, marginTop:4 },
  row: { flexDirection:'row', gap:10, marginTop:8 },
  pill: { fontWeight:'800' },
});
