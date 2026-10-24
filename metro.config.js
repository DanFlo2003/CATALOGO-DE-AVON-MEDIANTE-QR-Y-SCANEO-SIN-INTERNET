const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// expo-sqlite en web importa su WASM como asset; sin esto el worker de SQLite no compila.
config.resolver.assetExts.push('wasm');

module.exports = config;
