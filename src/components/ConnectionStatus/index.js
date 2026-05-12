import { useEffect, useState } from "react";
import "./index.css";
import { useCharger } from "../../ChargerContext";
import { useNavigate } from "react-router-dom";
import { useParams } from "react-router-dom";

export default function ConnectionStatus({ onContinue, onBack}) {
  // const { chargerId } = useCharger();
// const CONNECTOR_ID = 1; // keep this
const navigate = useNavigate();
  const [chargerOnline, setChargerOnline] = useState(false);
  const [connectorStatus, setConnectorStatus] = useState("checking");
  const [vehicleModel, setVehicleModel] = useState(null);
  const [finalStatus, setFinalStatus] = useState("CHECKING");
  const TEST_MODE = true;
  const allowedModels = ["Classic", "Pro", "Offlander", "Max"];
 const { chargerId, connectorId } = useParams();
const CONNECTOR_ID = Number(connectorId);

  useEffect(() => {
    let isActive = true;
    const fetchData = async () => {
      if (!isActive) return;
      try {

        const response = await fetch("https://ocpp.rivotmotors.com/v1/graphql", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-hasura-admin-secret": "CitrineOS!",
          },
          body: JSON.stringify({
            query: `
            query GetLiveStatus($stationId: String!, $connectorId: Int!) {
              ChargingStations(where: { id: { _eq: $stationId } }) {
                isOnline
              }
              Connectors(where: { stationId: { _eq: $stationId }, connectorId: { _eq: $connectorId } }) {
                status
                updatedAt
              }
              vehicledata(where: { stationid: { _eq: $stationId } }, order_by: { created_at: desc }, limit: 1) {
                model
              }
            }`,
           variables: {
          stationId: chargerId,
          connectorId: CONNECTOR_ID
        }
          }),
        });

        const result = await response.json();

        const charger = result.data?.ChargingStations?.[0];
        const connector = result.data?.Connectors?.[0];
        const latestVehicle = result.data?.vehicledata?.[0];

        setChargerOnline(!!charger?.isOnline);

        const status = connector?.status?.trim().toLowerCase() || "checking";
        setConnectorStatus(status);

        setVehicleModel(latestVehicle?.model || null);

        if (!charger?.isOnline || !connector) setFinalStatus("OFFLINE");
        else if (status === "preparing") setFinalStatus("READY");
        else if (status === "available") setFinalStatus("AVAILABLE");
        else if (status === "charging") setFinalStatus("CHARGING");
        else if (status === "faulted") setFinalStatus("FAULTED");
        else setFinalStatus("UNAVAILABLE");

      } catch (err) {

        console.error("API error:", err);
        setFinalStatus("OFFLINE");

      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => {
      isActive = false;
      clearInterval(interval);
    };

  }, []);

  const connectorLocked =
    connectorStatus === "preparing" ||
    connectorStatus === "charging";

  const vehicleDetected = 
    TEST_MODE || (vehicleModel && allowedModels.includes(vehicleModel));

  const canContinue =
    chargerOnline &&
    connectorLocked &&
    vehicleDetected;

  return (
    <div className="ev-screen">

      {/* HEADER */}

      <div className="ev-header">
        <div className="back-btn" onClick={() => navigate(`/${chargerId}/${connectorId}`)}>
  <span className="material-symbols-outlined">arrow_back</span>
</div>
      </div>
      <div className="ev-center">
        <div className="ev-circle">
          <span className="material-symbols-outlined main-icon">
            ev_station
          </span>
          <div className="sync-icon">
            <span className="material-symbols-outlined">
              sync
            </span>
          </div>
        </div>
      </div>

      <h1>Establishing Connection</h1>

      <p className="ev-sub">
        Please stay near your vehicle until the digital handshake is complete.
      </p>
      <div className="ev-status-list">
        <div className={`status-card ${chargerOnline ? "success" : "detecting"}`}>

          <div className="status-icon">
            <span className="material-symbols-outlined">
              {chargerOnline ? "check_circle" : "cloud_off"}
            </span>
          </div>

          <div className="status-text">
            <strong>Charger Online</strong>
            <p>
              {chargerOnline
                ? "Cloud connection established"
                : "Waiting for charger online"}
            </p>
          </div>

          {chargerOnline
            ? <span className="material-symbols-outlined tick">done_all</span>
            : <div className="loader"></div>}

        </div>

        <div className={`status-card ${connectorLocked ? "success" : "detecting"}`}>
          <div className="status-icon">
            <span className="material-symbols-outlined">lock</span>
          </div>
          <div className="status-text">
            <strong>Connector Locked</strong>
            <p>
              {connectorLocked
                ? "Mechanical lock engaged"
                : "Please connect the connector to the vehicle"}
            </p>
          </div>
          {connectorLocked
            ? <span className="material-symbols-outlined tick">done_all</span>
            : <div className="loader"></div>}

        </div>
        <div className={`status-card ${vehicleDetected ? "success" : "detecting active-detect"}`}>
          <div className="status-icon">
            <span className="material-symbols-outlined">
              electric_car
            </span>
          </div>

          <div className="status-text">
            <strong>Detecting Vehicle</strong>
            <p>
              {vehicleDetected
                ? "Vehicle detected"
                : "Syncing battery state..."}
            </p>
          </div>

          {vehicleDetected
            ? <span className="material-symbols-outlined tick">done_all</span>
            : <div className="loader"></div>}

        </div>
      </div>
      <div className="ev-footer">
        <button
          disabled={!canContinue}
        onClick={() => {
          if (canContinue) {
            navigate(`/${chargerId}/${connectorId}/preferences`);
          }
        }}
          className={`ev-btn ${canContinue ? "active" : ""}`}
        >
          Continue
          <span className="material-symbols-outlined">chevron_right</span>
        </button>
        <p className="ev-note">
          Emergency Stop available on physical unit
        </p>
      </div>
    </div>
  );
}