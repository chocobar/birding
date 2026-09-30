'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';

interface MapOpenContextValue {
  openMapId: string | null;
  openMap: (id: string) => void;
  closeMap: () => void;
}

const MapOpenContext = createContext<MapOpenContextValue | null>(null);

export function MapOpenProvider({ children }: { children: React.ReactNode }) {
  const [openMapId, setOpenMapId] = useState<string | null>(null);

  const openMap = useCallback((id: string) => setOpenMapId(id), []);
  const closeMap = useCallback(() => setOpenMapId(null), []);

  const value = useMemo(
    () => ({ openMapId, openMap, closeMap }),
    [openMapId, openMap, closeMap],
  );

  return <MapOpenContext.Provider value={value}>{children}</MapOpenContext.Provider>;
}

export function useMapOpen(): MapOpenContextValue {
  const ctx = useContext(MapOpenContext);
  if (!ctx) throw new Error('useMapOpen must be used within MapOpenProvider');
  return ctx;
}
