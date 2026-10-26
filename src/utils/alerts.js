import { Platform, Alert } from 'react-native';

// Alert.alert no hace nada en web (react-native-web), así que en el navegador
// se usan diálogos DOM propios; en Android/iOS se usa el Alert nativo.

const openDialog = (title, message, buttons) => new Promise((resolve) => {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:fixed;inset:0;background:rgba(58,42,28,0.45);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;font-family:system-ui,sans-serif;';
  const card = document.createElement('div');
  card.style.cssText = 'background:#fff;border-radius:16px;padding:20px;max-width:360px;width:100%;box-shadow:0 10px 40px rgba(0,0,0,0.25);';
  const titleEl = document.createElement('div');
  titleEl.textContent = title;
  titleEl.style.cssText = 'font-weight:800;font-size:17px;color:#b54e05;margin-bottom:8px;';
  const msgEl = document.createElement('div');
  msgEl.textContent = message;
  msgEl.style.cssText = 'font-size:14px;color:#3a2a1c;white-space:pre-wrap;line-height:1.4;';
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:8px;margin-top:16px;justify-content:flex-end;flex-wrap:wrap;';
  buttons.forEach(b => {
    const btn = document.createElement('button');
    btn.textContent = b.label;
    btn.style.cssText = `border:none;border-radius:10px;padding:10px 16px;font-weight:700;font-size:14px;cursor:pointer;color:#fff;background:${b.destructive ? '#e03131' : b.primary ? '#F07119' : '#9c9c9c'};`;
    btn.onclick = () => { document.body.removeChild(wrap); resolve(b.value); };
    row.appendChild(btn);
  });
  card.appendChild(titleEl);
  card.appendChild(msgEl);
  card.appendChild(row);
  wrap.appendChild(card);
  document.body.appendChild(wrap);
});

export const showAlert = async (title, message) => {
  if (Platform.OS === 'web') {
    await openDialog(title, message, [{ label: 'OK', value: true, primary: true }]);
    return;
  }
  Alert.alert(title, message);
};

export const showConfirm = (title, message, confirmLabel = 'Aceptar', destructive = false) => {
  if (Platform.OS === 'web') {
    return openDialog(title, message, [
      { label: 'Cancelar', value: false },
      { label: confirmLabel, value: true, primary: true, destructive },
    ]);
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
    ]);
  });
};
