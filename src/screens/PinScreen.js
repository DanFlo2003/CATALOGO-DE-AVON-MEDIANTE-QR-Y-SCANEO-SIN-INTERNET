import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet, ActivityIndicator } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { colors } from '../utils/colors';
import { theme } from '../utils/theme';

const KEY = 'avon_pin';

export default function PinScreen({ onUnlocked, initialMode = 'auto' }) {
  const [mode, setMode] = useState('loading');
  const [currentPin, setCurrentPin] = useState('');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [stored, setStored] = useState(null);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let mounted = true;
    SecureStore.getItemAsync(KEY).then((savedPin) => {
      if (!mounted) return;
      setStored(savedPin);
      setMode(initialMode === 'change' && savedPin ? 'change' : savedPin ? 'check' : 'create');
    }).catch((error) => {
      setLoadError(error.message);
      setMode('error');
    });
    return () => { mounted = false; };
  }, [initialMode]);

  const create = async () => {
    if (!/^\d{4}$/.test(pin)) return Alert.alert('Error', 'El PIN debe tener 4 dígitos');
    if (pin !== pin2) return Alert.alert('Error', 'Los PIN no coinciden');
    try {
      await SecureStore.setItemAsync(KEY, pin);
      onUnlocked();
    } catch (error) {
      Alert.alert('Error', `No se pudo guardar el PIN seguro: ${error.message}`);
    }
  };

  const check = async () => {
    if (pin === stored) onUnlocked();
    else Alert.alert('Error', 'PIN incorrecto');
  };

  const change = async () => {
    if (currentPin !== stored) return Alert.alert('Error', 'El PIN actual es incorrecto');
    if (!/^\d{4}$/.test(pin)) return Alert.alert('Error', 'El nuevo PIN debe tener 4 dígitos');
    if (pin !== pin2) return Alert.alert('Error', 'Los PIN no coinciden');
    try {
      await SecureStore.setItemAsync(KEY, pin);
      Alert.alert('Listo', 'PIN actualizado');
      onUnlocked();
    } catch (error) {
      Alert.alert('Error', `No se pudo actualizar el PIN seguro: ${error.message}`);
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

  const title = mode === 'create' ? 'Crear PIN de 4 dígitos' : mode === 'change' ? 'Cambiar PIN de 4 dígitos' : 'Ingresa tu PIN';

  return (
    <View style={[theme.container, { justifyContent:'center' }]}>
      <View style={theme.card}>
        <Text style={styles.title}>{title}</Text>
        {mode === 'change' && (
          <>
            <Text style={styles.label}>PIN actual</Text>
            <TextInput style={theme.input} keyboardType="number-pad" maxLength={4} secureTextEntry value={currentPin} onChangeText={value => setCurrentPin(value.replace(/\D/g, '').slice(0, 4))} />
          </>
        )}
        <Text style={styles.label}>{mode === 'change' ? 'Nuevo PIN' : 'PIN'}</Text>
        <TextInput style={theme.input} keyboardType="number-pad" maxLength={4} secureTextEntry value={pin} onChangeText={value => setPin(value.replace(/\D/g, '').slice(0, 4))} />
        {(mode === 'create' || mode === 'change') && (
          <>
            <Text style={[styles.label, { marginTop:10 }]}>Confirmar PIN</Text>
            <TextInput style={theme.input} keyboardType="number-pad" maxLength={4} secureTextEntry value={pin2} onChangeText={value => setPin2(value.replace(/\D/g, '').slice(0, 4))} />
          </>
        )}
        <TouchableOpacity style={[theme.bigBtn, { marginTop:16 }]} onPress={mode==='create'?create: mode==='change'?change: check}>
          <Text style={theme.bigBtnText}>{mode==='check'?'Desbloquear':'Guardar'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize:20, fontWeight:'900', color:colors.primaryDark, marginBottom:12 },
  label: { color:colors.subtext, fontWeight:'700', marginBottom:6 },
  loading: { justifyContent:'center', alignItems:'center' },
});
