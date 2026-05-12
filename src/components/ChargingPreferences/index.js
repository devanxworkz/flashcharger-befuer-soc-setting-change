import { useState, useEffect } from "react";
import "./index.css";
import { useNavigate } from "react-router-dom";
import { useCharger } from "../../ChargerContext";
import { useParams } from "react-router-dom";
// const CHARGER_ID = "250822008C06";
const batteryMap = {
  Pro: 60,
  Max: 90,
  Classic: 30,
};
const batteryKwhMap = {
  Pro: 4.4,
  Max: 6.6,
  Classic: 2.2,
};

const KM_PER_AH = 2.7;
const PRICE_PER_KWH = 18;

function PaymentButton() {
  const [loading, setLoading] = useState(false);

  const handlePayment = async () => {
    if (loading) return; // prevents multiple clicks

    setLoading(true);

    try {
      // your stripe API call
      const res = await fetch("/create-checkout-session", {
        
        method: "POST",
      });

      const data = await res.json();

      window.location.href = data.url; // redirect to stripe
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };
  return (
    <button
      className={`pay-btn ${loading ? "disabled" : ""}`}
      onClick={handlePayment}
      disabled={loading}
    >
      {loading ? "Opening Payment..." : "Proceed to Payment"}
    </button>
  );
}
export default function ChargingPreferences() {
  const navigate = useNavigate();
  const { chargerId, connectorId } = useParams();
  const [mode, setMode] = useState("FAST");
  const [target, setTarget] = useState(0);
  const [vehicleData, setVehicleData] = useState(null);
  const [fullAh, setFullAh] = useState(0);
  const [fullKwh, setFullKwh] = useState(0);
  const [currentAh, setCurrentAh] = useState(0);
  const [loading, setLoading] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  // const { chargerId } = useCharger();
  const handleProceed = async () => {
    console.log("Button clicked!"); 
  if (paymentLoading) return; // prevent multiple clicks

  setPaymentLoading(true);

  try {
    await proceedToPayment();
  } catch (err) {
    console.error(err);
    setPaymentLoading(false); // enable again if error
  }
};

  // ================= FETCH VEHICLE =================
useEffect(() => {
  if (!chargerId) return;

  const fetchVehicleData = async () => {
    try {
      const response = await fetch(
        "https://ocpp.rivotmotors.com/v1/graphql",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-hasura-admin-secret": "CitrineOS!",
          },
          body: JSON.stringify({
            query: `
              query {
                vehicledata(
                  where: {
                    stationid: { _eq: "${chargerId}" }
                  }
                  order_by: { created_at: desc }
                  limit: 1
                ) {
                  datatransfer
                }
              }
            `,
          }),
        }
      );

      const result = await response.json();
      console.log("Vehicle API:", result);

      const latest = result.data?.vehicledata?.[0];

      if (latest?.datatransfer) {
  try {
    const dt = latest.datatransfer;

    // Step 1: get 4th element
    const payload = dt[3];

    // Step 2: convert string JSON → object
    const parsed = JSON.parse(payload.data);

    console.log("Parsed Vehicle:", parsed);

    setVehicleData(parsed);
  } catch (err) {
    console.error("Parsing error:", err);
  }
}
       else {
        console.log("No vehicle data found");
      }

    } catch (err) {
      console.error(err);
    }
  };

  fetchVehicleData();
}, [chargerId]);

useEffect(() => {
  if (!vehicleData) {
    console.log("Using dummy vehicle data");

    setVehicleData({
      soc: 40,
      model: "Pro",
      maxCurrent: 15
    });
  }
}, []);

useEffect(() => {
  if (vehicleData?.soc === undefined || vehicleData?.soc === null) return;

  const remainingAh = fullAh - currentAh;
  const remainingRange = remainingAh * KM_PER_AH;
  const remainingCost = remainingKwh * PRICE_PER_KWH;
  const remainingTimeMin = (remainingAh / (vehicleData.maxCurrent || 15)) * 60;

  switch (mode) {
    case "FAST":
      setTarget(100);
      break;

    case "TIME":
      setTarget(Math.max(1, Math.round(remainingTimeMin)));
      break;

    case "ENERGY":
      setTarget(Math.max(1, Math.round(remainingRange)));
      break;

    case "AMOUNT":
      setTarget(Math.max(1, Math.round(remainingCost)));
      break;

    default:
      setTarget(1);
  }
}, [mode]);

  // ================= INITIAL SETUP =================
  useEffect(() => {
    if (!vehicleData?.soc || !vehicleData?.model) return;

    const capacityAh = batteryMap[vehicleData.model];
    const capacityKwh = batteryKwhMap[vehicleData.model];

    setFullAh(capacityAh);
    setFullKwh(capacityKwh);

    const currAh = (vehicleData.soc / 100) * capacityAh;
    setCurrentAh(currAh);

    if (mode === "FAST") {
  setTarget(100);
} else {
  setTarget(Math.ceil(vehicleData.soc));
}
  }, [vehicleData]);

  if (!vehicleData) return <div className="loading">Loading vehicle...</div>;

  const maxCurrent = vehicleData.maxCurrent || 15;
  // 🔥 Proper energy conversion
  const kwhPerAh = fullKwh / fullAh;

  // ===== Remaining Capacity =====
  const remainingAh = fullAh - currentAh;
  const remainingKwh = remainingAh * kwhPerAh;
  const remainingRange = remainingAh * KM_PER_AH;
  const remainingCost = remainingKwh * PRICE_PER_KWH;
  const remainingTimeMin = (remainingAh / maxCurrent) * 60;
  // ================= REQUIRED CALCULATION =================
  let requiredAh = 0;

  switch (mode) {
    case "FAST":
      const desiredSoc = Math.min(target, 100);
      const desiredAh = (desiredSoc / 100) * fullAh;
      requiredAh = desiredAh - currentAh;
      break;

    case "TIME":
      requiredAh = (target / 60) * maxCurrent;
      break;

    case "ENERGY":
      requiredAh = target / KM_PER_AH;
      break;

    case "AMOUNT":
      const requiredKwh = target / PRICE_PER_KWH;
      requiredAh = requiredKwh / kwhPerAh;
      break;

    default:
      requiredAh = 0;
  }
  // Clamp
  if (requiredAh > remainingAh) requiredAh = remainingAh;
  if (requiredAh < 0) requiredAh = 0;

  const requiredKwhFinal = requiredAh * kwhPerAh;
  const range = requiredAh * KM_PER_AH;
  const cost = requiredKwhFinal * PRICE_PER_KWH;
  const timeMinutes = Math.round((requiredAh / maxCurrent) * 60);

  // ================= SLIDER LIMITS =================
const sliderMin = (() => {
  switch (mode) {
    case "FAST":
      return Math.ceil(vehicleData.soc);
    case "TIME":
    case "ENERGY":
    case "AMOUNT":
      return 1; // 👈 FIX: start from 1
    default:
      return 1;
  }
})();

  const sliderMax = (() => {
    switch (mode) {
      case "FAST":
        return 100;
      case "TIME":
        return Math.round(remainingTimeMin);
      case "ENERGY":
        return Math.round(remainingRange);
      case "AMOUNT":
        return Math.round(remainingCost);
      default:
        return 100;
    }
  })();

const proceedToPayment = async () => {
  try {
    // ===== GraphQL insert =====
    const res = await fetch("https://ocpp.rivotmotors.com/v1/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-hasura-admin-secret": "CitrineOS!"
      },
      body: JSON.stringify({
        query: `
          mutation InsertChargingTarget {
            insert_charging_targets_one(object: {
              evse_id: "${chargerId}_1",
              target_soc: ${Math.round(target)},
              target_kwh: ${requiredKwhFinal},
              mode: "${mode}",
              estimated_time_min: ${timeMinutes || 0}
            }) {
              id
            }
          }
        `
      })
    });

    const json = await res.json();
    console.log("GRAPHQL RESPONSE:", json);
    if (json.errors) {
      console.error("GraphQL Error:", json.errors);
      alert("Insert failed. Check console.");
      return;
    }

    // ===== Step 1: create checkout =====
    const checkoutRes = await fetch("https://ocpp.rivotmotors.com/api/checkouts/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        evse_id: `${chargerId}_1`,
        amount: Math.round(cost * 100), // 🔥 ADD THIS
        currency: "INR",
        success_url: `${window.location.origin}/${chargerId}/${connectorId}/charging`,
        cancel_url: `${window.location.origin}/${chargerId}/${connectorId}/preferences`
      })
    });

    const checkoutData = await checkoutRes.json();
    console.log("Razorpay order ID:", checkoutData.url);

    // ===== Step 2: polling function (defined first!) =====
    const pollCheckoutStatus = async (checkoutId) => {
      for (let i = 0; i < 10; i++) {
        try {
          const res = await fetch(`https://ocpp.rivotmotors.com/api/checkouts/${checkoutId}`);
          const data = await res.json();

          if (data.remote_request_status === "ACCEPTED") {
            alert("⚡ Charging started!");
            return;
          }
        } catch (err) {
          console.error("Error polling checkout status", err);
        }
        await new Promise(r => setTimeout(r, 2000));
      }
     
    };

    // ===== Step 3: open Razorpay =====
    console.log("Razorpay order ID:", checkoutData.order_id);

const options = {
  key: "rzp_test_SVVB9yuIU2MDH2",
  
  order_id: checkoutData.url,
      name: "EV Charging",
      description: "Charging Session",
      currency: "INR",
 handler: async function (response) {
  console.log("✅ Payment success", response);

  try {
    await fetch("https://ocpp.rivotmotors.com/api/checkouts/save-payment", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        payment_id: response.razorpay_payment_id,
        order_id: response.razorpay_order_id,
        amount: Math.round(cost * 100),
        session_id: checkoutData.id,
        status: "success"
      })
    });
  } catch (err) {
    console.error(err);
  }

  // 🚀 KEEP YOUR FLOW SAME
  navigate(`/${chargerId}/${connectorId}/charging/${checkoutData.id}`);
  pollCheckoutStatus(checkoutData.id);
},
      modal: {
        ondismiss: function () {
          console.log("Payment popup closed");
        }
      }
    };

    const rzp = new window.Razorpay(options);
    rzp.on("payment.failed", function (response) {
      console.error("Payment failed:", response);
      alert("Payment failed ❌");
    });

    rzp.open();
  } catch (error) {
    console.error("Payment error:", error);
    alert("Something went wrong. Check console.");
  }
};

  return (
    <div className="page">
    <div className="phone">
    <div className="pref-container">

  <div className="pref-topbar">
<div className="back-btn" onClick={() => navigate(`/${chargerId}/${connectorId}`)}>
  <span className="material-symbols-outlined">arrow_back</span>
</div>
  <h2 className="pref-title">Charging Preferences</h2>
</div>

  {/* HEADER */}
  <div className="pref-header">
    <h1>How would you like to charge?</h1>
    <p>Select a preference to see estimated delivery.</p>
  </div>

  <div className="pref-grid">
    <div
      className={`pref-card ${mode === "FAST" ? "active" : ""}`}
      onClick={() => setMode("FAST")}
    >
      <div className="pref-icon primary">
        <span className="material-symbols-outlined">bolt</span>
      </div>

      <div>
        <h4>Full Charge</h4>
        <span className="recommended">Recommended</span>
      </div>

      {mode === "FAST" && (
        <span className="material-symbols-outlined check">check_circle</span>
      )}
    </div>

    <div
      className={`pref-card ${mode === "TIME" ? "active" : ""}`}
      onClick={() => setMode("TIME")}
    >
      <div className="pref-icon">
        <span className="material-symbols-outlined">schedule</span>
      </div>
      <h4>By Time</h4>
    </div>

    <div
      className={`pref-card ${mode === "ENERGY" ? "active" : ""}`}
      onClick={() => setMode("ENERGY")}
    >
      <div className="pref-icon">
        <span className="material-symbols-outlined">ev_station</span>
      </div>
      <h4>By Range (km)</h4>
    </div>
    <div
      className={`pref-card ${mode === "AMOUNT" ? "active" : ""}`}
      onClick={() => setMode("AMOUNT")}
    >
      <div className="pref-icon">
        <span className="material-symbols-outlined">currency_rupee</span>
      </div>
      <h4>By Amount (₹)</h4>
    </div>
  </div>
  <div className="target-card">

    <div className="target-header">
      <p>Target Charge</p>

      <strong>
        {mode === "FAST" && `${Math.round(target)} %`}
        {mode === "TIME" && `${Math.round(target)} min`}
        {mode === "ENERGY" && `${Math.round(target)} km`}
        {mode === "AMOUNT" && `₹${Math.round(target)}`}
      </strong>
    </div>
<input
  className="slider"
  type="range"
  min={sliderMin}
  max={sliderMax}
  step="1"
  value={target}
  onChange={(e) => setTarget(Number(e.target.value))}
/>
    <div className="divider" />
    <div className="target-stats">
      <div>
        <span>EST. TIME</span>
        <h3>{timeMinutes} min</h3>
      </div>
      <div className="stat-divider"></div>
      <div>
        <span>RANGE</span>
        <h3>{range.toFixed(1)} km</h3>
      </div>
      <div className="stat-divider"></div>
      <div>
        <span>COST</span>
        <h3>₹{cost.toFixed(2)}</h3>
      </div>
    </div>
  </div>

  {/* INFO */}
  <div className="info-box">
    <span className="material-symbols-outlined">info</span>
    <p>
      Charging speed may vary based on vehicle temperature and battery health.
      system will adjust itself.
    </p>
  </div>
  {/* BUTTON */}
<button
  className={`pref-btn ${paymentLoading ? "disabled" : ""}`}
  onClick={handleProceed}    // make sure this is correctly linked
  disabled={paymentLoading}
>
  {paymentLoading ? "Opening payment..." : "Proceed to Payment"}
  {!paymentLoading && <span className="material-symbols-outlined">arrow_forward</span>}
</button>

</div>
  </div>
</div>
  );
}