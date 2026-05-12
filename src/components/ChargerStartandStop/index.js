import React, { useEffect, useState } from "react";
import "./charger.css";
import { useNavigate } from "react-router-dom";
import { useParams } from "react-router-dom";
import { FiZap } from "react-icons/fi";        // Power
import { LuBatteryCharging } from "react-icons/lu"; // Energy
import { FiClock } from "react-icons/fi";      // Time
import { FiMapPin } from "react-icons/fi";
import { useCharger } from "../../ChargerContext";

const GRAPHQL_URL = "https://ocpp.rivotmotors.com/v1/graphql";
const CSMS_URL = "https://ocpp.rivotmotors.com/csms";

export default function ChargerPage({onBack  }) {
const { chargerId, connectorId, sessionId } = useParams();
  const tenantId = connectorId;
  const [soc, setSoc] = useState(0);
  const [power, setPower] = useState(0);
  const [energy, setEnergy] = useState(0);
  const [transactionId, setTransactionId] = useState(null);
  const [isCharging, setIsCharging] = useState(false);
  const [targetSoc, setTargetSoc] = useState(100);
  const navigate = useNavigate();
  const [timeLeft, setTimeLeft] = useState(0); // seconds
  const [stopping, setStopping] = useState(false);
  const radius = 130;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (soc / 100) * circumference;

  const [showToast, setShowToast] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [hasNavigated, setHasNavigated] = useState(false);
  const [timerInitialized, setTimerInitialized] = useState(false);
  
  useEffect(() => {
  let active = true;

  const checkConnectorStatus = async () => {
    try {
      const res = await fetch(GRAPHQL_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-hasura-admin-secret": "CitrineOS!",
        },
        body: JSON.stringify({
          query: `
            query ($stationId: String!, $connectorId: Int!) {
              Connectors(
                where: {
                  stationId: {_eq: $stationId},
                  connectorId: {_eq: $connectorId}
                }
              ) {
                status
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
const statusRaw = json.data?.Connectors?.[0]?.status;

const status = statusRaw
  ?.toString()
  .trim()
  .toLowerCase();

console.log("🔴 CLEAN STATUS:", status);

if (status === "finishing" && !hasNavigated) {
  console.log("NAVIGATE TO COMPLETED PAGE");

  setHasNavigated(true);

  navigate(`/${chargerId}/${connectorId}/completed/${sessionId}`, {
  replace: true,
});

  return;
}

if (status === "available") {
  navigate(`/${chargerId}/${connectorId}/summary/${sessionId}`, {
    replace: true,
  });
}
    } catch (err) {
      console.error(err);
    }
  };

  checkConnectorStatus();
  const interval = setInterval(checkConnectorStatus, 3000);

  return () => {
    active = false;
    clearInterval(interval);
  };
}, [chargerId, connectorId, navigate]);
  
  
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const paymentStatus = params.get("payment");

  if (paymentStatus === "success") {
    setShowToast(true);

    const timer = setTimeout(() => {
      setShowToast(false);
    }, 2500);

    return () => clearTimeout(timer);
  }
  }, []);

  const getTargetSoc = async () => {

  const response = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-hasura-admin-secret": "CitrineOS!"
    },
    body: JSON.stringify({
      query: `
        query {
          charging_targets(
            where: { evse_id: { _like: "${chargerId}%" } }
            order_by: { created_at: desc }
            limit: 1
          ) {
            target_soc
             estimated_time_min 
          }
        }
      `
    })
  });

  const result = await response.json();
  console.log("TARGET RESPONSE:", result);
 const target = result?.data?.charging_targets?.[0];

  if (target) {
  if (target.target_soc) {
    setTargetSoc(Number(target.target_soc));
  }

if (
  target.estimated_time_min !== null &&
  !timerInitialized
) {
  setTimeLeft(Number(target.estimated_time_min) * 60);
  setTimerInitialized(true);
}

}
};

const getLatestTransaction = async () => {
  const response = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-hasura-admin-secret": "CitrineOS!"
    },
    body: JSON.stringify({
      query: `
        query {
          Transactions(
            where: {
              stationId: { _eq: "${chargerId}" }
            }
            order_by: { startTime: desc }
            limit: 1
          ) {
            transactionId
            startTime
            endTime
          }
        }
      `
    })
  });

  const result = await response.json();
  const tx = result?.data?.Transactions?.[0];

  if (!tx) {
    console.log(" No transaction found");
    return null;
  }

  // ✅ PRINT SESSION TX
  console.log(" SESSION TX:", {
    transactionId: tx.transactionId,
    startTime: tx.startTime,
    endTime: tx.endTime
  });

  setTransactionId(tx.transactionId);
  return tx;
};

const getLiveTelemetryFromOCPP = async (tx) => {
  if (!tx) return;

  const { startTime, endTime, transactionId } = tx;

  const res = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-hasura-admin-secret": "CitrineOS!",
    },
    body: JSON.stringify({
      query: `
        query {
          OCPPMessages(
            where: {
              stationId: { _eq: "${chargerId}" },
              action: { _eq: "DataTransfer" },
              timestamp: { 
                _gte: "${startTime}",
                _lte: "${endTime || new Date().toISOString()}"
              }
            }
            order_by: { timestamp: desc }
            limit: 20
          ) {
            message
            timestamp
          }
        }
      `,
    }),
  });

  const result = await res.json();
  const messages = result?.data?.OCPPMessages || [];

  for (let msg of messages) {
    try {
      let parsed = msg.message;

      if (typeof parsed === "string") {
        parsed = JSON.parse(parsed);
      }

      if (!Array.isArray(parsed)) continue;

      const payload = parsed[3];

      if (payload?.messageId === "LiveTelemetry") {
        const data = JSON.parse(payload.data);

        console.log("⚡ LIVE TELEMETRY:", {
          transactionId,
          timestamp: msg.timestamp,
          voltage: data.v,
          current: data.i,
          soc: data.s,
          energy: data.e,
          power: data.p
        });
        // UI updates
        setPower(data.p || 0);
        setEnergy((data.e || 0) / 1000);
        setSoc(data.s || 0);

        return;
      }

    } catch (err) {
      console.log("skip parse");
    }
  }
};

useEffect(() => {
  getTargetSoc();
}, []);

useEffect(() => {
  const load = async () => {
    const tx = await getLatestTransaction();

    if (!tx) {
      setIsCharging(false);
      return;
    }

    if (!tx.endTime) {
      setIsCharging(true);
    } else {
      setIsCharging(false);
    }

    // ✅ ADD THIS
    // await getTargetSoc();

    await getLiveTelemetryFromOCPP(tx);
  };

  load();
  const interval = setInterval(load, 5000);

  return () => clearInterval(interval);
}, []);

useEffect(() => {
  if (!isCharging) return;

  const timer = setInterval(() => {
    setTimeLeft((prev) => {
      if (prev <= 1) {
        clearInterval(timer);
        return 0;
      }

      return prev - 1;
    });
  }, 1000);

  return () => clearInterval(timer);
}, [isCharging]);

  const startCharging = async () => {
    await fetch(
     `${CSMS_URL}/ocpp/1.6/evdriver/remoteStartTransaction?identifier=${chargerId}&tenantId=${tenantId}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectorId: 1,
          idTag: "TEST_TAG"
        })
      }
    );
  };

  const stopCharging = async () => {
  if (!transactionId || stopping) return;

  setStopping(true); // 🔥 immediately locks button

  try {
    await fetch(
      `${CSMS_URL}/ocpp/1.6/evdriver/remoteStopTransaction?identifier=${chargerId}&tenantId=${tenantId}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId })
      }
    );

    setIsCharging(false);
  } catch (err) {
    console.error(err);
  }

  // ❌ DO NOT reset stopping
};

 const targetProgress =
  targetSoc > 0 ? Math.min((soc / targetSoc) * 100, 100) : 0;


  const formatTime = (seconds) => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  return `${hrs.toString().padStart(2, "0")}:${mins
    .toString()
    .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};

return (
    <div className={`page ${isCharging ? "page-charging" : ""}`}>

{showToast && (
  <div className="pay-toast-wrap">
    <div className="pay-toast-card">

      <div className="pay-icon">✓</div>

      <div className="pay-text">
        <h4>Payment Successful</h4>
        <p>Your transaction was completed</p>
      </div>

    </div>
  </div>
)}

  <header className="topbar">

  <button className="icon-btn" onClick={() => navigate(-1)}>
    ←
  </button>
  
  <div className="center-title">
    <div className="session-text">SESSION ACTIVE</div>
    <div className="station-id">Station #{chargerId}</div>
  </div>

  <button className="icon-btn">
    i
  </button>

</header>

      <div className="gauge-container">
        <svg className="progress-ring" width="300" height="300">
          <circle
            className="bg-ring"
            strokeWidth="12"
            r={radius}
            cx="150"
            cy="150"
          />
          <circle
            className={`progress-ring-circle ${isCharging ? "ring-animate" : ""}`}
            strokeWidth="12"
            r={radius}
            cx="150"
            cy="150"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
          />
        </svg>

        <div className="gauge-content">
          <div className={`bolt ${isCharging ? "bolt-active" : ""}`}>⚡</div>
          <div className="soc">
            {soc}<span className="percentage">%</span>
          </div>
         <div className={`charging-status ${isCharging ? "active" : "idle"}`}>
          <span className="live-dot"></span>
          {isCharging ? "LIVE CHARGING" : "NOT CHARGING"}
        </div>
        </div>
      </div>

      {/* ---------------- LOCATION CARD ---------------- */}

<div className="location-card">
  <div className="location-info">
    <p className="location-label">CURRENT LOCATION</p>
    <h3>
      KIADB Industrial Estate, Auto Nagar, Kalakamba,
      Belagavi taluku, Belagavi, Karnataka – 590001
    </h3>

    <div className="location-sub">
      <FiMapPin className="unit" />
      <span>India</span>
    </div>
  </div>

  <img
    src="/flsahcharger.png"
    alt="Charger Location"
    className="location-image"
  />
</div>

      <div className="stats">

  <div className={`stat-cards ${power > 0 ? "power-active" : ""}`}>
    <div className="stat-header">
      <FiZap className="stat-icon" />
      <span>POWER</span>
    </div>
   <h3 className="stat-value">
  {power.toFixed(2)}
  <span className="unit"> W</span>
</h3>
  </div>

  <div className="stat-cards">
    <div className="stat-header">
      <LuBatteryCharging className="stat-icon" />
      <span>ENERGY</span>
    </div>
    <h3 className="stat-value">
  {energy.toFixed(2)}
  <span className="unit"> kWh</span>
</h3>
  </div>

  <div className="stat-cards">
    <div className="stat-header">
      <FiClock className="stat-icon" />
      <span>TIME LEFT</span>
    </div>
  <h3 className={`stat-value coloroftime timer-live ${isCharging ? "active" : ""}`}>
  {formatTime(timeLeft)}
</h3>
  </div>

</div>

      <div className="footer">
    <div className="target-section">

  <div className="target-header">
    <span>Target charge: {targetSoc}%</span>
    <span className="fast-text">Fast Charging Active</span>
  </div>

  <div className="target-bar">
    <div
      className="target-progress"
      style={{ width: `${targetProgress}%` }}
    />
  </div>

</div>

<button
  className="stop-btn"
  disabled={stopping}
  onClick={stopCharging}
>
  {stopping ? (
    <span className="btn-loader-wrap">
      <span className="btn-loader"></span>
      Stopping Charging...
    </span>
  ) : (
    "⛔ Stop Charging"
  )}
</button>
      </div>
    </div>

  );
}