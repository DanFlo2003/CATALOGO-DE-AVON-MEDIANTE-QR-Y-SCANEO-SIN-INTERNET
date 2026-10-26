import React from 'react';
import { Modal, View, Text, StyleSheet } from 'react-native';
import { colors } from '../utils/colors';

export default function PinModal({ visible }) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.box}>
          <Text style={styles.title}>GaeRomi</Text>
          <Text style={styles.sub}>Protegido con PIN</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex:1, backgroundColor:colors.accentLight, justifyContent:'center', alignItems:'center' },
  box: { alignItems:'center' },
  title: { fontSize:26, fontWeight:'900', color:colors.primaryDark },
  sub: { color:colors.subtext, marginTop:6 },
});
