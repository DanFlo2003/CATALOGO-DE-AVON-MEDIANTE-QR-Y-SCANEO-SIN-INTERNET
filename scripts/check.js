// Verificación rápida del proyecto: compila todos los JS de src/ con el mismo
// Babel que usa Metro y valida los JSON de configuración.
// Uso: npm run check
const fs = require('fs');
const path = require('path');
const babel = require('@babel/core');

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const full = path.join(dir, entry.name);
  return entry.isDirectory() ? walk(full) : (full.endsWith('.js') ? [full] : []);
});

let failed = 0;
for (const file of [...walk('src'), 'App.js']) {
  try {
    babel.transformSync(fs.readFileSync(file, 'utf8'), {
      filename: file,
      presets: [require.resolve('babel-preset-expo')],
      configFile: false,
      babelrc: false,
      compact: false,
    });
    console.log('OK  ', file);
  } catch (e) {
    failed++;
    console.error('FAIL', file, '->', e.message.split('\n')[0]);
  }
}

for (const json of ['app.json', 'package.json']) {
  try {
    JSON.parse(fs.readFileSync(json, 'utf8'));
    console.log('OK  ', json);
  } catch (e) {
    failed++;
    console.error('FAIL', json, '->', e.message);
  }
}

console.log(failed ? `\n${failed} archivo(s) con errores` : '\nTodos los archivos OK');
process.exit(failed ? 1 : 0);
