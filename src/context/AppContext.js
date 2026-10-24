import React, { createContext, useContext, useEffect, useState } from 'react';
import { getMetrics } from '../db/database';

const AppCtx = createContext();

export const AppProvider = ({ children }) => {
  const [metrics, setMetrics] = useState({ disponible: 0, reservado: 0, vendido: 0 });
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    const m = await getMetrics();
    setMetrics(m);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  return (
    <AppCtx.Provider value={{ metrics, refresh, loading }}>
      {children}
    </AppCtx.Provider>
  );
};

export const useApp = () => useContext(AppCtx);
