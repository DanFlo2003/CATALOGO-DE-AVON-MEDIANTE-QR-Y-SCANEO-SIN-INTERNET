import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../utils/colors';

export default function MetricCard({ title, count, type }) {
  const c = type === 'disponible' ? colors.available : type === 'reservado' ? colors.reserved : colors.sold;
  return (
    <View style={[styles.card, { borderColor: c }]}>
      <Text style={styles.title}>{title}</Text>
      <Text style={[styles.count, { color: c }]}>{count}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 2,
    alignItems: 'center',
  },
  title: {
    color: '#6f5a6a',
    fontWeight: '800',
  },
  count: {
    fontSize: 28,
    fontWeight: '900',
    marginTop: 4,
  },
});
