# Avon Catálogo

Aplicación móvil Android para administrar productos organizados en secciones, existencias por unidad, reservas, ventas y copias de seguridad. Los datos de catálogo se guardan localmente en SQLite (base v2 con secciones); el PIN se protege con el almacenamiento seguro del sistema. Si existía una instalación anterior (base v1 con campañas), sus productos, unidades e historial se migran automáticamente a la sección "General" la primera vez que se abre la app; la base vieja se conserva intacta como respaldo.

## Requisitos

- Node.js 24 LTS (Expo SDK actual requiere Node.js 24.3.0 o posterior en esta versión).
- npm.
- Android Studio/emulador o un teléfono Android con Expo Go para desarrollo.
- Cuenta Expo para generar APK con EAS Build.

El archivo `.nvmrc` selecciona Node 24 para gestores de versiones que lo soporten. La versión instalada se puede revisar con:

```powershell
node -v
```

## Instalar y ejecutar en Windows

Abre PowerShell en la carpeta del proyecto:

```powershell
npm install
npx expo-doctor
npx expo start -c
```

Escanea el QR con Expo Go o ejecuta la app en un emulador Android. Para alinear paquetes Expo después de una actualización del SDK, usa `npx expo install --fix`.

## Generar APK con EAS Build

```powershell
npm install --global eas-cli
eas login
eas build:configure
eas build --platform android --profile preview
```

La primera configuración de EAS debe vincular el proyecto a una cuenta Expo y registrar su `projectId`; no se debe inventar ni copiar un marcador de posición. El perfil `preview` en `eas.json` genera un APK de distribución interna.

## Funciones

- Secciones con nombre e icono (perfumes, cremas, etc.) creadas desde la pestaña Secciones; cada sección lista sus productos con búsqueda por nombre o código y filtros por estado.
- Agregar productos dentro de una sección por código escrito a mano o escaneado; si el código ya existe la app avisa "Ya está en inventario" y ofrece ver la ficha.
- Ficha de producto con nombre, precio, cantidad de unidades, detalle, proveedor y sección; edición completa, eliminación y movimiento en lote de productos entre secciones.
- Búsqueda global por código escrito o leído con cámara (EAN13, EAN8, UPC-A, UPC-E, Code128, Code39, Code93, ITF-14, Codabar, QR, DataMatrix y más).
- Stock individual con estados disponible, reservado y vendido; permite guardar el nombre opcional del cliente al reservar y agregar más unidades en cualquier momento.
- Métricas generales e historial de ventas.
- PIN de cuatro dígitos guardado con `expo-secure-store`, con cambio protegido por el PIN actual.
- Exportación de respaldo JSON (versión 2) y restauración con validación, confirmación y transacción SQLite.
- Interfaz con componentes y estilos nativos de React Native.
