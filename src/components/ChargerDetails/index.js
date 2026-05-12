import "./details.css";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

/* 🔥 SINGLE SOURCE OF TRUTH */
function useChargerStatus(chargerId, connectorId) {
  const [status, setStatus] = useState({
    online: false,
    locked: false,
    vehicle: false,
  });

  useEffect(() => {
    let active = true;

    const fetchData = async () => {
      try {
        const res = await fetch("https://ocpp.rivotmotors.com/v1/graphql", {
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
                }
                vehicledata(where: { stationid: { _eq: $stationId } }, limit: 1, order_by: { created_at: desc }) {
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

        const json = await res.json();
        if (!active) return;

        const isOnline = json.data?.ChargingStations?.[0]?.isOnline;
        const connectorStatus =
          json.data?.Connectors?.[0]?.status?.toLowerCase();
        const vehicle = json.data?.vehicledata?.[0]?.model;

        const locked =
          connectorStatus === "preparing" ||
          connectorStatus === "charging";

        const vehicleDetected = !!vehicle;

        setStatus({
          online: isOnline,
          locked,
          vehicle: vehicleDetected,
        });
      } catch (e) {
        console.error(e);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000); // ✅ 5 sec polling

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [chargerId, connectorId]);

  return status;
}


export default function ChargerDetails({ data, onProceed = () => {} }) {
  const { chargerId, connectorId } = useParams();

  const [step, setStep] = useState(1);
  // const [checkingDone, setCheckingDone] = useState(false);
  const [isStepDone, setIsStepDone] = useState(false);

  const [status, setStatus] = useState({
    online: null,
    connectorStatus: null,
  });

  // 🔥 MAIN LOGIC (ONLY SOURCE OF TRUTH)
useEffect(() => {
  let interval;

  const fetchStatus = async () => {
    try {
      const res = await fetch("https://ocpp.rivotmotors.com/v1/graphql", {
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
            }
          }`,
          variables: {
            stationId: chargerId,
            connectorId: Number(connectorId),
          },
        }),
      });

      const json = await res.json();

      const isOnline = json.data?.ChargingStations?.[0]?.isOnline;
      const connectorStatus =
        json.data?.Connectors?.[0]?.status?.toLowerCase();

      setStatus({
  online: isOnline,
  connectorStatus,
});
      // ✅ Done only if everything is OK
      // if (isOnline && isConnected) {
      //   setCheckingDone(true);
      // } else {
      //   setCheckingDone(false);
      // }

    } catch (e) {
      console.error(e);
    }
  };

  fetchStatus();
  interval = setInterval(fetchStatus, 3000);

  return () => clearInterval(interval);
}, []);

// 👇 AUTO SCROLL EFFECT
useEffect(() => {
  if (
    status.connectorStatus === "preparing" ||
    status.connectorStatus === "charging" ||
    status.connectorStatus === "finishing"
  ) {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }
}, [status.connectorStatus]);

  const handleProceed = () => {
    if (typeof onProceed === "function") {
      onProceed(data.status?.toLowerCase() || "available");
    }
  };

  return (
    <div className="pref-containersss">

      {/* 🔥 OVERLAY */}
        {/* 🔥 OVERLAY LOGIC BASED ON STATUS */}

{/* ❌ OFFLINE */}
{status.online === false && (
  <div className="overlay">
    <div className="overlayContent">
      <div className="errorCircle">!</div>
      <h2 className="overlayTitle">Charger Offline</h2>
      <p>Please try again after some time</p>
    </div>
  </div>
)}

{/* 🟡 AVAILABLE */}
{status.online && status.connectorStatus === "available" && (
  <div className="overlay">
    <div className="overlayContent">
      <p className="overlaySubHighlight">
        Please connect the connector to the vehicle
      </p>
      <div className="loaderBig"></div>
    </div>
  </div>
)}

{/* ⚡ CHARGING */}
{status.connectorStatus === "charging" && (
  <div className="overlay">
    <div className="overlayContent">
      <p className="overlaySubHighlight">
        Please wait, charging is in progress...
      </p>
      <div className="loaderBig"></div>
    </div>
  </div>
)}

{/* ✅ FINISHING */}
{status.connectorStatus === "finishing" && (
  <div className="overlay">
    <div className="overlayContent">
      <h2 className="overlayTitleforcharging">Charging Completed Successfully</h2>
      <p className="primaryText1">
          Please disconnect the charging gun
        </p>
      <div className="loaderBig"></div>
      <p className="overlaySubHighlight">
        Waiting for disconnection...
      </p>
    </div>
  </div>
)}
      <div>
        <div className="screen">

          <header className="topbarssss">
            <h2 className="title">Charger Details</h2>
          </header>

          <main className="main">

            <div className="heroCard">
              <div
                className="heroImage"
                style={{ backgroundImage: "url(/flsahcharger.png)" }}
              >
                <div className="imageOverlay"></div>
                <div className="badge">
                  <div className="pulse"></div>
                  {data.status}
                </div>
              </div>

              <div className="stationInfo">
                <span className="nodeTag">SUPERCHARGER NODE</span>
                <h1 className="stationName">{data.stationName}</h1>
                <p className="stationId">ID: {data.chargerId}</p>
              </div>
            </div>

            <div className="specGrid">
              <div className="specCard">
                <div className="specIcon">
                  <span className="material-symbols-outlined">bolt</span>
                </div>
                <div>
                  <p className="specLabel">POWER RATING</p>
                  <p className="specValue">{data.powerRating}kW</p>
                </div>
              </div>

              <div className="specCard">
                <div className="specIcon">
                  <span className="material-symbols-outlined">ev_charger</span>
                </div>
                <div>
                  <p className="specLabel">CONNECTOR</p>
                  <p className="specValue">{data.connector}</p>
                </div>
              </div>
            </div>

            <h3 className="sectionTitle">BILLING DETAILS</h3>
            <div className="billingCard">
              <div className="billingRow">
                <div className="billingLeft">
                  <div className="billingIcon">
                    <span className="material-symbols-outlined">payments</span>
                  </div>
                  <div>
                    <p className="billingTitle">Charging Rate</p>
                    <p className="billingSub">Standard outdoor rate</p>
                  </div>
                </div>
                <div className="billingPrice">
                  ₹{data.rate}<span>/kWh</span>
                </div>
              </div>

              <div className="billingRow">
                <div className="billingLeft">
                  <div className="billingIcon">
                    <span className="material-symbols-outlined">credit_card</span>
                  </div>
                  <div>
                    <p className="billingTitle">Secure Payment</p>
                    <p className="billingSub">Safe & encrypted transaction</p>
                  </div>
                </div>
                <span className="material-symbols-outlined successIcon">
                  done_all
                </span>
              </div>
            </div>

            <div className="locationNote">
              <span className="material-symbols-outlined locationIcon">
                location_on
              </span>
              <p>{data.location}</p>
            </div>
          </main>

          <div>
            <button
              className="ctaButton"
              onClick={handleProceed}
              disabled={
                !status.online ||
                status.connectorStatus === "charging" ||
                status.connectorStatus === "finishing"
              }
            >
              <span className="material-symbols-outlined">
                electric_bolt
              </span>
              Proceed to Charge
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}