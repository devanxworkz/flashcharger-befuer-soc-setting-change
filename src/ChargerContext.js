import { createContext, useContext, useState } from "react";
const ChargerContext = createContext();

export function ChargerProvider({ children }) {
  const [chargerId, setChargerId] = useState(null);
  const [tenantId, setTenantId] = useState(null);

  return (
    <ChargerContext.Provider
      value={{
        chargerId,
        setChargerId,
        tenantId,
        setTenantId,
      }}
    >
      {children}
    </ChargerContext.Provider>
  );
}

export function useCharger() {
  return useContext(ChargerContext);
}