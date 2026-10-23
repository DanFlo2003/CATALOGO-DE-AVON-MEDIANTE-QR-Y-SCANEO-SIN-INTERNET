import React, { createContext, useContext, useEffect, useState } from 'react';
import { getActiveCampaign, getCampaigns, setActiveCampaign as setAct, createCampaign, getMetrics } from '../db/database';

const AppCtx = createContext();

export const AppProvider = ({ children }) => {
  const [campaigns, setCampaigns] = useState([]);
  const [active, setActive] = useState(null);
  const [metrics, setMetrics] = useState({ disponible:0, reservado:0, vendido:0 });
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    const list = await getCampaigns();
    setCampaigns(list);
    const a = await getActiveCampaign();
    setActive(a);
    if (a) {
      const m = await getMetrics(a.id);
      setMetrics(m);
    } else {
      setMetrics({ disponible: 0, reservado: 0, vendido: 0 });
    }
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  const changeActive = async (id) => {
    await setAct(id);
    await refresh();
  };

  const addCampaign = async (name) => {
    await createCampaign(name);
    await refresh();
  };

  return (
    <AppCtx.Provider value={{ campaigns, active, metrics, refresh, changeActive, addCampaign, loading }}>
      {children}
    </AppCtx.Provider>
  );
};

export const useApp = () => useContext(AppCtx);
