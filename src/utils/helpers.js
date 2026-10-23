export const formatMoney = (v) => {
  const n = Number(v || 0);
  return `$${n.toFixed(2)}`;
};

export const nowISO = () => new Date().toISOString();

export const uid = () => {
  return 'id_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
};
