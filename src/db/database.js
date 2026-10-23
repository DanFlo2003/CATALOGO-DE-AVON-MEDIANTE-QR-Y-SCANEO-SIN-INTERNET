import * as SQLite from 'expo-sqlite';

let db = null;

export const getDB = async () => {
  if (db) return db;
  db = await SQLite.openDatabaseAsync('avon_catalogo.db');
  await initDB(db);
  return db;
};

const initDB = async (database) => {
  await database.execAsync(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS campaigns (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      active INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY NOT NULL,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      price REAL DEFAULT 0,
      campaign_id TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
    );

    CREATE TABLE IF NOT EXISTS units (
      id TEXT PRIMARY KEY NOT NULL,
      product_id TEXT NOT NULL,
      state TEXT CHECK(state IN ('disponible','reservado','vendido')) DEFAULT 'disponible',
      client_name TEXT,
      reserved_at TEXT,
      sold_at TEXT,
      campaign_id TEXT,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
    );

    CREATE TABLE IF NOT EXISTS sales_log (
      id TEXT PRIMARY KEY NOT NULL,
      unit_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      campaign_id TEXT,
      client_name TEXT,
      price REAL DEFAULT 0,
      sold_at TEXT NOT NULL
    );
  `);

  const res = await database.getFirstAsync('SELECT COUNT(*) as c FROM campaigns;');
  if (res.c === 0) {
    const now = new Date().toISOString();
    await database.runAsync(
      'INSERT INTO campaigns (id,name,active,created_at) VALUES (?,?,1,?)',
      ['camp_default', 'Campaña 1', now]
    );
  }
};

// Campaigns
export const getCampaigns = async () => {
  const db = await getDB();
  return await db.getAllAsync('SELECT * FROM campaigns ORDER BY created_at ASC');
};

export const getActiveCampaign = async () => {
  const db = await getDB();
  const c = await db.getFirstAsync('SELECT * FROM campaigns WHERE active = 1 LIMIT 1');
  if (c) return c;
  const all = await getCampaigns();
  if (all[0]) {
    await setActiveCampaign(all[0].id);
    return all[0];
  }
  return null;
};

export const setActiveCampaign = async (id) => {
  const db = await getDB();
  await db.withExclusiveTransactionAsync(async (transaction) => {
    const campaign = await transaction.getFirstAsync('SELECT id FROM campaigns WHERE id = ?', [id]);
    if (!campaign) throw new Error('La campaña seleccionada no existe');
    await transaction.runAsync('UPDATE campaigns SET active = CASE WHEN id = ? THEN 1 ELSE 0 END', [id]);
  });
};

export const createCampaign = async (name) => {
  const normalizedName = String(name || '').trim();
  if (!normalizedName) throw new Error('El nombre de campaña es obligatorio');
  const db = await getDB();
  const id = 'camp_' + Math.random().toString(36).slice(2,10) + Date.now().toString(36);
  const now = new Date().toISOString();
  await db.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.runAsync('UPDATE campaigns SET active = 0');
    await transaction.runAsync('INSERT INTO campaigns (id,name,active,created_at) VALUES (?,?,1,?)', [id, normalizedName, now]);
  });
  return id;
};

// Products + Units
export const findProductByCode = async (code) => {
  const db = await getDB();
  const p = await db.getFirstAsync('SELECT * FROM products WHERE code = ?', [code]);
  if (!p) return null;
  const units = await db.getAllAsync('SELECT * FROM units WHERE product_id = ? ORDER BY id ASC', [p.id]);
  return { product: p, units };
};

export const createProductWithUnits = async ({ code, name, price, qty, campaign_id }) => {
  const normalizedCode = String(code || '').trim();
  const normalizedName = String(name || '').trim();
  const quantity = Number(qty);
  const productPrice = Number(price || 0);
  if (!normalizedCode || !normalizedName) throw new Error('El código y el nombre son obligatorios');
  if (!Number.isInteger(quantity) || quantity < 1) throw new Error('La cantidad debe ser un entero mayor que cero');
  if (!Number.isFinite(productPrice) || productPrice < 0) throw new Error('El precio debe ser un número válido no negativo');
  if (!campaign_id) throw new Error('Selecciona una campaña activa');

  const db = await getDB();
  const pid = 'prod_' + Math.random().toString(36).slice(2,10) + Date.now().toString(36);
  const now = new Date().toISOString();
  await db.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.runAsync(
      'INSERT INTO products (id,code,name,price,campaign_id,created_at) VALUES (?,?,?,?,?,?)',
      [pid, normalizedCode, normalizedName, productPrice, campaign_id, now]
    );
    for (let i = 0; i < quantity; i++) {
      const unitId = 'unit_' + Math.random().toString(36).slice(2, 12) + Date.now().toString(36) + i;
      await transaction.runAsync(
        'INSERT INTO units (id,product_id,state,campaign_id) VALUES (?, ?, ?, ?)',
        [unitId, pid, 'disponible', campaign_id]
      );
    }
  });
  return pid;
};

export const updateUnitState = async ({ unit_id, state, client_name = null, campaign_id = null }) => {
  const db = await getDB();
  const now = new Date().toISOString();
  if (state === 'reservado') {
    const result = await db.runAsync('UPDATE units SET state=?, client_name=?, reserved_at=?, sold_at=NULL WHERE id=?', [state, client_name, now, unit_id]);
    if (result.changes === 0) throw new Error('La unidad ya no existe');
    return;
  }
  if (state === 'vendido') {
    await db.withExclusiveTransactionAsync(async (transaction) => {
      const unit = await transaction.getFirstAsync('SELECT * FROM units WHERE id=?', [unit_id]);
      if (!unit) throw new Error('La unidad ya no existe');
      const product = await transaction.getFirstAsync('SELECT * FROM products WHERE id=?', [unit.product_id]);
      if (!product) throw new Error('No se encontró el producto de esta unidad');
      await transaction.runAsync(
        'UPDATE units SET state=?, client_name=?, sold_at=?, reserved_at=NULL WHERE id=?',
        [state, client_name || unit.client_name || null, now, unit_id]
      );
      await transaction.runAsync(
        'INSERT INTO sales_log (id,unit_id,product_id,campaign_id,client_name,price,sold_at) VALUES (?,?,?,?,?,?,?)',
        ['sl_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36), unit_id, unit.product_id, unit.campaign_id || campaign_id, client_name || unit.client_name || null, product.price || 0, now]
      );
    });
    return;
  }
  if (state !== 'disponible') throw new Error(`Estado de unidad inválido: ${state}`);
  const result = await db.runAsync('UPDATE units SET state=?, client_name=NULL, reserved_at=NULL, sold_at=NULL WHERE id=?', [state, unit_id]);
  if (result.changes === 0) throw new Error('La unidad ya no existe');
};

export const getProductsList = async (campaign_id = null, filter = 'all') => {
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
  if (campaign_id) { where.push('p.campaign_id = ?'); args.push(campaign_id); }
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY p.name ASC';
  const list = await db.getAllAsync(sql, args);
  if (filter === 'all') return list;
  const out = [];
  for (const pr of list) {
    if (filter === 'disponible' && pr.disp>0) out.push(pr);
    if (filter === 'reservado' && pr.resv>0) out.push(pr);
    if (filter === 'vendido' && pr.vend>0) out.push(pr);
  }
  return out;
};

export const getUnitsByProduct = async (product_id) => {
  const db = await getDB();
  return await db.getAllAsync('SELECT * FROM units WHERE product_id=? ORDER BY id ASC', [product_id]);
};

export const getMetrics = async (campaign_id) => {
  const db = await getDB();
  const d = await db.getFirstAsync("SELECT COUNT(*) as c FROM units WHERE campaign_id=? AND state='disponible'", [campaign_id]);
  const r = await db.getFirstAsync("SELECT COUNT(*) as c FROM units WHERE campaign_id=? AND state='reservado'", [campaign_id]);
  const v = await db.getFirstAsync("SELECT COUNT(*) as c FROM units WHERE campaign_id=? AND state='vendido'", [campaign_id]);
  return { disponible: d.c, reservado: r.c, vendido: v.c };
};

export const getSalesHistory = async (campaign_id = null) => {
  const db = await getDB();
  let sql = `
    SELECT sl.*, p.name as product_name, p.code as product_code, c.name as campaign_name
    FROM sales_log sl
    LEFT JOIN products p ON p.id = sl.product_id
    LEFT JOIN campaigns c ON c.id = sl.campaign_id
  `;
  const args = [];
  if (campaign_id) { sql += ' WHERE sl.campaign_id = ?'; args.push(campaign_id); }
  sql += ' ORDER BY sl.sold_at DESC';
  return await db.getAllAsync(sql, args);
};

export const exportAll = async () => {
  const db = await getDB();
  const campaigns = await db.getAllAsync('SELECT * FROM campaigns');
  const products = await db.getAllAsync('SELECT * FROM products');
  const units = await db.getAllAsync('SELECT * FROM units');
  const sales_log = await db.getAllAsync('SELECT * FROM sales_log');
  return { version: 1, exported_at: new Date().toISOString(), campaigns, products, units, sales_log };
};

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isText = (value) => typeof value === 'string' && value.trim().length > 0;
const isNullableText = (value) => value === null || isText(value);
const isOptionalString = (value) => value === null || typeof value === 'string';
const isValidPrice = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0;

export const validateBackup = (data) => {
  if (!isRecord(data) || data.version !== 1 ||
      !Array.isArray(data.campaigns) || !Array.isArray(data.products) ||
      !Array.isArray(data.units) || (data.sales_log !== undefined && !Array.isArray(data.sales_log))) {
    throw new Error('El archivo no tiene el formato de respaldo Avon compatible (versión 1).');
  }
  if (data.campaigns.length === 0 || data.campaigns.filter(campaign => isRecord(campaign) && [1, true].includes(campaign.active)).length !== 1) {
    throw new Error('El respaldo debe contener campañas y exactamente una campaña activa.');
  }

  const ids = {
    campaigns: new Set(),
    products: new Set(),
    units: new Set(),
    sales: new Set(),
  };
  const campaignIds = new Set();
  const productById = new Map();
  const unitById = new Map();
  const unitIds = new Set();

  data.campaigns.forEach((campaign, index) => {
    if (!isRecord(campaign) || !isText(campaign.id) || !isText(campaign.name) ||
        !isText(campaign.created_at) || ![0, 1, false, true].includes(campaign.active) ||
        ids.campaigns.has(campaign.id)) {
      throw new Error(`La campaña ${index + 1} tiene datos inválidos o repetidos.`);
    }
    ids.campaigns.add(campaign.id);
    campaignIds.add(campaign.id);
  });

  data.products.forEach((product, index) => {
    if (!isRecord(product) || !isText(product.id) || !isText(product.code) ||
        !isText(product.name) || !isValidPrice(product.price) ||
        !isText(product.created_at) ||
        !(product.campaign_id === null || campaignIds.has(product.campaign_id)) ||
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
        !(unit.campaign_id === null || campaignIds.has(unit.campaign_id)) ||
        !productById.has(unit.product_id) || ids.units.has(unit.id) ||
        unit.campaign_id !== productById.get(unit.product_id).campaign_id) {
      throw new Error(`La unidad ${index + 1} tiene datos inválidos o referencias inexistentes.`);
    }
    ids.units.add(unit.id);
    unitIds.add(unit.id);
    unitById.set(unit.id, unit);
  });

  (data.sales_log || []).forEach((sale, index) => {
    if (!isRecord(sale) || !isText(sale.id) || !isText(sale.unit_id) ||
        !isText(sale.product_id) || !isNullableText(sale.campaign_id) ||
        !isOptionalString(sale.client_name) || !isValidPrice(sale.price) ||
        !isText(sale.sold_at) || !unitIds.has(sale.unit_id) ||
        !productById.has(sale.product_id) ||
        unitById.get(sale.unit_id)?.product_id !== sale.product_id ||
        !(sale.campaign_id === null || campaignIds.has(sale.campaign_id)) ||
        ids.sales.has(sale.id)) {
      throw new Error(`El registro de venta ${index + 1} tiene datos inválidos o referencias inexistentes.`);
    }
    ids.sales.add(sale.id);
  });
};

export const importAll = async (data) => {
  validateBackup(data);
  const db = await getDB();

  await db.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.runAsync('DELETE FROM sales_log');
    await transaction.runAsync('DELETE FROM units');
    await transaction.runAsync('DELETE FROM products');
    await transaction.runAsync('DELETE FROM campaigns');

    for (const campaign of data.campaigns) {
      await transaction.runAsync(
        'INSERT INTO campaigns (id,name,active,created_at) VALUES (?,?,?,?)',
        [campaign.id, campaign.name, campaign.active ? 1 : 0, campaign.created_at]
      );
    }
    for (const product of data.products) {
      await transaction.runAsync(
        'INSERT INTO products (id,code,name,price,campaign_id,created_at) VALUES (?,?,?,?,?,?)',
        [product.id, product.code, product.name, product.price, product.campaign_id, product.created_at]
      );
    }
    for (const unit of data.units) {
      await transaction.runAsync(
        'INSERT INTO units (id,product_id,state,client_name,reserved_at,sold_at,campaign_id) VALUES (?,?,?,?,?,?,?)',
        [unit.id, unit.product_id, unit.state, unit.client_name, unit.reserved_at, unit.sold_at, unit.campaign_id]
      );
    }
    for (const sale of data.sales_log || []) {
      await transaction.runAsync(
        'INSERT INTO sales_log (id,unit_id,product_id,campaign_id,client_name,price,sold_at) VALUES (?,?,?,?,?,?,?)',
        [sale.id, sale.unit_id, sale.product_id, sale.campaign_id, sale.client_name, sale.price, sale.sold_at]
      );
    }
  });
};
