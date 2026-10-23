import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Modal, ScrollView, StyleSheet, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { getProductsList, getUnitsByProduct, updateUnitState } from '../db/database';
import { theme } from '../utils/theme';
import { colors } from '../utils/colors';
import ProductCard from '../components/ProductCard';
import UnitRow from '../components/UnitRow';

export default function ListaProductosScreen() {
  const { active, refresh } = useApp();
  const [filter, setFilter] = useState('all');
  const [list, setList] = useState([]);
  const [sel, setSel] = useState(null);
  const [units, setUnits] = useState([]);

  const load = useCallback(async () => {
    if (!active) {
      setList([]);
      return;
    }
    try {
      const l = await getProductsList(active.id, filter);
      setList(l);
    } catch (error) {
      Alert.alert('Error', `No se pudo cargar la lista: ${error.message}`);
    }
  }, [active, filter]);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  const open = async (item) => {
    try {
      const u = await getUnitsByProduct(item.id);
      setUnits(u);
      setSel(item);
    } catch (error) {
      Alert.alert('Error', `No se pudieron cargar las unidades: ${error.message}`);
    }
  };

  const change = async (unit_id, state, client_name) => {
    if (!active || !sel) return;
    try {
      await updateUnitState({ unit_id, state, client_name, campaign_id: active.id });
      const u = await getUnitsByProduct(sel.id);
      setUnits(u);
      await load();
      await refresh();
    } catch (error) {
      Alert.alert('Error', `No se pudo actualizar la unidad: ${error.message}`);
    }
  };

  return (
    <View style={theme.container}>
      <Text style={theme.header}>Lista de productos</Text>
      <View style={styles.filters}>
        {['all','disponible','reservado','vendido'].map(f => (
          <TouchableOpacity key={f} style={[styles.fbtn, filter===f && styles.fbtnActive]} onPress={() => setFilter(f)}>
            <Text style={[styles.ftext, filter===f && { color:'#fff' }]}>{f.toUpperCase()}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <FlatList data={list} keyExtractor={i=>i.id} renderItem={({item}) => <ProductCard item={item} onPress={() => open(item)} />} ListEmptyComponent={<Text style={styles.empty}>Sin productos</Text>} />

      <Modal visible={!!sel} animationType="slide" onRequestClose={() => setSel(null)}>
        <View style={theme.container}>
          <Text style={theme.header}>{sel?.name}</Text>
          <Text style={styles.code}>Código: {sel?.code} | Precio: ${Number(sel?.price||0).toFixed(2)}</Text>
          <ScrollView style={{ marginTop:10 }}>
            {units.map(u => <UnitRow key={u.id} unit={u} onChange={change} />)}
          </ScrollView>
          <TouchableOpacity style={[theme.bigBtn, { marginTop:10 }]} onPress={() => setSel(null)}>
            <Text style={theme.bigBtnText}>Cerrar</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  filters: { flexDirection:'row', gap:6, marginBottom:10, flexWrap:'wrap' },
  fbtn: { paddingHorizontal:10, paddingVertical:8, borderRadius:10, backgroundColor:'#fff', borderWidth:1, borderColor:colors.border },
  fbtnActive: { backgroundColor:colors.primary, borderColor:colors.primary },
  ftext: { fontWeight:'800', color:colors.subtext },
  empty: { textAlign:'center', color:colors.subtext, marginTop:20 },
  code: { color:colors.subtext },
});
