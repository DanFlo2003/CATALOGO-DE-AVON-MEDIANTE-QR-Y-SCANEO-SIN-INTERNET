import React, { useRef } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { theme } from '../utils/theme';
import { colors } from '../utils/colors';

const BARCODE_TYPES = ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'code93', 'itf14', 'codabar', 'qr', 'datamatrix', 'pdf417', 'aztec'];

export default function BarcodeScannerModal({ visible, onClose, onScan }) {
  const [permission, requestPermission] = useCameraPermissions();
  const locked = useRef(false);

  const ensurePermission = async () => {
    try {
      if (permission?.granted) return true;
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert('Permiso requerido', 'Concede acceso a la cámara para escanear códigos.');
        return false;
      }
      return true;
    } catch (error) {
      Alert.alert('Error', `No se pudo solicitar acceso a la cámara: ${error.message}`);
      return false;
    }
  };

  const handle = ({ data }) => {
    const value = typeof data === 'string' ? data.trim() : '';
    if (!value || locked.current) return;
    locked.current = true;
    onClose();
    onScan(value);
    setTimeout(() => { locked.current = false; }, 600);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      onShow={ensurePermission}
    >
      <View style={styles.container}>
        <Text style={styles.title}>Escanear código</Text>
        <Text style={styles.hint}>Apunta al código de barras o QR (EAN, UPC, Code128, QR y más). Se detecta solo.</Text>
        <CameraView
          style={styles.camera}
          barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES }}
          onBarcodeScanned={handle}
        />
        <TouchableOpacity style={[theme.bigBtn, styles.closeBtn]} onPress={onClose}>
          <Text style={theme.bigBtnText}>Cerrar cámara</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 16, justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '800', color: colors.primaryDark, textAlign: 'center' },
  hint: { color: colors.subtext, textAlign: 'center', marginVertical: 12 },
  camera: { height: 380, borderRadius: 16, overflow: 'hidden' },
  closeBtn: { marginTop: 16 },
});
