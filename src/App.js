import { BrowserRouter, Routes, Route } from "react-router-dom";
import MainFlow from "./MainFlow";
import SessionSummary from "./components/SessionSummary";
import ThankYou from "./components/ThankYou";
import ChargingPreferences from "./components/ChargingPreferences";
import ConnectionStatus from "./components/ConnectionStatus";
import ChargerStartandStop from "./components/ChargerStartandStop";
import { ChargerProvider } from "./ChargerContext";
import ChargingCompleted from "./components/ChargingCompleted";

export default function App() {
  return (
    <ChargerProvider>
      <BrowserRouter>
        <Routes>

          <Route path="/:chargerId/:connectorId" element={<MainFlow />} />

          <Route path="/:chargerId/:connectorId/preparing" element={<ConnectionStatus />} />

          <Route path="/:chargerId/:connectorId/preferences" element={<ChargingPreferences />} />

        {/* ✅ ADD sessionId */}
  <Route path="/:chargerId/:connectorId/charging/:sessionId" element={<ChargerStartandStop />} />
  
  {/* ✅ ADD sessionId */}
  <Route path="/:chargerId/:connectorId/completed/:sessionId" element={<ChargingCompleted />} />

  {/* ✅ ADD sessionId */}
  <Route path="/:chargerId/:connectorId/summary/:sessionId" element={<SessionSummary />} />

          <Route path="/:chargerId/:connectorId/thank-you" element={<ThankYou />} />

        </Routes>
      </BrowserRouter>
    </ChargerProvider>
  );
}