import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useApp } from '../context/AppContext';
import { theme } from '../utils/theme';
import { colors } from '../utils/colors';
import CampaignSelector from '../components/CampaignSelector';
import MetricCard from '../components/MetricCard';

export default function InicioScreen() {
  const { active, metrics } = useApp();
  return (
    <ScrollView style={theme.container} contentContainerStyle={{ paddingBottom:20 }}>
      <Text style={theme.header}>Inicio</Text>
      <CampaignSelector />
      <Text style={[styles.sub, { marginBottom:10 }]}>Métricas - {active?.name || ''}</Text>
      <View style={styles.row}>
        <MetricCard title="DISPONIBLES" count={metrics.disponible} type="disponible" />
        <MetricCard title="RESERVADOS" count={metrics.reservado} type="reservado" />
        <MetricCard title="VENDIDOS" count={metrics.vendido} type="vendido" />
      </View>
      <View style={[theme.card, { marginTop:14 }]}>
        <Text style={styles.infoTitle}>Atajos</Text>
        <Text style={styles.infoText}>Usa la pestaña Escáner para agregar o cambiar estado de unidades.</Text>
        <Text style={styles.infoText}>Lista de productos filtra por estado.</Text>
        <Text style={styles.infoText}>Historial muestra todas las ventas de la campaña.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sub: { fontSize:16, fontWeight:'800', color:colors.primaryDark },
  row: { flexDirection:'row', gap:10 },
  infoTitle: { fontSize:16, fontWeight:'900', color:colors.primaryDark },
  infoText: { color:colors.subtext, marginTop:4 },
});
