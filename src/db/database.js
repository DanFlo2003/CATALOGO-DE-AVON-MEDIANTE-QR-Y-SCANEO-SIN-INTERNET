import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system/legacy';
import { nowISO } from '../utils/helpers';

let db = null;

export const getDB = async () => {
  if (db) return db;
  db = await SQLite.openDatabaseAsync('avon_catalogo_v2.db');
  await initDB(db);
  return db;
};

const initDB = async (database) => {
  await database.execAsync(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS sections (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      emoji TEXT DEFAULT '📦',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY NOT NULL,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      price REAL DEFAULT 0,
      detail TEXT,
      supplier TEXT,
      section_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (section_id) REFERENCES sections(id)
    );

    CREATE TABLE IF NOT EXISTS units (
      id TEXT PRIMARY KEY NOT NULL,
      product_id TEXT NOT NULL,
      state TEXT CHECK(state IN ('disponible','reservado','vendido')) DEFAULT 'disponible',
      client_name TEXT,
      reserved_at TEXT,
      sold_at TEXT,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sales_log (
      id TEXT PRIMARY KEY NOT NULL,
      unit_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      client_name TEXT,
      price REAL DEFAULT 0,
      sold_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT
    );
  `);

  const res = await database.getFirstAsync('SELECT COUNT(*) as c FROM sections;');
  if (res.c === 0) {
    await database.runAsync(
      'INSERT INTO sections (id,name,emoji,created_at) VALUES (?,?,?,?)',
      ['sec_general', 'General', '📦', nowISO()]
    );
  }

  await migrateFromV1(database);
};

// Migra (una sola vez) los datos de la base v1 (campañas) a la v2 (secciones).
// El volcado es atómico: si algo falla a mitad, no se inserta nada y NO se marca
// como completada, para reintentarse automáticamente en el próximo arranque.
// La base vieja se conserva intacta en disco como copia de seguridad.
const migrateFromV1 = async (database) => {
  const done = await database.getFirstAsync("SELECT value FROM meta WHERE key = 'migrated_v1'");
  if (done) return;
  const finish = () => database.runAsync("INSERT OR REPLACE INTO meta (key,value) VALUES ('migrated_v1','done')");
  try {
    const info = await FileSystem.getInfoAsync(FileSystem.documentDirectory + 'SQLite/avon_catalogo.db');
    if (!info.exists) {
      await finish();
      return;
    }
    let old = null;
    try {
      old = await SQLite.openDatabaseAsync('avon_catalogo.db');
      const hasTables = await old.getFirstAsync("SELECT name FROM sqlite_master WHERE type='table' AND name='products'");
      if (!hasTables) {
        await finish();
        return;
      }

      await database.withTransactionAsync(async () => {
        await database.runAsync(
          "INSERT OR IGNORE INTO sections (id,name,emoji,created_at) VALUES ('sec_general','General','📦',?)",
          [nowISO()]
        );

        const validProducts = new Set((await database.getAllAsync('SELECT id FROM products')).map(r => r.id));
        const usedCodes = new Set((await database.getAllAsync('SELECT code FROM products')).map(r => r.code));
        for (const p of await old.getAllAsync('SELECT * FROM products')) {
          if (typeof p.code !== 'string' || !p.code.trim() || typeof p.name !== 'string' || !p.name.trim()) continue;
          if (usedCodes.has(p.code) || validProducts.has(p.id)) continue;
          await database.runAsync(
            'INSERT INTO products (id,code,name,price,detail,supplier,section_id,created_at) VALUES (?,?,?,?,?,?,?,?)',
            [p.id, p.code, p.name, Number(p.price) || 0, null, null, 'sec_general', p.created_at || nowISO()]
          );
          validProducts.add(p.id);
        }

        const validUnits = new Set((await database.getAllAsync('SELECT id FROM units')).map(r => r.id));
        for (const u of await old.getAllAsync('SELECT * FROM units')) {
          if (!validProducts.has(u.product_id) || validUnits.has(u.id)) continue;
          if (!['disponible', 'reservado', 'vendido'].includes(u.state)) continue;
          await database.runAsync(
            'INSERT INTO units (id,product_id,state,client_name,reserved_at,sold_at) VALUES (?,?,?,?,?,?)',
            [u.id, u.product_id, u.state, u.client_name ?? null, u.reserved_at ?? null, u.sold_at ?? null]
          );
          validUnits.add(u.id);
        }

        const validSales = new Set((await database.getAllAsync('SELECT id FROM sales_log')).map(r => r.id));
        for (const s of await old.getAllAsync('SELECT * FROM sales_log')) {
          if (validSales.has(s.id) || !validProducts.has(s.product_id) || !validUnits.has(s.unit_id)) continue;
          await database.runAsync(
            'INSERT INTO sales_log (id,unit_id,product_id,client_name,price,sold_at) VALUES (?,?,?,?,?,?)',
            [s.id, s.unit_id, s.product_id, s.client_name ?? null, Number(s.price) || 0, s.sold_at || nowISO()]
          );
          validSales.add(s.id);
        }
      });

      await finish();
    } finally {
      if (old) {
        try { await old.closeAsync(); } catch {}
      }
    }
  } catch (error) {
    // Falla la migración: no se marca como hecha (se reintenta en el próximo
    // arranque) y no bloquea el inicio de la app.
  }
};

// Sections
export const getSections = async () => {
  const db = await getDB();
  return await db.getAllAsync(`
    SELECT s.*,
      (SELECT COUNT(*) FROM products p WHERE p.section_id = s.id) as product_count,
      (SELECT COUNT(*) FROM units u JOIN products p ON p.id = u.product_id WHERE p.section_id = s.id) as unit_count
    FROM sections s
    ORDER BY s.name ASC
  `);
};

export const createSection = async ({ name, emoji }) => {
  const normalizedName = String(name || '').trim();
  if (!normalizedName) throw new Error('El nombre de la sección es obligatorio');
  const db = await getDB();
  const id = 'sec_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  await db.runAsync(
    'INSERT INTO sections (id,name,emoji,created_at) VALUES (?,?,?,?)',
    [id, normalizedName, emoji || '📦', nowISO()]
  );
  return id;
};

export const updateSection = async ({ id, name, emoji }) => {
  const normalizedName = String(name || '').trim();
  if (!normalizedName) throw new Error('El nombre de la sección es obligatorio');
  const db = await getDB();
  const result = await db.runAsync(
    'UPDATE sections SET name=?, emoji=? WHERE id=?',
    [normalizedName, emoji || '📦', id]
  );
  if (result.changes === 0) throw new Error('La sección ya no existe');
};

export const deleteSection = async (id, moveToSectionId = null) => {
  if (id === 'sec_general') throw new Error('La sección General no se puede eliminar');
  const db = await getDB();
  const products = await db.getAllAsync('SELECT id FROM products WHERE section_id = ?', [id]);
  if (products.length > 0 && !moveToSectionId) throw new Error('La sección tiene productos; indíca a qué sección moverlos');
  if (moveToSectionId && moveToSectionId !== id) {
    const dest = await db.getFirstAsync('SELECT id FROM sections WHERE id = ?', [moveToSectionId]);
    if (!dest) throw new Error('La sección destino no existe');
  }
  await db.withTransactionAsync(async () => {
    if (products.length > 0 && moveToSectionId && moveToSectionId !== id) {
      const placeholders = products.map(() => '?').join(',');
      await db.runAsync(
        `UPDATE products SET section_id = ? WHERE id IN (${placeholders})`,
        [moveToSectionId, ...products.map(p => p.id)]
      );
    }
    await db.runAsync('DELETE FROM sections WHERE id = ?', [id]);
  });
};

// Products + Units
export const findProductByCode = async (code) => {
  const db = await getDB();
  const p = await db.getFirstAsync(`
    SELECT p.*, s.name as section_name, s.emoji as section_emoji
    FROM products p
    LEFT JOIN sections s ON s.id = p.section_id
    WHERE p.code = ?
  `, [code]);
  if (!p) return null;
  const units = await db.getAllAsync('SELECT * FROM units WHERE product_id = ? ORDER BY id ASC', [p.id]);
  return { product: p, units };
};

export const createProductWithUnits = async ({ code, name, price, qty, detail = null, supplier = null, section_id }) => {
  const normalizedCode = String(code || '').trim();
  const normalizedName = String(name || '').trim();
  const normalizedDetail = String(detail || '').trim() || null;
  const normalizedSupplier = String(supplier || '').trim() || null;
  const quantity = Number(qty);
  const productPrice = Number(price || 0);
  if (!normalizedCode || !normalizedName) throw new Error('El código y el nombre son obligatorios');
  if (!section_id) throw new Error('Selecciona una sección');
  if (!Number.isInteger(quantity) || quantity < 1) throw new Error('La cantidad debe ser un entero mayor que cero');
  if (!Number.isFinite(productPrice) || productPrice < 0) throw new Error('El precio debe ser un número válido no negativo');

  const db = await getDB();
  const dup = await db.getFirstAsync('SELECT id FROM products WHERE code = ?', [normalizedCode]);
  if (dup) throw new Error('Ya existe un producto con ese código');

  const pid = 'prod_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'INSERT INTO products (id,code,name,price,detail,supplier,section_id,created_at) VALUES (?,?,?,?,?,?,?,?)',
      [pid, normalizedCode, normalizedName, productPrice, normalizedDetail, normalizedSupplier, section_id, nowISO()]
    );
    for (let i = 0; i < quantity; i++) {
      const unitId = 'unit_' + Math.random().toString(36).slice(2, 12) + Date.now().toString(36) + i;
      await db.runAsync(
        'INSERT INTO units (id,product_id,state) VALUES (?, ?, ?)',
        [unitId, pid, 'disponible']
      );
    }
  });
  return pid;
};

export const updateProduct = async ({ id, code, name, price, detail = null, supplier = null, section_id }) => {
  const normalizedCode = String(code || '').trim();
  const normalizedName = String(name || '').trim();
  const normalizedDetail = String(detail || '').trim() || null;
  const normalizedSupplier = String(supplier || '').trim() || null;
  const productPrice = Number(price);
  if (!id) throw new Error('Producto inválido');
  if (!normalizedCode || !normalizedName) throw new Error('El código y el nombre son obligatorios');
  if (!section_id) throw new Error('Selecciona una sección');
  if (!Number.isFinite(productPrice) || productPrice < 0) throw new Error('El precio debe ser un número válido no negativo');

  const db = await getDB();
  const dup = await db.getFirstAsync('SELECT id FROM products WHERE code = ? AND id != ?', [normalizedCode, id]);
  if (dup) throw new Error('Ya existe otro producto con ese código');
  const result = await db.runAsync(
    'UPDATE products SET code=?, name=?, price=?, detail=?, supplier=?, section_id=? WHERE id=?',
    [normalizedCode, normalizedName, productPrice, normalizedDetail, normalizedSupplier, section_id, id]
  );
  if (result.changes === 0) throw new Error('El producto ya no existe');
};

export const moveProductsToSection = async (product_ids, section_id) => {
  if (!Array.isArray(product_ids) || product_ids.length === 0) throw new Error('Selecciona al menos un producto');
  const db = await getDB();
  const sec = await db.getFirstAsync('SELECT id FROM sections WHERE id = ?', [section_id]);
  if (!sec) throw new Error('La sección destino no existe');
  const placeholders = product_ids.map(() => '?').join(',');
  const result = await db.runAsync(
    `UPDATE products SET section_id = ? WHERE id IN (${placeholders})`,
    [section_id, ...product_ids]
  );
  return result.changes;
};

export const deleteProduct = async (id) => {
  const db = await getDB();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM units WHERE product_id = ?', [id]);
    await db.runAsync('DELETE FROM products WHERE id = ?', [id]);
  });
};

export const addUnitsToProduct = async (product_id, qty) => {
  const quantity = Number(qty);
  if (!Number.isInteger(quantity) || quantity < 1) throw new Error('La cantidad debe ser un entero mayor que cero');
  const db = await getDB();
  const product = await db.getFirstAsync('SELECT id FROM products WHERE id = ?', [product_id]);
  if (!product) throw new Error('El producto ya no existe');
  await db.withTransactionAsync(async () => {
    for (let i = 0; i < quantity; i++) {
      const unitId = 'unit_' + Math.random().toString(36).slice(2, 12) + Date.now().toString(36) + i;
      await db.runAsync(
        'INSERT INTO units (id,product_id,state) VALUES (?, ?, ?)',
        [unitId, product_id, 'disponible']
      );
    }
  });
};

export const updateUnitState = async ({ unit_id, state, client_name = null }) => {
  const db = await getDB();
  const now = nowISO();
  if (state === 'reservado') {
    const result = await db.runAsync('UPDATE units SET state=?, client_name=?, reserved_at=?, sold_at=NULL WHERE id=?', [state, client_name, now, unit_id]);
    if (result.changes === 0) throw new Error('La unidad ya no existe');
    return;
  }
  if (state === 'vendido') {
    await db.withTransactionAsync(async () => {
      const unit = await db.getFirstAsync('SELECT * FROM units WHERE id=?', [unit_id]);
      if (!unit) throw new Error('La unidad ya no existe');
      const product = await db.getFirstAsync('SELECT * FROM products WHERE id=?', [unit.product_id]);
      if (!product) throw new Error('No se encontró el producto de esta unidad');
      await db.runAsync(
        'UPDATE units SET state=?, client_name=?, sold_at=?, reserved_at=NULL WHERE id=?',
        [state, client_name || unit.client_name || null, now, unit_id]
      );
      await db.runAsync(
        'INSERT INTO sales_log (id,unit_id,product_id,client_name,price,sold_at) VALUES (?,?,?,?,?,?)',
        ['sl_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36), unit_id, unit.product_id, client_name || unit.client_name || null, product.price || 0, now]
      );
    });
    return;
  }
  if (state !== 'disponible') throw new Error(`Estado de unidad inválido: ${state}`);
  const result = await db.runAsync('UPDATE units SET state=?, client_name=NULL, reserved_at=NULL, sold_at=NULL WHERE id=?', [state, unit_id]);
  if (result.changes === 0) throw new Error('La unidad ya no existe');
};

export const getProductsList = async (section_id = null, filter = 'all') => {
  const db = await getDB();
  let sql = `
    SELECT p.*,
      (SELECT COUNT(*) FROM units u WHERE u.product_id=p.id) as total,
      (SELECT COUNT(*) FROM units u WHERE u.product_id=p.id AND u.state='disponible') as disp,
      (SELECT COUNT(*) FROM units u WHERE u.product_id=p.id AND u.state='reservado') as resv,
      (SELECT COUNT(*) FROM units u WHERE u.product_id=p.id AND u.state='vendido') as vend
    FROM products p
  `;
  const where = [];
  const args = [];
  if (section_id) { where.push('p.section_id = ?'); args.push(section_id); }
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY p.name ASC';
  const list = await db.getAllAsync(sql, args);
  if (filter === 'all') return list;
  const out = [];
  for (const pr of list) {
    if (filter === 'disponible' && pr.disp > 0) out.push(pr);
    if (filter === 'reservado' && pr.resv > 0) out.push(pr);
    if (filter === 'vendido' && pr.vend > 0) out.push(pr);
  }
  return out;
};

export const getUnitsByProduct = async (product_id) => {
  const db = await getDB();
  return await db.getAllAsync('SELECT * FROM units WHERE product_id=? ORDER BY id ASC', [product_id]);
};

export const getMetrics = async () => {
  const db = await getDB();
  const d = await db.getFirstAsync("SELECT COUNT(*) as c FROM units WHERE state='disponible'");
  const r = await db.getFirstAsync("SELECT COUNT(*) as c FROM units WHERE state='reservado'");
  const v = await db.getFirstAsync("SELECT COUNT(*) as c FROM units WHERE state='vendido'");
  return { disponible: d.c, reservado: r.c, vendido: v.c };
};

export const getSalesHistory = async () => {
  const db = await getDB();
  return await db.getAllAsync(`
    SELECT sl.*, COALESCE(p.name, 'Producto eliminado') as product_name, COALESCE(p.code, '-') as product_code
    FROM sales_log sl
    LEFT JOIN products p ON p.id = sl.product_id
    ORDER BY sl.sold_at DESC
  `);
};

export const exportAll = async () => {
  const db = await getDB();
  const sections = await db.getAllAsync('SELECT * FROM sections');
  const products = await db.getAllAsync('SELECT * FROM products');
  const units = await db.getAllAsync('SELECT * FROM units');
  const sales_log = await db.getAllAsync('SELECT * FROM sales_log');
  return { version: 2, exported_at: nowISO(), sections, products, units, sales_log };
};

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isText = (value) => typeof value === 'string' && value.trim().length > 0;
const isNullableText = (value) => value === null || isText(value);
const isOptionalString = (value) => value === null || typeof value === 'string';
const isValidPrice = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0;

export const validateBackup = (data) => {
  if (!isRecord(data) || data.version !== 2 ||
      !Array.isArray(data.sections) || !Array.isArray(data.products) ||
      !Array.isArray(data.units) || !Array.isArray(data.sales_log)) {
    throw new Error('El archivo no tiene el formato de respaldo Avon compatible (versión 2).');
  }
  if (data.sections.length === 0) {
    throw new Error('El respaldo debe contener al menos una sección.');
  }

  const ids = { sections: new Set(), products: new Set(), units: new Set(), sales: new Set() };
  const sectionIds = new Set();
  const productById = new Map();
  const unitById = new Map();

  data.sections.forEach((section, index) => {
    if (!isRecord(section) || !isText(section.id) || !isText(section.name) ||
        !isOptionalString(section.emoji) || !isText(section.created_at) ||
        ids.sections.has(section.id)) {
      throw new Error(`La sección ${index + 1} tiene datos inválidos o repetidos.`);
    }
    ids.sections.add(section.id);
    sectionIds.add(section.id);
  });

  data.products.forEach((product, index) => {
    if (!isRecord(product) || !isText(product.id) || !isText(product.code) ||
        !isText(product.name) || !isValidPrice(product.price) ||
        !isOptionalString(product.detail) || !isOptionalString(product.supplier) ||
        !isText(product.created_at) || !sectionIds.has(product.section_id) ||
        ids.products.has(product.id)) {
      throw new Error(`El producto ${index + 1} tiene datos inválidos o referencias inexistentes.`);
    }
    ids.products.add(product.id);
    productById.set(product.id, product);
  });

  data.units.forEach((unit, index) => {
    if (!isRecord(unit) || !isText(unit.id) || !isText(unit.product_id) ||
        !['disponible', 'reservado', 'vendido'].includes(unit.state) ||
        !isOptionalString(unit.client_name) || !isNullableText(unit.reserved_at) ||
        !isNullableText(unit.sold_at) ||
        !productById.has(unit.product_id) || ids.units.has(unit.id)) {
      throw new Error(`La unidad ${index + 1} tiene datos inválidos o referencias inexistentes.`);
    }
    ids.units.add(unit.id);
    unitById.set(unit.id, unit);
  });

  data.sales_log.forEach((sale, index) => {
    if (!isRecord(sale) || !isText(sale.id) || !isText(sale.unit_id) ||
        !isText(sale.product_id) || !isOptionalString(sale.client_name) ||
        !isValidPrice(sale.price) || !isText(sale.sold_at) ||
        !productById.has(sale.product_id) || !unitById.has(sale.unit_id) ||
        unitById.get(sale.unit_id)?.product_id !== sale.product_id ||
        ids.sales.has(sale.id)) {
      throw new Error(`El registro de venta ${index + 1} tiene datos inválidos o referencias inexistentes.`);
    }
    ids.sales.add(sale.id);
  });
};

export const importAll = async (data) => {
  validateBackup(data);
  const db = await getDB();

  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM sales_log');
    await db.runAsync('DELETE FROM units');
    await db.runAsync('DELETE FROM products');
    await db.runAsync('DELETE FROM sections');

    for (const section of data.sections) {
      await db.runAsync(
        'INSERT INTO sections (id,name,emoji,created_at) VALUES (?,?,?,?)',
        [section.id, section.name, section.emoji || '📦', section.created_at]
      );
    }
    for (const product of data.products) {
      await db.runAsync(
        'INSERT INTO products (id,code,name,price,detail,supplier,section_id,created_at) VALUES (?,?,?,?,?,?,?,?)',
        [product.id, product.code, product.name, product.price, product.detail ?? null, product.supplier ?? null, product.section_id, product.created_at]
      );
    }
    for (const unit of data.units) {
      await db.runAsync(
        'INSERT INTO units (id,product_id,state,client_name,reserved_at,sold_at) VALUES (?,?,?,?,?,?)',
        [unit.id, unit.product_id, unit.state, unit.client_name ?? null, unit.reserved_at ?? null, unit.sold_at ?? null]
      );
    }
    for (const sale of data.sales_log) {
      await db.runAsync(
        'INSERT INTO sales_log (id,unit_id,product_id,client_name,price,sold_at) VALUES (?,?,?,?,?,?)',
        [sale.id, sale.unit_id, sale.product_id, sale.client_name ?? null, sale.price, sale.sold_at]
      );
    }
  });
};
