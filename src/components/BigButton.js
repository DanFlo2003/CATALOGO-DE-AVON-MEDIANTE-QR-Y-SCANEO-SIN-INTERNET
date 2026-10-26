import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../utils/colors';

const GRADIENTS = {
  primary: [colors.primary, '#e8834d'],
  dark: ['#e0761f', colors.primaryDark],
  accent: ['#efc494', colors.accent],
  gray: ['#b5b5b5', '#9c9c9c'],
  danger: ['#ef5350', colors.danger],
};

export default function BigButton({ children, onPress, disabled = false, loading = false, variant = 'primary', style, textStyle }) {
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled || loading} activeOpacity={0.85} style={[disabled && styles.disabled, style]}>
      <LinearGradient colors={GRADIENTS[variant] || GRADIENTS.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.btn}>
        {loading ? <ActivityIndicator color="#fff" style={{ marginRight: 8 }} /> : null}
        <Text style={[styles.text, textStyle]} numberOfLines={1}>{children}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  text: { color: '#fff', fontSize: 16, fontWeight: '800' },
  disabled: { opacity: 0.55 },
});
