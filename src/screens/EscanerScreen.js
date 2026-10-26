import React, { useCallback, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, TextInput, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { findProductByCode, createProductWithUnits, updateUnitState, addUnitsToProduct, getSections } from '../db/database';
import { theme } from '../utils/theme';
import { colors } from '../utils/colors';
import { countUnits } from '../utils/helpers';
import { showAlert } from '../utils/alerts';
import UnitRow from '../components/UnitRow';
import BarcodeScannerModal from '../components/BarcodeScannerModal';
import BigButton from '../components/BigButton';

export default function EscanerScreen() {
  const { refresh } = useApp();
  const [sections, setSections] = useState([]);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [code, setCode] = useState('');
  const [lastScan, setLastScan] = useState('');
  const [found, setFound] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name: '', price: '', qty: '1', detail: '', supplier: '', section_id: '' });
  const [addQty, setAddQty] = useState('');
  const [adding, setAdding] = useState(false);
  const lookupInProgress = useRef(false);

  const counts = found ? countUnits(found.units) : null;

  const loadSections = useCallback(async () => {
    try {
      const s = await getSections();
      setSections(s);
      setForm(f => (f.section_id && s.some(x => x.id === f.section_id)) ? f : { ...f, section_id: s[0]?.id || '' });
    } catch (error) {
      showAlert('Error', `No se pudieron cargar las secciones: ${error.message}`);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    loadSections();
  }, [loadSections]));

  const lookup = async (value = code) => {
    if (lookupInProgress.current) return;
    const normalizedCode = String(value || '').trim();
    if (!normalizedCode) {
      showAlert('Código requerido', 'Escribe un código o escanéalo para buscar el producto.');
      return;
    }

    lookupInProgress.current = true;
    setLookingUp(true);
    setCode(normalizedCode);
    setFound(null);
    try {
      const result = await findProductByCode(normalizedCode);
      if (result) {
        setFound(result);
        setShowNew(false);
      } else {
        setForm(f => ({ name: '', price: '', qty: '1', detail: '', supplier: '', section_id: f.section_id || sections[0]?.id || '' }));
        setShowNew(true);
      }
    } catch (error) {
      showAlert('Error', `No se pudo buscar el producto: ${error.message}`);
    } finally {
      lookupInProgress.current = false;
      setLookingUp(false);
    }
  };

  const handleScan = (value) => {
    setLastScan(value);
    lookup(value);
  };

  const create = async () => {
    const quantity = Number(form.qty);
    const priceRaw = form.price.replace(',', '.').trim();
    const price = Number(priceRaw);
    if (!form.section_id) return showAlert('Error', 'Selecciona una sección');
    if (!form.name.trim()) return showAlert('Error', 'Ingresa el nombre del producto');
    if (!Number.isInteger(quantity) || quantity < 1) return showAlert('Error', 'La cantidad debe ser un número entero mayor que cero');
    if (!priceRaw || !Number.isFinite(price) || price < 0) return showAlert('Error', 'El precio es obligatorio: ingresa un número mayor o igual a cero');

    try {
      await createProductWithUnits({
        code,
        name: form.name.trim(),
        price,
        qty: quantity,
        detail: form.detail,
        supplier: form.supplier,
        section_id: form.section_id,
      });
      const result = await findProductByCode(code);
      setFound(result);
      setShowNew(false);
      await refresh();
      showAlert('Listo', 'Producto creado en su sección');
    } catch (error) {
      showAlert('Error', `No se pudo guardar el producto: ${error.message}`);
    }
  };

  const addUnits = async () => {
    if (!found) return;
    const quantity = Number(addQty);
    if (!Number.isInteger(quantity) || quantity < 1) return showAlert('Error', 'Ingresa una cantidad válida (entero mayor que cero)');
    try {
      setAdding(true);
      await addUnitsToProduct(found.product.id, quantity);
      setFound(await findProductByCode(found.product.code));
      setAddQty('');
      await refresh();
    } catch (error) {
      showAlert('Error', `No se pudieron agregar unidades: ${error.message}`);
    } finally {
      setAdding(false);
    }
  };

  const change = async (unitId, state, clientName) => {
    if (!found) return;
    try {
      await updateUnitState({ unit_id: unitId, state, client_name: clientName });
      setFound(await findProductByCode(code));
      await refresh();
    } catch (error) {
      showAlert('Error', `No se pudo actualizar la unidad: ${error.message}`);
    }
  };

  const clearSearch = () => {
    setCode('');
    setFound(null);
    setShowNew(false);
    setLastScan('');
  };

  return (
    <ScrollView style={theme.container} keyboardShouldPersistTaps="handled">
      <Text style={theme.header}>Buscar producto</Text>
      <View style={theme.card}>
        <Text style={styles.label}>Código del producto</Text>
        <TextInput
          style={theme.input}
          value={code}
          onChangeText={setCode}
          autoCorrect={false}
          autoCapitalize="characters"
          placeholder="Escribe el código (barras o QR)"
          maxLength={64}
          returnKeyType="search"
          onSubmitEditing={() => lookup()}
        />
        <View style={styles.actions}>
          <BigButton style={styles.actionButton} onPress={() => lookup()} loading={lookingUp}>
            {lookingUp ? 'Buscando...' : 'Buscar código'}
          </BigButton>
          <BigButton variant="dark" style={styles.actionButton} onPress={() => setScannerOpen(true)}>
            📷 Escanear
          </BigButton>
        </View>
        {lastScan ? <Text style={styles.lastScan}>Último código detectado: {lastScan}</Text> : null}
      </View>

      <BarcodeScannerModal
        visible={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleScan}
      />

      {found && counts && (
        <View style={[theme.card, { marginTop: 12 }]}>
          <View style={styles.foundHeader}>
            <Text style={styles.title}>Producto encontrado</Text>
            <View style={styles.totalBadge}>
              <Text style={styles.totalX}>×{counts.total}</Text>
              <Text style={styles.totalLabel}>stock</Text>
            </View>
          </View>
          <Text style={styles.prod}>{found.product.name}</Text>
          <View style={styles.stateRow}>
            <Text style={[styles.statePill, { backgroundColor: '#e7f5ea', color: colors.available }]}>Disponibles {counts.disponible}</Text>
            <Text style={[styles.statePill, { backgroundColor: '#fdf0dc', color: colors.reserved }]}>Reservados {counts.reservado}</Text>
            <Text style={[styles.statePill, { backgroundColor: '#e3edf9', color: colors.sold }]}>Vendidos {counts.vendido}</Text>
          </View>
          <Text style={styles.sub}>Código: {found.product.code}</Text>
          <Text style={styles.sub}>Precio: ${Number(found.product.price || 0).toFixed(2)}</Text>
          <Text style={styles.sub}>Sección: {found.product.section_emoji || '📦'} {found.product.section_name || '-'}</Text>
          {!!found.product.detail && <Text style={styles.sub}>Detalle: {found.product.detail}</Text>}
          {!!found.product.supplier && <Text style={styles.sub}>Proveedor: {found.product.supplier}</Text>}
          <Text style={[styles.sub, { marginTop: 10, fontWeight: '900' }]}>Unidades</Text>
          {found.units.map(unit => <UnitRow key={unit.id} unit={unit} onChange={change} />)}
          <View style={styles.addRow}>
            <TextInput
              style={[theme.input, styles.addInput]}
              value={addQty}
              onChangeText={value => setAddQty(value.replace(/\D/g, ''))}
              keyboardType="number-pad"
              placeholder="Cant."
              maxLength={4}
            />
            <BigButton variant="dark" style={styles.addBtn} onPress={addUnits} loading={adding}>
              {adding ? 'Agregando...' : '+ Unidades'}
            </BigButton>
          </View>
        </View>
      )}

      {(found || code) && (
        <BigButton variant="gray" style={styles.clearButton} onPress={clearSearch}>
          Limpiar búsqueda
        </BigButton>
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
              <Text style={[styles.label, { marginTop: 10 }]}>Precio (obligatorio)</Text>
              <TextInput style={theme.input} keyboardType="decimal-pad" value={form.price} onChangeText={value => setForm({ ...form, price: value })} />
              <Text style={[styles.label, { marginTop: 10 }]}>Cantidad de unidades</Text>
              <TextInput style={theme.input} keyboardType="number-pad" value={form.qty} onChangeText={value => setForm({ ...form, qty: value.replace(/\D/g, '') })} />
              <Text style={[styles.label, { marginTop: 10 }]}>Detalle (opcional)</Text>
              <TextInput style={theme.input} value={form.detail} onChangeText={value => setForm({ ...form, detail: value })} placeholder="Ej. 250 ml, tono rosado..." />
              <Text style={[styles.label, { marginTop: 10 }]}>Proveedor (opcional)</Text>
              <TextInput style={theme.input} value={form.supplier} onChangeText={value => setForm({ ...form, supplier: value })} />
              <Text style={[styles.label, { marginTop: 10 }]}>Sección</Text>
              <View style={styles.sectionChips}>
                {sections.map(s => (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.chip, form.section_id === s.id && styles.chipActive]}
                    onPress={() => setForm({ ...form, section_id: s.id })}
                  >
                    <Text style={[styles.chipText, form.section_id === s.id && { color: '#fff' }]}>{s.emoji || '📦'} {s.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <BigButton style={{ marginTop: 14 }} onPress={create}>
                Guardar producto
              </BigButton>
              <BigButton variant="gray" style={{ marginTop: 8 }} onPress={() => setShowNew(false)}>
                Cancelar
              </BigButton>
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
  actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  actionButton: { flex: 1 },
  lastScan: { color: colors.available, fontWeight: '800', marginTop: 10 },
  foundHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalBadge: {
    backgroundColor: colors.accentLight,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 4,
    alignItems: 'center',
  },
  totalX: { fontSize: 18, fontWeight: '900', color: colors.primaryDark },
  totalLabel: { fontSize: 10, fontWeight: '700', color: colors.subtext },
  stateRow: { flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' },
  statePill: { fontWeight: '800', fontSize: 12, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, overflow: 'hidden' },
  addRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  addInput: { width: 90 },
  addBtn: { flex: 1 },
  clearButton: { marginTop: 12, marginBottom: 20 },
  backdrop: { flex: 1, backgroundColor: 'rgba(58,42,28,0.45)' },
  modalOuter: { flexGrow: 1, justifyContent: 'center', padding: 16 },
  modal: { backgroundColor: '#fff', borderRadius: 18, padding: 16 },
  sectionChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
    backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontWeight: '800', color: colors.subtext },
});
