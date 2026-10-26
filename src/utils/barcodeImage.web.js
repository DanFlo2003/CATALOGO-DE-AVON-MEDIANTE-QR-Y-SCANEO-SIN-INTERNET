// Web: detección de códigos sobre una imagen elegida por el usuario.
// Usa BarcodeDetector nativo si existe; si no, el pipeline de expo-camera web
// (scanFromURLAsync), que internamente aplica la polyfill barcode-detector.
import { scanFromURLAsync } from 'expo-camera';

const WEB_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'code_93', 'itf', 'codabar', 'qr_code', 'data_matrix', 'pdf417', 'aztec'];

export const detectBarcodeFromImage = async (uri) => {
  if (typeof globalThis.BarcodeDetector !== 'undefined') {
    const response = await fetch(uri);
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);
    try {
      const detector = new globalThis.BarcodeDetector({ formats: WEB_FORMATS });
      const results = await detector.detect(bitmap);
      return results.map(r => r.rawValue).filter(Boolean);
    } finally {
      if (bitmap.close) bitmap.close();
    }
  }
  const results = await scanFromURLAsync(uri);
  return results.map(r => r.data).filter(Boolean);
};
