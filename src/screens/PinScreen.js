import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { showAlert } from '../utils/alerts';
import { getSecure, setSecure } from '../utils/secureStorage';
import { colors } from '../utils/colors';
import { theme } from '../utils/theme';

const KEY = 'avon_pin';
const DEFAULT_PIN = '1234';
const MAX_ATTEMPTS = 5;
const LOCK_SECONDS = 60;

export default function PinScreen({ onUnlocked, initialMode = 'auto' }) {
  const [mode, setMode] = useState('loading');
  const [currentPin, setCurrentPin] = useState('');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [stored, setStored] = useState(null);
  const [hasCustom, setHasCustom] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [lockUntil, setLockUntil] = useState(0);
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!lockUntil) return undefined;
    const tick = () => {
      const left = Math.ceil((lockUntil - Date.now()) / 1000);
      setRemaining(left > 0 ? left : 0);
      if (left <= 0) setLockUntil(0);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [lockUntil]);

  const locked = remaining > 0;

  useEffect(() => {
    let mounted = true;
    getSecure(KEY).then((savedPin) => {
      if (!mounted) return;
      const effective = savedPin || DEFAULT_PIN;
      setStored(effective);
      setHasCustom(Boolean(savedPin));
      setMode(initialMode === 'change' ? 'change' : 'check');
    }).catch((error) => {
      setLoadError(error.message);
      setMode('error');
    });
    return () => { mounted = false; };
  }, [initialMode]);

  const check = async () => {
    if (locked) return;
    if (pin === stored) {
      onUnlocked();
      return;
    }
    const n = attempts + 1;
    if (n >= MAX_ATTEMPTS) {
      setAttempts(0);
      setLockUntil(Date.now() + LOCK_SECONDS * 1000);
      setPin('');
      showAlert('Demasiados intentos', `Por seguridad, espera ${LOCK_SECONDS} segundos para volver a intentar.`);
    } else {
      setAttempts(n);
      showAlert('PIN incorrecto', `Intento ${n} de ${MAX_ATTEMPTS}.`);
    }
  };

  const change = async () => {
    if (currentPin !== stored) return showAlert('Error', 'El PIN actual es incorrecto');
    if (!/^\d{4}$/.test(pin)) return showAlert('Error', 'El nuevo PIN debe tener 4 dígitos');
    if (pin !== pin2) return showAlert('Error', 'Los PIN no coinciden');
    try {
      await setSecure(KEY, pin);
      showAlert('Listo', 'PIN actualizado');
      onUnlocked();
    } catch (error) {
      showAlert('Error', `No se pudo actualizar el PIN seguro: ${error.message}`);
    }
  };

  if (mode === 'loading') {
    return <View style={[theme.container, styles.loading]}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }
  if (mode === 'error') {
    return (
      <View style={[theme.container, { justifyContent: 'center' }]}>
        <View style={theme.card}>
          <Text style={styles.title}>No se pudo verificar el PIN</Text>
          <Text style={styles.label}>{loadError}</Text>
        </View>
      </View>
    );
  }

  const title = mode === 'change' ? 'Cambiar PIN de 4 dígitos' : 'Ingresa tu PIN';

  return (
    <View style={[theme.container, { justifyContent:'center' }]}>
      <View style={theme.card}>
        <Text style={styles.brand}>GaeRomi</Text>
        <Text style={styles.title}>{title}</Text>
        {mode === 'check' && !hasCustom && (
          <Text style={styles.hint}>PIN inicial: {DEFAULT_PIN} (puedes cambiarlo en Ajustes)</Text>
        )}
        {mode === 'change' && (
          <>
            <Text style={styles.label}>PIN actual</Text>
            <TextInput style={theme.input} keyboardType="number-pad" maxLength={4} secureTextEntry value={currentPin} onChangeText={value => setCurrentPin(value.replace(/\D/g, '').slice(0, 4))} />
          </>
        )}
        <Text style={styles.label}>{mode === 'change' ? 'Nuevo PIN' : 'PIN'}</Text>
        <TextInput style={theme.input} keyboardType="number-pad" maxLength={4} secureTextEntry editable={mode === 'change' || !locked} value={pin} onChangeText={value => setPin(value.replace(/\D/g, '').slice(0, 4))} />
        {mode === 'change' && (
          <>
            <Text style={[styles.label, { marginTop:10 }]}>Confirmar PIN</Text>
            <TextInput style={theme.input} keyboardType="number-pad" maxLength={4} secureTextEntry value={pin2} onChangeText={value => setPin2(value.replace(/\D/g, '').slice(0, 4))} />
          </>
        )}
        <TouchableOpacity style={[theme.bigBtn, { marginTop:16 }, locked && { opacity: 0.5 }]} onPress={mode==='change'?change: check} disabled={locked}>
          <Text style={theme.bigBtnText}>{mode==='check' ? (locked ? `Espera ${remaining}s...` : 'Desbloquear') : 'Guardar'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  brand: { fontSize: 30, fontWeight: '900', color: colors.primary, textAlign: 'center', marginBottom: 4 },
  title: { fontSize:20, fontWeight:'900', color:colors.primaryDark, marginBottom:12, textAlign:'center' },
  label: { color:colors.subtext, fontWeight:'700', marginBottom:6 },
  hint: { color:colors.primary, fontWeight:'800', marginBottom:10 },
  loading: { justifyContent:'center', alignItems:'center' },
});
