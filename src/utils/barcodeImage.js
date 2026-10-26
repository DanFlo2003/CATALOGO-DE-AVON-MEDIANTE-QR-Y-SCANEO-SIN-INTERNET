// Android/iOS: detección con ML Kit a través de expo-camera.
import { scanFromURLAsync } from 'expo-camera';

const TYPES = ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'code93', 'itf14', 'codabar', 'qr', 'datamatrix', 'pdf417', 'aztec'];

export const detectBarcodeFromImage = async (uri) => {
  const results = await scanFromURLAsync(uri, TYPES);
  return results.map(r => r.data).filter(Boolean);
};
