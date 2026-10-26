import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Modal, ScrollView, StyleSheet, TextInput } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import {
  getSections, createSection, updateSection, deleteSection,
  getProductsList, getUnitsByProduct, updateUnitState,
  updateProduct, deleteProduct, addUnitsToProduct,
  createProductWithUnits, findProductByCode, moveProductsToSection,
} from '../db/database';
import { theme } from '../utils/theme';
import { colors } from '../utils/colors';
import ProductCard from '../components/ProductCard';
import UnitRow from '../components/UnitRow';
import BarcodeScannerModal from '../components/BarcodeScannerModal';
import BigButton from '../components/BigButton';
import { showAlert, showConfirm } from '../utils/alerts';
import { countUnits } from '../utils/helpers';

const EMOJIS = ['📦', '💄', '🧴', '🌸', '✨', '🎁', '🧼', '💅', '👄', '👁️', '🛍️', '👑', '🌺', '🔥', '🌈'];

export default function SeccionesScreen() {
  const { refresh } = useApp();
  const [sections, setSections] = useState([]);
  const [openSection, setOpenSection] = useState(null);

  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [list, setList] = useState([]);

  const [secModal, setSecModal] = useState(false);
  const [secForm, setSecForm] = useState({ id: null, name: '', emoji: '📦' });

  const [addVisible, setAddVisible] = useState(false);
  const [addCode, setAddCode] = useState('');
  const [scanVisible, setScanVisible] = useState(false);
  const [newVisible, setNewVisible] = useState(false);
  const [newForm, setNewForm] = useState({ name: '', price: '', qty: '1', detail: '', supplier: '' });

  const [sel, setSel] = useState(null);
  const [units, setUnits] = useState([]);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ code: '', name: '', price: '', detail: '', supplier: '', section_id: '' });
  const [addQty, setAddQty] = useState('');
  const [saving, setSaving] = useState(false);

  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState([]);
  const [moveVisible, setMoveVisible] = useState(false);
  const [moving, setMoving] = useState(false);

  const loadSections = useCallback(async () => {
    try {
      const s = await getSections();
      setSections(s);
    } catch (error) {
      showAlert('Error', `No se pudieron cargar las secciones: ${error.message}`);
    }
  }, []);

  const loadProducts = useCallback(async (sectionArg = openSection, filterArg = filter) => {
    if (!sectionArg) { setList([]); return; }
    try {
      const l = await getProductsList(sectionArg.id, filterArg);
      setList(l);
    } catch (error) {
      showAlert('Error', `No se pudo cargar la lista: ${error.message}`);
    }
  }, [openSection, filter]);

  useFocusEffect(useCallback(() => {
    loadSections();
    if (openSection) loadProducts();
  }, [loadSections, openSection, loadProducts]));

  const reloadAll = async () => {
    await loadSections();
    if (openSection) await loadProducts();
    await refresh();
  };

  // ---- Secciones ----
  const newSection = () => {
    setSecForm({ id: null, name: '', emoji: '📦' });
    setSecModal(true);
  };

  const editSection = (section) => {
    setSecForm({ id: section.id, name: section.name, emoji: section.emoji || '📦' });
    setSecModal(true);
  };

  const saveSection = async () => {
    if (!secForm.name.trim()) return showAlert('Error', 'Ingresa el nombre de la sección');
    try {
      setSaving(true);
      if (secForm.id) {
        await updateSection({ id: secForm.id, name: secForm.name.trim(), emoji: secForm.emoji });
        if (openSection?.id === secForm.id) {
          setOpenSection({ ...openSection, name: secForm.name.trim(), emoji: secForm.emoji });
        }
      } else {
        await createSection({ name: secForm.name.trim(), emoji: secForm.emoji });
      }
      setSecModal(false);
      await loadSections();
    } catch (error) {
      showAlert('Error', `No se pudo guardar la sección: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteSection = async () => {
    const sectionId = secForm.id;
    if (!sectionId) return;
    if (sectionId === 'sec_general') {
      showAlert('No permitido', 'La sección General no se puede eliminar.');
      return;
    }
    let productCount = 0;
    try {
      productCount = (await getProductsList(sectionId, 'all')).length;
    } catch (error) {
      showAlert('Error', `No se pudo revisar la sección: ${error.message}`);
      return;
    }
    const ok = await showConfirm(
      'Eliminar sección',
      productCount > 0
        ? `La sección "${secForm.name}" tiene ${productCount} producto(s). Se moverán a la sección General y la sección se eliminará. ¿Continuar?`
        : `¿Eliminar la sección "${secForm.name}"?`,
      'Eliminar',
      true
    );
    if (!ok) return;
    try {
      await deleteSection(sectionId, productCount > 0 ? 'sec_general' : null);
      setSecModal(false);
      if (openSection?.id === sectionId) setOpenSection(null);
      await loadSections();
      if (productCount > 0) showAlert('Listo', 'Sección eliminada. Sus productos ahora están en General.');
    } catch (error) {
      showAlert('Error', error.message);
    }
  };

  const enterSection = (section) => {
    setOpenSection(section);
    setFilter('all');
    setSearch('');
    setSelectMode(false);
    setSelected([]);
    loadProducts(section, 'all');
  };

  // ---- Agregar producto en la sección ----
  const startAdd = () => {
    setAddCode('');
    setNewForm({ name: '', price: '', qty: '1', detail: '', supplier: '' });
    setAddVisible(true);
  };

  const checkCode = async (rawValue) => {
    const code = String(rawValue || '').trim();
    if (!code) return showAlert('Código requerido', 'Escribe el código o escanéalo.');
    try {
      const result = await findProductByCode(code);
      if (result) {
        const verFicha = await showConfirm(
          'Ya está en inventario',
          `El código ${code} ya existe: ${result.product.name} (sección ${result.product.section_name || '-'}). ¿Ver la ficha del producto?`,
          'Ver ficha'
        );
        if (verFicha) {
          setAddVisible(false);
          openProduct(result.product);
        }
        return;
      }
      setAddCode(code);
      setNewForm({ name: '', price: '', qty: '1', detail: '', supplier: '' });
      setAddVisible(false);
      setNewVisible(true);
    } catch (error) {
      showAlert('Error', `No se pudo verificar el código: ${error.message}`);
    }
  };

  const saveNew = async () => {
    const quantity = Number(newForm.qty);
    const priceRaw = newForm.price.replace(',', '.').trim();
    const price = Number(priceRaw);
    if (!newForm.name.trim()) return showAlert('Error', 'Ingresa el nombre del producto');
    if (!Number.isInteger(quantity) || quantity < 1) return showAlert('Error', 'La cantidad debe ser un número entero mayor que cero');
    if (!priceRaw || !Number.isFinite(price) || price < 0) return showAlert('Error', 'El precio es obligatorio: ingresa un número mayor o igual a cero');
    try {
      setSaving(true);
      await createProductWithUnits({
        code: addCode,
        name: newForm.name.trim(),
        price,
        qty: quantity,
        detail: newForm.detail,
        supplier: newForm.supplier,
        section_id: openSection.id,
      });
      setNewVisible(false);
      await reloadAll();
      showAlert('Listo', 'Producto creado en la sección');
    } catch (error) {
      showAlert('Error', `No se pudo guardar el producto: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  // ---- Ficha de producto ----
  const openProduct = async (product) => {
    try {
      const u = await getUnitsByProduct(product.id);
      setUnits(u);
      setSel(product);
      setEditing(false);
      setAddQty('');
    } catch (error) {
      showAlert('Error', `No se pudieron cargar las unidades: ${error.message}`);
    }
  };

  const reloadUnits = async () => {
    if (!sel) return;
    setUnits(await getUnitsByProduct(sel.id));
    await reloadAll();
  };

  const change = async (unit_id, state, client_name) => {
    if (!sel) return;
    try {
      await updateUnitState({ unit_id, state, client_name });
      setUnits(await getUnitsByProduct(sel.id));
      await reloadAll();
    } catch (error) {
      showAlert('Error', `No se pudo actualizar la unidad: ${error.message}`);
    }
  };

  const startEdit = () => {
    setEditForm({
      code: sel.code,
      name: sel.name,
      price: String(sel.price ?? 0),
      detail: sel.detail || '',
      supplier: sel.supplier || '',
      section_id: sel.section_id,
    });
    setEditing(true);
  };

  const saveEdit = async () => {
    const priceRaw = editForm.price.replace(',', '.').trim();
    const price = Number(priceRaw);
    if (!editForm.code.trim()) return showAlert('Error', 'El código es obligatorio');
    if (!editForm.name.trim()) return showAlert('Error', 'El nombre es obligatorio');
    if (!priceRaw || !Number.isFinite(price) || price < 0) return showAlert('Error', 'El precio es obligatorio: ingresa un número mayor o igual a cero');
    try {
      setSaving(true);
      await updateProduct({
        id: sel.id,
        code: editForm.code.trim(),
        name: editForm.name.trim(),
        price,
        detail: editForm.detail,
        supplier: editForm.supplier,
        section_id: editForm.section_id,
      });
      setSel({ ...sel, code: editForm.code.trim(), name: editForm.name.trim(), price, detail: editForm.detail, supplier: editForm.supplier, section_id: editForm.section_id });
      setEditing(false);
      await reloadAll();
    } catch (error) {
      showAlert('Error', `No se pudo actualizar el producto: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const addUnits = async () => {
    const quantity = Number(addQty);
    if (!Number.isInteger(quantity) || quantity < 1) return showAlert('Error', 'Ingresa una cantidad válida (entero mayor que cero)');
    try {
      setSaving(true);
      await addUnitsToProduct(sel.id, quantity);
      setAddQty('');
      await reloadUnits();
    } catch (error) {
      showAlert('Error', `No se pudieron agregar unidades: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    const ok = await showConfirm(
      'Eliminar producto',
      `Se eliminarán "${sel.name}" y todas sus unidades. Las ventas registradas se conservan en el historial.`,
      'Eliminar',
      true
    );
    if (ok) remove();
  };

  const remove = async () => {
    try {
      await deleteProduct(sel.id);
      setSel(null);
      await reloadAll();
    } catch (error) {
      showAlert('Error', `No se pudo eliminar el producto: ${error.message}`);
    }
  };

  // ---- Selección múltiple y movimiento en lote ----
  const startSelect = () => {
    setSelectMode(true);
    setSelected([]);
  };

  const exitSelect = () => {
    setSelectMode(false);
    setSelected([]);
  };

  const toggleSelect = (id) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const doMove = async (section) => {
    try {
      setMoving(true);
      const n = await moveProductsToSection(selected, section.id);
      setMoveVisible(false);
      exitSelect();
      await reloadAll();
      showAlert('Listo', `${n} producto(s) movidos a ${section.name}`);
    } catch (error) {
      showAlert('Error', error.message);
    } finally {
      setMoving(false);
    }
  };

  const visibleList = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(p =>
      String(p.name || '').toLowerCase().includes(q) ||
      String(p.code || '').toLowerCase().includes(q)
    );
  }, [list, search]);

  // ---- Render: lista de secciones ----
  if (!openSection) {
    return (
      <View style={theme.container}>
        <View style={styles.headerRow}>
          <Text style={theme.header}>Secciones</Text>
          <TouchableOpacity style={styles.plusBtn} onPress={newSection}>
            <Text style={styles.plusText}>＋</Text>
          </TouchableOpacity>
        </View>
        <FlatList
          data={sections}
          keyExtractor={s => s.id}
          renderItem={({ item }) => (
            <View style={styles.sectionCard}>
              <TouchableOpacity style={styles.sectionMain} onPress={() => enterSection(item)}>
                <Text style={styles.sectionEmoji}>{item.emoji || '📦'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionName}>{item.name}</Text>
                  <Text style={styles.sectionCount}>{item.product_count} productos · {item.unit_count} unidades</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={styles.pencil} onPress={() => editSection(item)}>
                <Text style={{ fontSize: 18 }}>✏️</Text>
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>Sin secciones. Crea una con el botón ＋</Text>}
        />

        {/* Modal crear/editar sección */}
        <Modal visible={secModal} transparent animationType="fade" onRequestClose={() => setSecModal(false)}>
          <View style={styles.backdrop}>
            <View style={styles.modal}>
              <Text style={styles.modalTitle}>{secForm.id ? 'Editar sección' : 'Nueva sección'}</Text>
              <Text style={theme.label}>Nombre</Text>
              <TextInput
                style={theme.input}
                placeholder="Ej. Perfumes, Cremas..."
                value={secForm.name}
                onChangeText={value => setSecForm({ ...secForm, name: value })}
              />
              <Text style={[theme.label, { marginTop: 10 }]}>Icono</Text>
              <View style={styles.emojiGrid}>
                {EMOJIS.map(e => (
                  <TouchableOpacity
                    key={e}
                    style={[styles.emojiBtn, secForm.emoji === e && styles.emojiActive]}
                    onPress={() => setSecForm({ ...secForm, emoji: e })}
                  >
                    <Text style={{ fontSize: 24 }}>{e}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <BigButton style={{ marginTop: 14 }} onPress={saveSection}>
                {saving ? 'Guardando...' : 'Guardar'}
              </BigButton>
              {secForm.id && (
                <BigButton variant="danger" style={styles.dangerBtn} onPress={confirmDeleteSection}>
                  Eliminar sección
                </BigButton>
              )}
              <TouchableOpacity style={[theme.bigBtn, styles.cancelBtn]} onPress={() => setSecModal(false)}>
                <Text style={theme.bigBtnText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // ---- Render: detalle de una sección ----
  return (
    <View style={theme.container}>
      <TouchableOpacity style={styles.backBtn} onPress={() => { setOpenSection(null); setList([]); setSearch(''); setSelectMode(false); setSelected([]); }}>
        <Text style={styles.backText}>← Secciones</Text>
      </TouchableOpacity>
      <Text style={theme.header}>{openSection.emoji || '📦'} {openSection.name}</Text>

      <TextInput
        style={theme.input}
        placeholder="Buscar por nombre o código..."
        value={search}
        onChangeText={setSearch}
        autoCorrect={false}
      />

      {selectMode ? (
        <View style={styles.selectBar}>
          <Text style={styles.selectCount}>{selected.length} seleccionado(s)</Text>
          <TouchableOpacity
            style={[styles.selectAction, styles.moveBtn]}
            disabled={!selected.length || moving}
            onPress={() => setMoveVisible(true)}
          >
            <Text style={styles.selectActionText}>Mover a...</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.selectAction, styles.cancelSmall]} onPress={exitSelect}>
            <Text style={styles.selectActionText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.actionRow}>
          <BigButton variant="dark" style={{ flex: 1 }} onPress={startAdd}>
            ＋ Agregar producto
          </BigButton>
          <TouchableOpacity style={styles.moveToggle} onPress={startSelect}>
            <Text style={{ fontSize: 20 }}>☰</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.filters}>
        {['all', 'disponible', 'reservado', 'vendido'].map(f => (
          <TouchableOpacity key={f} style={[styles.fbtn, filter === f && styles.fbtnActive]} onPress={() => { setFilter(f); loadProducts(openSection, f); }}>
            <Text style={[styles.ftext, filter === f && { color: '#fff' }]}>{f.toUpperCase()}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={visibleList}
        keyExtractor={i => i.id}
        renderItem={({ item }) => (
          <ProductCard
            item={item}
            selected={selectMode && selected.includes(item.id)}
            onPress={() => (selectMode ? toggleSelect(item.id) : openProduct(item))}
          />
        )}
        ListEmptyComponent={<Text style={styles.empty}>{search ? 'Sin resultados para la búsqueda' : 'Sin productos en esta sección'}</Text>}
      />

      {/* Modal agregar producto: código manual o escaneo */}
      <Modal visible={addVisible} transparent animationType="fade" onRequestClose={() => setAddVisible(false)}>
        <View style={styles.backdrop}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Agregar producto a {openSection.name}</Text>
            <Text style={theme.label}>Código del producto</Text>
            <TextInput
              style={theme.input}
              autoCorrect={false}
              autoCapitalize="characters"
              placeholder="Escribe el código (manual)"
              value={addCode}
              onChangeText={setAddCode}
              maxLength={64}
            />
            <BigButton style={{ marginTop: 12 }} onPress={() => checkCode(addCode)}>
              Continuar
            </BigButton>
            <BigButton variant="dark" style={styles.scanBtn} onPress={() => setScanVisible(true)}>
              📷 Escanear código
            </BigButton>
            <TouchableOpacity style={[theme.bigBtn, styles.cancelBtn]} onPress={() => setAddVisible(false)}>
              <Text style={theme.bigBtnText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <BarcodeScannerModal
        visible={scanVisible}
        onClose={() => setScanVisible(false)}
        onScan={(value) => checkCode(value)}
      />

      {/* Modal nuevo producto (código confirmado) */}
      <Modal visible={newVisible} transparent animationType="fade" onRequestClose={() => setNewVisible(false)}>
        <View style={styles.backdrop}>
          <ScrollView contentContainerStyle={styles.modalOuter} keyboardShouldPersistTaps="handled">
            <View style={styles.modal}>
              <Text style={styles.modalTitle}>Nuevo producto</Text>
              <Text style={styles.camp}>Sección: {openSection.emoji || '📦'} {openSection.name}</Text>
              <Text style={theme.label}>Código</Text>
              <TextInput style={theme.input} value={addCode} editable={false} />
              <Text style={[theme.label, { marginTop: 10 }]}>Nombre</Text>
              <TextInput style={theme.input} value={newForm.name} onChangeText={value => setNewForm({ ...newForm, name: value })} />
              <Text style={[theme.label, { marginTop: 10 }]}>Precio (obligatorio)</Text>
              <TextInput style={theme.input} keyboardType="decimal-pad" value={newForm.price} onChangeText={value => setNewForm({ ...newForm, price: value })} />
              <Text style={[theme.label, { marginTop: 10 }]}>Cantidad de unidades</Text>
              <TextInput style={theme.input} keyboardType="number-pad" value={newForm.qty} onChangeText={value => setNewForm({ ...newForm, qty: value.replace(/\D/g, '') })} />
              <Text style={[theme.label, { marginTop: 10 }]}>Detalle (opcional)</Text>
              <TextInput style={theme.input} value={newForm.detail} onChangeText={value => setNewForm({ ...newForm, detail: value })} placeholder="Ej. 250 ml, tono rosado..." />
              <Text style={[theme.label, { marginTop: 10 }]}>Proveedor (opcional)</Text>
              <TextInput style={theme.input} value={newForm.supplier} onChangeText={value => setNewForm({ ...newForm, supplier: value })} />
              <BigButton style={{ marginTop: 14 }} onPress={saveNew} loading={saving}>
                {saving ? 'Guardando...' : 'Guardar producto'}
              </BigButton>
              <TouchableOpacity style={[theme.bigBtn, styles.cancelBtn]} onPress={() => setNewVisible(false)}>
                <Text style={theme.bigBtnText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Modal mover a otra sección */}
      <Modal visible={moveVisible} transparent animationType="fade" onRequestClose={() => setMoveVisible(false)}>
        <View style={styles.backdrop}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Mover {selected.length} producto(s) a...</Text>
            <ScrollView style={{ maxHeight: 320 }}>
              {sections.filter(s => s.id !== openSection.id).map(s => (
                <TouchableOpacity key={s.id} style={styles.moveItem} onPress={() => doMove(s)} disabled={moving}>
                  <Text style={styles.moveItemText}>{s.emoji || '📦'} {s.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={[theme.bigBtn, styles.cancelBtn]} onPress={() => setMoveVisible(false)}>
              <Text style={theme.bigBtnText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal ficha de producto */}
      <Modal visible={!!sel} animationType="slide" onRequestClose={() => setSel(null)}>
        <View style={theme.container}>
          <View style={styles.foundHeader}>
            <Text style={theme.header}>{sel?.name}</Text>
            <View style={styles.totalBadge}>
              <Text style={styles.totalX}>×{countUnits(units).total}</Text>
              <Text style={styles.totalLabel}>stock</Text>
            </View>
          </View>
          <Text style={styles.code}>Código: {sel?.code} | Precio: ${Number(sel?.price || 0).toFixed(2)}</Text>
          <View style={styles.stateRow}>
            <Text style={[styles.statePill, { backgroundColor: '#e7f5ea', color: colors.available }]}>Disponibles {countUnits(units).disponible}</Text>
            <Text style={[styles.statePill, { backgroundColor: '#fdf0dc', color: colors.reserved }]}>Reservados {countUnits(units).reservado}</Text>
            <Text style={[styles.statePill, { backgroundColor: '#e3edf9', color: colors.sold }]}>Vendidos {countUnits(units).vendido}</Text>
          </View>
          {!!sel?.detail && <Text style={styles.code}>Detalle: {sel.detail}</Text>}
          {!!sel?.supplier && <Text style={styles.code}>Proveedor: {sel.supplier}</Text>}

          {editing ? (
            <View style={[theme.card, { marginTop: 12 }]}>
              <Text style={styles.modalTitle}>Editar producto</Text>
              <Text style={theme.label}>Código</Text>
              <TextInput style={theme.input} autoCorrect={false} autoCapitalize="characters" value={editForm.code} onChangeText={value => setEditForm({ ...editForm, code: value })} />
              <Text style={[theme.label, { marginTop: 10 }]}>Nombre</Text>
              <TextInput style={theme.input} value={editForm.name} onChangeText={value => setEditForm({ ...editForm, name: value })} />
              <Text style={[theme.label, { marginTop: 10 }]}>Precio</Text>
              <TextInput style={theme.input} keyboardType="decimal-pad" value={editForm.price} onChangeText={value => setEditForm({ ...editForm, price: value })} />
              <Text style={[theme.label, { marginTop: 10 }]}>Detalle</Text>
              <TextInput style={theme.input} value={editForm.detail} onChangeText={value => setEditForm({ ...editForm, detail: value })} />
              <Text style={[theme.label, { marginTop: 10 }]}>Proveedor</Text>
              <TextInput style={theme.input} value={editForm.supplier} onChangeText={value => setEditForm({ ...editForm, supplier: value })} />
              <Text style={[theme.label, { marginTop: 10 }]}>Sección</Text>
              <View style={styles.sectionChips}>
                {sections.map(s => (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.chip, editForm.section_id === s.id && styles.chipActive]}
                    onPress={() => setEditForm({ ...editForm, section_id: s.id })}
                  >
                    <Text style={[styles.chipText, editForm.section_id === s.id && { color: '#fff' }]}>{s.emoji || '📦'} {s.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <BigButton style={{ marginTop: 14 }} onPress={saveEdit} loading={saving}>
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </BigButton>
              <TouchableOpacity style={[theme.bigBtn, styles.cancelBtn]} onPress={() => setEditing(false)}>
                <Text style={theme.bigBtnText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={styles.modalActions}>
                <BigButton style={{ flex: 1 }} onPress={startEdit}>
                  Editar
                </BigButton>
                <BigButton variant="danger" style={{ flex: 1 }} onPress={confirmDelete}>
                  Eliminar
                </BigButton>
              </View>
              <View style={styles.addRow}>
                <TextInput
                  style={[theme.input, styles.addInput]}
                  value={addQty}
                  onChangeText={value => setAddQty(value.replace(/\D/g, ''))}
                  keyboardType="number-pad"
                  placeholder="Cant."
                  maxLength={4}
                />
                <BigButton variant="dark" style={styles.addBtn} onPress={addUnits} loading={saving}>
                  {saving ? '...' : '+ Unidades'}
                </BigButton>
              </View>
              <ScrollView style={{ marginTop: 10 }}>
                {units.map(u => <UnitRow key={u.id} unit={u} onChange={change} />)}
              </ScrollView>
            </>
          )}
          <TouchableOpacity style={[theme.bigBtn, { marginTop: 10 }]} onPress={() => setSel(null)}>
            <Text style={theme.bigBtnText}>Cerrar</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  plusBtn: {
    width: 44, height: 44, borderRadius: 14, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  plusText: { color: '#fff', fontSize: 26, fontWeight: '900', marginTop: -2 },
  sectionCard: {
    backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: colors.border,
    padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center',
  },
  sectionMain: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  sectionEmoji: { fontSize: 30, marginRight: 12 },
  sectionName: { fontSize: 17, fontWeight: '900', color: colors.primaryDark },
  sectionCount: { color: colors.subtext, marginTop: 2 },
  pencil: { padding: 8 },
  empty: { textAlign: 'center', color: colors.subtext, marginTop: 20 },
  backBtn: { alignSelf: 'flex-start', paddingVertical: 6, paddingRight: 10 },
  backText: { color: colors.primary, fontWeight: '800', fontSize: 15 },
  actionRow: { flexDirection: 'row', gap: 8, marginBottom: 12, alignItems: 'center' },
  moveToggle: {
    width: 48, height: 48, borderRadius: 14, backgroundColor: '#fff',
    borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center',
  },
  selectBar: {
    flexDirection: 'row', gap: 8, marginBottom: 12, alignItems: 'center',
    backgroundColor: colors.accentLight, borderRadius: 14, padding: 10,
  },
  selectCount: { flex: 1, fontWeight: '900', color: colors.primaryDark },
  selectAction: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10 },
  moveBtn: { backgroundColor: colors.primary },
  cancelSmall: { backgroundColor: '#9c9c9c' },
  selectActionText: { color: '#fff', fontWeight: '800' },
  filters: { flexDirection: 'row', gap: 6, marginBottom: 10, flexWrap: 'wrap' },
  fbtn: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border },
  fbtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  ftext: { fontWeight: '800', color: colors.subtext },
  backdrop: { flex: 1, backgroundColor: 'rgba(58,42,28,0.45)', justifyContent: 'center', padding: 16 },
  modalOuter: { flexGrow: 1, justifyContent: 'center', padding: 16 },
  modal: { backgroundColor: '#fff', borderRadius: 18, padding: 16 },
  modalTitle: { fontSize: 18, fontWeight: '900', color: colors.primaryDark, marginBottom: 10 },
  camp: { color: colors.primary, fontWeight: '800', marginBottom: 10 },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  emojiBtn: {
    width: 48, height: 48, borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff',
  },
  emojiActive: { borderColor: colors.primary, backgroundColor: colors.accentLight },
  scanBtn: { marginTop: 8, backgroundColor: colors.primaryDark },
  dangerBtn: { marginTop: 8, backgroundColor: colors.danger },
  cancelBtn: { marginTop: 8, backgroundColor: '#9c9c9c' },
  moveItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  moveItemText: { fontSize: 16, fontWeight: '700', color: colors.text },
  code: { color: colors.subtext },
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
  stateRow: { flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' },
  statePill: { fontWeight: '800', fontSize: 12, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, overflow: 'hidden' },
  modalActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  editBtn: { flex: 1, backgroundColor: colors.primary, paddingVertical: 12 },
  deleteBtn: { flex: 1, backgroundColor: colors.danger, paddingVertical: 12 },
  addRow: { flexDirection: 'row', gap: 8, marginTop: 8, alignItems: 'center' },
  addInput: { width: 90 },
  addBtn: { flex: 1, backgroundColor: colors.primaryDark, paddingVertical: 12 },
  sectionChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
    backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontWeight: '800', color: colors.subtext },
});
