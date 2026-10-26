import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { showAlert } from '../utils/alerts';
import { useFocusEffect } from '@react-navigation/native';
import { getSalesHistory } from '../db/database';
import { theme } from '../utils/theme';
import { colors } from '../utils/colors';
import { formatMoney } from '../utils/helpers';

export default function HistorialScreen() {
  const [hist, setHist] = useState([]);

  const load = useCallback(async () => {
    try {
      const h = await getSalesHistory();
      setHist(h);
    } catch (error) {
      showAlert('Error', `No se pudo cargar el historial: ${error.message}`);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  return (
    <View style={theme.container}>
      <Text style={theme.header}>Historial de ventas</Text>
      <FlatList data={hist} keyExtractor={i => i.id} renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={styles.top}>
            <Text style={styles.name}>{item.product_name}</Text>
            <Text style={styles.price}>{formatMoney(item.price)}</Text>
          </View>
          <Text style={styles.sub}>Código: {item.product_code}</Text>
          <Text style={styles.sub}>Cliente: {item.client_name || '-'}</Text>
          <Text style={styles.date}>{new Date(item.sold_at).toLocaleString()}</Text>
        </View>
      )} ListEmptyComponent={<Text style={styles.empty}>Sin ventas</Text>} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: colors.border, marginBottom: 8 },
  top: { flexDirection: 'row', justifyContent: 'space-between' },
  name: { fontWeight: '900', color: colors.primaryDark, flex: 1, marginRight: 10 },
  price: { fontWeight: '900', color: colors.sold },
  sub: { color: colors.subtext },
  date: { color: colors.subtext, marginTop: 4, fontSize: 12 },
  empty: { textAlign: 'center', color: colors.subtext, marginTop: 20 },
});
