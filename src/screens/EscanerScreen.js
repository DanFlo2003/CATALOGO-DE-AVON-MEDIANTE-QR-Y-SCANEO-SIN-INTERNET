import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, TextInput, Alert, ScrollView, StyleSheet } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useApp } from '../context/AppContext';
import { findProductByCode, createProductWithUnits, updateUnitState } from '../db/database';
import { theme } from '../utils/theme';
import { colors } from '../utils/colors';
import UnitRow from '../components/UnitRow';

export default function EscanerScreen() {
  const { active, refresh } = useApp();
  const [permission, requestPermission] = useCameraPermissions();
  const [scannerOpen, setScannerOpen] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [code, setCode] = useState('');
  const [found, setFound] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name: '', price: '', qty: '1' });
  const lookupInProgress = useRef(false);

  const lookup = async (value = code) => {
    if (lookupInProgress.current) return;
    const normalizedCode = value.trim();
    if (!normalizedCode) {
      Alert.alert('Código requerido', 'Escribe un código o escanéalo para buscar el producto.');
      return;
    }

    lookupInProgress.current = true;
    setLookingUp(true);
    setCode(normalizedCode);
    setScannerOpen(false);
    setFound(null);
    try {
      const result = await findProductByCode(normalizedCode);
      if (result) {
        setFound(result);
        setShowNew(false);
      } else {
        setForm({ name: '', price: '', qty: '1' });
        setShowNew(true);
      }
    } catch (error) {
      Alert.alert('Error', `No se pudo buscar el producto: ${error.message}`);
    } finally {
      lookupInProgress.current = false;
      setLookingUp(false);
    }
  };

  const openScanner = async () => {
    try {
      if (!permission?.granted) {
        const result = await requestPermission();
        if (!result.granted) {
          Alert.alert('Permiso requerido', 'Concede acceso a la cámara para escanear códigos.');
          return;
        }
      }
      setScannerOpen(true);
    } catch (error) {
      Alert.alert('Error', `No se pudo solicitar acceso a la cámara: ${error.message}`);
    }
  };

  const handleScan = ({ data }) => {
    if (scannerOpen) lookup(data);
  };

  const create = async () => {
    const quantity = Number(form.qty);
    const price = Number(form.price.replace(',', '.') || 0);
    if (!active) return Alert.alert('Error', 'Selecciona una campaña activa');
    if (!form.name.trim()) return Alert.alert('Error', 'Ingresa el nombre del producto');
    if (!Number.isInteger(quantity) || quantity < 1) return Alert.alert('Error', 'La cantidad debe ser un número entero mayor que cero');
    if (!Number.isFinite(price) || price < 0) return Alert.alert('Error', 'Ingresa un precio válido');

    try {
      await createProductWithUnits({ code, name: form.name.trim(), price, qty: quantity, campaign_id: active.id });
      const result = await findProductByCode(code);
      setFound(result);
      setShowNew(false);
      await refresh();
      Alert.alert('Listo', 'Producto creado con sus unidades');
    } catch (error) {
      Alert.alert('Error', `No se pudo guardar el producto: ${error.message}`);
    }
  };

  const change = async (unitId, state, clientName) => {
    if (!active) return;
    try {
      await updateUnitState({ unit_id: unitId, state, client_name: clientName, campaign_id: active.id });
      setFound(await findProductByCode(code));
      await refresh();
    } catch (error) {
      Alert.alert('Error', `No se pudo actualizar la unidad: ${error.message}`);
    }
  };

  const clearSearch = () => {
    setCode('');
    setFound(null);
    setScannerOpen(false);
    setShowNew(false);
  };

  return (
    <ScrollView style={theme.container} keyboardShouldPersistTaps="handled">
      <Text style={theme.header}>Consultar o agregar producto</Text>
      <View style={theme.card}>
        <Text style={styles.label}>Código del producto</Text>
        <TextInput
          style={theme.input}
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
          placeholder="Escribe el código"
          maxLength={64}
          returnKeyType="search"
          onSubmitEditing={() => lookup()}
        />
        <View style={styles.actions}>
          <TouchableOpacity style={[theme.bigBtn, styles.actionButton]} onPress={() => lookup()} disabled={lookingUp}>
            <Text style={theme.bigBtnText}>{lookingUp ? 'Buscando...' : 'Buscar código'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[theme.bigBtn, styles.actionButton, styles.scanButton]} onPress={openScanner}>
            <Text style={theme.bigBtnText}>Escanear</Text>
          </TouchableOpacity>
        </View>
      </View>

      {scannerOpen && (
        <View style={styles.cameraCard}>
          <CameraView
            style={styles.camera}
            barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'qr'] }}
            onBarcodeScanned={handleScan}
          />
          <TouchableOpacity style={[theme.bigBtn, { marginTop: 10 }]} onPress={() => setScannerOpen(false)}>
            <Text style={theme.bigBtnText}>Cerrar cámara</Text>
          </TouchableOpacity>
        </View>
      )}

      {found && (
        <View style={[theme.card, { marginTop: 12 }]}>
          <Text style={styles.title}>Producto encontrado</Text>
          <Text style={styles.prod}>{found.product.name}</Text>
          <Text style={styles.sub}>Código: {found.product.code}</Text>
          <Text style={styles.sub}>Precio: ${Number(found.product.price || 0).toFixed(2)}</Text>
          <Text style={[styles.sub, { marginTop: 10, fontWeight: '900' }]}>Unidades</Text>
          {found.units.map(unit => <UnitRow key={unit.id} unit={unit} onChange={change} />)}
        </View>
      )}

      {(found || code) && (
        <TouchableOpacity style={[theme.bigBtn, styles.clearButton]} onPress={clearSearch}>
          <Text style={theme.bigBtnText}>Limpiar búsqueda</Text>
        </TouchableOpacity>
      )}

      <Modal visible={showNew} transparent animationType="fade" onRequestClose={() => setShowNew(false)}>
        <View style={styles.backdrop}>
          <ScrollView contentContainerStyle={styles.modalOuter} keyboardShouldPersistTaps="handled">
            <View style={styles.modal}>
              <Text style={styles.title}>Nuevo producto</Text>
              <Text style={styles.label}>Código</Text>
              <TextInput style={theme.input} value={code} editable={false} />
              <Text style={[styles.label, { marginTop: 10 }]}>Nombre</Text>
              <TextInput style={theme.input} value={form.name} onChangeText={value => setForm({ ...form, name: value })} />
              <Text style={[styles.label, { marginTop: 10 }]}>Precio</Text>
              <TextInput style={theme.input} keyboardType="decimal-pad" value={form.price} onChangeText={value => setForm({ ...form, price: value })} />
              <Text style={[styles.label, { marginTop: 10 }]}>Cantidad de unidades</Text>
              <TextInput style={theme.input} keyboardType="number-pad" value={form.qty} onChangeText={value => setForm({ ...form, qty: value.replace(/\D/g, '') })} />
              <Text style={styles.camp}>Campaña: {active?.name || 'Selecciona una campaña en Inicio'}</Text>
              <TouchableOpacity style={[theme.bigBtn, { marginTop: 14 }]} onPress={create}>
                <Text style={theme.bigBtnText}>Guardar producto</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[theme.bigBtn, { marginTop: 8, backgroundColor: '#9c9c9c' }]} onPress={() => setShowNew(false)}>
                <Text style={theme.bigBtnText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: '900', color: colors.primaryDark },
  prod: { fontSize: 18, fontWeight: '800', color: colors.text, marginTop: 6 },
  sub: { color: colors.subtext, marginTop: 3 },
  label: { color: colors.subtext, fontWeight: '700', marginBottom: 6 },
  camp: { color: colors.primary, fontWeight: '800', marginTop: 10 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  actionButton: { flex: 1, paddingHorizontal: 8 },
  scanButton: { backgroundColor: colors.primaryDark },
  cameraCard: { marginTop: 12, padding: 12, backgroundColor: '#fff', borderRadius: 16 },
  camera: { height: 300, borderRadius: 12, overflow: 'hidden' },
  clearButton: { marginTop: 12, marginBottom: 20, backgroundColor: colors.primaryDark },
  backdrop: { flex: 1, backgroundColor: 'rgba(47,31,42,0.4)' },
  modalOuter: { flexGrow: 1, justifyContent: 'center', padding: 16 },
  modal: { backgroundColor: '#fff', borderRadius: 18, padding: 16 },
});
