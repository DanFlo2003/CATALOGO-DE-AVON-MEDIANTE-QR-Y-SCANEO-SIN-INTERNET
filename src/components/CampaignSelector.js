import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, TextInput, StyleSheet, Alert } from 'react-native';
import { useApp } from '../context/AppContext';
import { colors } from '../utils/colors';
import { theme } from '../utils/theme';

export default function CampaignSelector() {
  const { campaigns, active, changeActive, addCampaign } = useApp();
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState('');

  const create = async () => {
    if (!newName.trim()) return;
    try {
      await addCampaign(newName.trim());
      setNewName('');
      setOpen(false);
    } catch (error) {
      Alert.alert('Error', `No se pudo crear la campaña: ${error.message}`);
    }
  };

  return (
    <View>
      <TouchableOpacity style={[theme.card, styles.sel]} onPress={() => setOpen(true)}>
        <Text style={styles.label}>Campaña activa</Text>
        <Text style={styles.name}>{active?.name || 'Sin campaña'}</Text>
        <Text style={styles.hint}>Tocar para cambiar / crear</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Seleccionar campaña</Text>
            {campaigns.map(c => (
              <TouchableOpacity key={c.id} style={styles.item} onPress={async () => {
                try {
                  await changeActive(c.id);
                  setOpen(false);
                } catch (error) {
                  Alert.alert('Error', `No se pudo cambiar la campaña: ${error.message}`);
                }
              }}>
                <Text style={styles.itemText}>{c.name} {c.active ? '(activa)' : ''}</Text>
              </TouchableOpacity>
            ))}
            <Text style={[styles.modalTitle, { marginTop: 12 }]}>Nueva campaña</Text>
            <TextInput style={theme.input} placeholder="Nombre de campaña" value={newName} onChangeText={setNewName} />
            <TouchableOpacity style={[theme.bigBtn, { marginTop: 10 }]} onPress={create}>
              <Text style={theme.bigBtnText}>Crear campaña</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[theme.bigBtn, { marginTop: 8, backgroundColor: '#9c9c9c' }]} onPress={() => setOpen(false)}>
              <Text style={theme.bigBtnText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  sel: { marginBottom: 12 },
  label: { color: colors.subtext, fontWeight: '700' },
  name: { fontSize: 18, fontWeight: '900', color: colors.primaryDark, marginTop: 2 },
  hint: { color: colors.subtext, marginTop: 2 },
  backdrop: { flex:1, backgroundColor:'rgba(47,31,42,0.4)', justifyContent:'center', padding:16 },
  modal: { backgroundColor:'#fff', borderRadius:18, padding:16 },
  modalTitle: { fontSize:16, fontWeight:'900', color:colors.primaryDark, marginBottom:10 },
  item: { paddingVertical:12, borderBottomWidth:1, borderBottomColor:colors.border },
  itemText: { fontSize:16, fontWeight:'700', color:colors.text },
});
