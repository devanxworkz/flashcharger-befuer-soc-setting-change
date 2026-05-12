import { useEffect, useState } from "react";
import ChargerDetails from "../components/ChargerDetails";
import { useParams, useNavigate } from "react-router-dom";

const HASURA_URL = "https://ocpp.rivotmotors.com/v1/graphql";
const HASURA_ADMIN_SECRET = "CitrineOS!";

export default function MainFlow() {

  const { chargerId, connectorId } = useParams();
  const navigate = useNavigate();

  const [connectorStatus, setConnectorStatus] = useState(null);
  const [chargerOnline, setChargerOnline] = useState(false);
  const [vehicleModel, setVehicleModel] = useState(null);
  const [displayStatus, setDisplayStatus] = useState(null);
  const mySession = sessionStorage.getItem("mySession");

  // ================= PAYMENT SUCCESS =================
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get("payment");
    const checkoutId = params.get("checkout_id");
    const mySession = sessionStorage.getItem("mySession");

    if (paymentStatus?.startsWith("success")) {

      sessionStorage.setItem("mySession", checkoutId);

      fetch("https://ocpp.rivotmotors.com/api/payment-success", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkout_id: checkoutId }),
      });

      navigate(`/${chargerId}/${connectorId}/charging/${checkoutId}`);
    }

  }, [chargerId, connectorId, navigate]);

  // ================= LIVE STATUS =================
  useEffect(() => {

    let isActive = true;

    const fetchStatus = async () => {

      if (!isActive) return;

      try {
        const res = await fetch(HASURA_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-hasura-admin-secret": HASURA_ADMIN_SECRET,
          },
          body: JSON.stringify({
            query: `
              query GetLiveStatus($stationId: String!, $connectorId: Int!) {
                ChargingStations(where: {id: {_eq: $stationId}}) { isOnline }
                Connectors(where: {stationId: {_eq: $stationId}, connectorId: {_eq: $connectorId}}) {
                  status
                }
                vehicledata(where: {stationid: {_eq: $stationId}}, order_by: {created_at: desc}, limit: 1) {
                  model
                }
              }
            `,
            variables: {
              stationId: chargerId,
              connectorId: Number(connectorId),
            },
          }),
        });

        const result = await res.json();

        const charger = result.data?.ChargingStations?.[0];
        const connector = result.data?.Connectors?.[0];
        const latestVehicle = result.data?.vehicledata?.[0];

        const isOnline = !!charger?.isOnline;
        const status = connector?.status?.trim().toLowerCase() || "unknown";

        const displayStatus =
          status === "preparing" ? "Plugged In" : status;

        setChargerOnline(isOnline);
        setConnectorStatus(status);
        setDisplayStatus(displayStatus);
        setVehicleModel(latestVehicle?.model || null);

        // 🚀 AUTO NAVIGATION
    //  if (status === "finishing" && mySession) {
    //   navigate(`/${chargerId}/${connectorId}/completed`);
    //   }

    // if (status === "available" && mySession) {
    //   navigate(`/${chargerId}/${connectorId}/summary`);
    // }
      } catch (err) {
        console.error("Error:", err);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);

    return () => {
      isActive = false;
      clearInterval(interval);
    };

  }, [chargerId, connectorId, navigate]);

  // ================= UI =================

  if (!chargerId) {
    return <div style={{ color: "#fff" }}>Loading charger...</div>;
  }

  return (
    <ChargerDetails
      data={{
        stationName: "flashCharge",
        chargerId,
        powerRating: 11,
        connector: "Type-6",
        rate: 18,
        location: "Located near the main entrance parking lot",
        status: chargerOnline ? displayStatus : "Offline",
      }}
      onProceed={() =>
        navigate(`/${chargerId}/${connectorId}/preferences`)
      }
    />
  );
}