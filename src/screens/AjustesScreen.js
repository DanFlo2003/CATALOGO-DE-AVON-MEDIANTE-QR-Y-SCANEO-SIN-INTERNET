import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { showAlert, showConfirm } from '../utils/alerts';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { exportAll, importAll, validateBackup } from '../db/database';
import { useApp } from '../context/AppContext';
import PinScreen from './PinScreen';
import { theme } from '../utils/theme';
import { colors } from '../utils/colors';

export default function AjustesScreen() {
  const { refresh } = useApp();
  const [showPin, setShowPin] = useState(false);

  const backup = async () => {
    try {
      const data = await exportAll();
      const json = JSON.stringify(data, null, 2);
      const name = `avon_respaldo_${Date.now()}.json`;
      const path = FileSystem.documentDirectory + name;
      await FileSystem.writeAsStringAsync(path, json, { encoding: FileSystem.EncodingType.UTF8 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, { mimeType: 'application/json', dialogTitle: 'Compartir respaldo' });
      } else {
        showAlert('Listo', 'Archivo guardado: ' + path);
      }
    } catch (e) {
      showAlert('Error', e.message);
    }
  };

  const restore = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true });
      if (res.canceled) return;
      const uri = res.assets[0].uri;
      const content = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.UTF8 });
      const data = JSON.parse(content);
      validateBackup(data);
      const ok = await showConfirm('Confirmar restauración', 'Esto REEMPLAZARÁ todos los datos actuales. ¿Continuar?', 'Restaurar', true);
      if (!ok) return;
      try {
        await importAll(data);
        await refresh();
        showAlert('Listo', 'Datos restaurados correctamente');
      } catch (e2) { showAlert('Error', e2.message); }
    } catch (e) {
      showAlert('Error', e.message);
    }
  };

  return (
    <View style={theme.container}>
      <Text style={theme.header}>Ajustes</Text>
      <View style={theme.card}>
        <Text style={styles.title}>Seguridad</Text>
        <TouchableOpacity style={[theme.bigBtn, { marginTop:10 }]} onPress={() => setShowPin(true)}>
          <Text style={theme.bigBtnText}>Cambiar PIN</Text>
        </TouchableOpacity>
      </View>
      <View style={[theme.card, { marginTop:12 }]}>
        <Text style={styles.title}>Respaldo y restauración</Text>
        <TouchableOpacity style={[theme.bigBtn, { marginTop:10 }]} onPress={backup}>
          <Text style={theme.bigBtnText}>Crear respaldo JSON</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[theme.bigBtn, { marginTop:10, backgroundColor: colors.primaryDark }]} onPress={restore}>
          <Text style={theme.bigBtnText}>Restaurar desde JSON</Text>
        </TouchableOpacity>
        <Text style={styles.hint}>El respaldo incluye secciones, productos, unidades e historial (versión 2).</Text>
      </View>

      <Modal visible={showPin} animationType="slide" onRequestClose={() => setShowPin(false)}>
        <PinScreen initialMode="change" onUnlocked={() => setShowPin(false)} />
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize:18, fontWeight:'900', color:colors.primaryDark },
  hint: { color:colors.subtext, marginTop:8 },
});
