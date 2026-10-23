import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { colors } from '../utils/colors';

export default function UnitRow({ unit, onChange }) {
  const [client, setClient] = useState(unit.client_name || '');
  const stateColor = unit.state === 'disponible' ? colors.available : unit.state === 'reservado' ? colors.reserved : colors.sold;

  useEffect(() => {
    setClient(unit.client_name || '');
  }, [unit.client_name, unit.state]);

  const act = async (state) => {
    const clientName = state === 'reservado' || unit.state === 'reservado' ? client.trim() || null : null;
    await onChange(unit.id, state, clientName);
  };

  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.id}>Unidad</Text>
        <Text style={[styles.state, { color: stateColor }]}>{unit.state.toUpperCase()}</Text>
        {unit.state === 'reservado' && <Text style={styles.client}>Cliente: {unit.client_name || '-'}</Text>}
      </View>
      {(unit.state === 'disponible' || unit.state === 'reservado') && (
        <View style={styles.controls}>
          <TextInput
            style={styles.input}
            placeholder="Nombre cliente (opcional)"
            value={client}
            onChangeText={setClient}
          />
          <View style={[styles.actions, { marginTop: 6 }]}>
            {unit.state === 'disponible' ? (
              <TouchableOpacity style={[styles.btn, { backgroundColor: colors.reserved }]} onPress={() => act('reservado')}>
                <Text style={styles.btnText}>Reservar</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={[styles.btn, { backgroundColor: colors.available }]} onPress={() => act('disponible')}>
                <Text style={styles.btnText}>Liberar</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.btn, { backgroundColor: colors.sold }]} onPress={() => act('vendido')}>
              <Text style={styles.btnText}>Vender</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      {unit.state === 'vendido' && (
        <TouchableOpacity style={[styles.btn, { backgroundColor: colors.available }]} onPress={() => act('disponible')}>
          <Text style={styles.btnText}>Pasar a disponible</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 8,
    flexWrap: 'wrap',
    flexDirection: 'row',
    alignItems: 'center',
  },
  id: { color: colors.subtext, fontWeight: '700' },
  state: { fontWeight: '900', marginTop: 2 },
  client: { color: colors.subtext, marginTop: 2 },
  controls: { width: '100%', marginTop: 8 },
  actions: { flexDirection: 'row', gap: 8 },
  btn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  btnText: { color: '#fff', fontWeight: '800' },
  input: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
});
