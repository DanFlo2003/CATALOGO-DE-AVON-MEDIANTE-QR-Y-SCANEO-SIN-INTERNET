import React, { useRef, useState } from 'react';
import { Modal, View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as DocumentPicker from 'expo-document-picker';
import { detectBarcodeFromImage } from '../utils/barcodeImage';
import { showAlert } from '../utils/alerts';
import BigButton from './BigButton';
import { colors } from '../utils/colors';

const BARCODE_TYPES = ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'code93', 'itf14', 'codabar', 'qr', 'datamatrix', 'pdf417', 'aztec'];

export default function BarcodeScannerModal({ visible, onClose, onScan }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [readingImage, setReadingImage] = useState(false);
  const locked = useRef(false);

  const ensurePermission = async () => {
    try {
      if (permission?.granted) return true;
      const result = await requestPermission();
      if (!result.granted) {
        showAlert('Permiso requerido', 'Concede acceso a la cámara para escanear códigos.');
        return false;
      }
      return true;
    } catch (error) {
      showAlert('Error', `No se pudo solicitar acceso a la cámara: ${error.message}`);
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

  const pickImageAndScan = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: 'image/*', copyToCacheDirectory: true });
      if (res.canceled) return;
      const uri = res.assets?.[0]?.uri;
      if (!uri) return;
      setReadingImage(true);
      const codes = await detectBarcodeFromImage(uri);
      setReadingImage(false);
      if (!codes.length) {
        showAlert('Sin resultados', 'No se detectó ningún código en la imagen. Usa una foto donde el código se vea completo, derecho y bien iluminado.');
        return;
      }
      locked.current = true;
      onClose();
      onScan(codes[0]);
      setTimeout(() => { locked.current = false; }, 600);
    } catch (error) {
      setReadingImage(false);
      showAlert('Error', `No se pudo leer la imagen: ${error.message}`);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} onShow={ensurePermission}>
      <View style={styles.container}>
        <Text style={styles.title}>Escanear código</Text>
        <Text style={styles.hint}>Apunta al código de barras o QR (EAN, UPC, Code128, QR y más). Se detecta solo.</Text>
        <CameraView
          style={styles.camera}
          barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES }}
          onBarcodeScanned={handle}
        />
        {readingImage ? (
          <View style={styles.readingRow}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.readingText}>Leyendo la imagen...</Text>
          </View>
        ) : (
          <BigButton variant="accent" style={styles.imageBtn} textStyle={{ color: colors.primaryDark }} onPress={pickImageAndScan}>
            🖼️ Elegir imagen con código
          </BigButton>
        )}
        <BigButton variant="dark" style={styles.closeBtn} onPress={onClose}>
          Cerrar cámara
        </BigButton>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 16, justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '800', color: colors.primaryDark, textAlign: 'center' },
  hint: { color: colors.subtext, textAlign: 'center', marginVertical: 12 },
  camera: { height: 380, borderRadius: 16, overflow: 'hidden' },
  imageBtn: { marginTop: 14 },
  closeBtn: { marginTop: 10 },
  readingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 18, gap: 8 },
  readingText: { color: colors.subtext, fontWeight: '700' },
});
