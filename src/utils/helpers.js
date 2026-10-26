export const formatMoney = (v) => {
  const n = Number(v || 0);
  return `$${n.toFixed(2)}`;
};

export const countUnits = (units) => {
  const c = { total: Array.isArray(units) ? units.length : 0, disponible: 0, reservado: 0, vendido: 0 };
  for (const u of units || []) {
    if (c[u.state] !== undefined) c[u.state]++;
  }
  return c;
};

export const nowISO = () => new Date().toISOString();

export const uid = () => {
  return 'id_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
};
