import React, { useEffect, useState } from "react";
import "./index.css";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Download } from "lucide-react";
import jsPDF from "jspdf";

// const CHARGER_ID = "250822008C06";
import { useParams } from "react-router-dom";

const HASURA_URL = "https://ocpp.rivotmotors.com/v1/graphql";
const HASURA_ADMIN_SECRET = "CitrineOS!";

export default function SessionSummary() {
const { chargerId, sessionId } = useParams();
  console.log("charger", chargerId);
;
  const [duration, setDuration] = useState("Loading...");
  const [energy, setEnergy] = useState("Loading...");
  const [startTimeIST, setStartTimeIST] = useState("");
  const [stopTimeIST, setStopTimeIST] = useState("");
  // const [chargerId, setChargerId] = useState(null);

  const handleCloseSession = () => {
  navigate(`/${chargerId}/1/`);
};
const handleDownloadInvoice = () => {
  const doc = new jsPDF();

  // 🔹 CONFIG (REPLACE WITH REAL DATA)
  const COMPANY_NAME = "Rivot Motors Pvt Ltd";
  const COMPANY_ADDRESS = "Belgaum, Karnataka";
  const GSTIN = "29ABCDE1234F1Z5"; // ⚠️ replace with real GSTIN

  const rate = 18; // ₹ per kWh

  const energyNum = parseFloat(energy) || 0;

  const taxableAmount = energyNum * rate;
  const cgst = taxableAmount * 0.09;
  const sgst = taxableAmount * 0.09;
  const totalAmount = taxableAmount + cgst + sgst;

  // 🔹 FORMATTING
  const f = (num) => num.toFixed(2);

  const invoiceNumber = `INV-${Date.now()}`;
  const invoiceDate = new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
  });

  let y = 20;


  doc.setFontSize(16);
  doc.text(COMPANY_NAME, 20, y);

  y += 8;
  doc.setFontSize(10);
  doc.text(COMPANY_ADDRESS, 20, y);

  y += 6;
  doc.text(`GSTIN: ${GSTIN}`, 20, y);


  y += 12;
  doc.setFontSize(12);
  doc.text(`Invoice No: ${invoiceNumber}`, 20, y);

  y += 6;
  doc.text(`Date: ${invoiceDate}`, 20, y);

  y += 6;
  doc.text(`Station ID: ${chargerId}`, 20, y);


  y += 12;
  doc.text("Description: EV Charging Service", 20, y);

  y += 6;
  doc.text("SAC Code: 998714", 20, y);


  y += 10;
  doc.text(`Energy Delivered: ${f(energyNum)} kWh`, 20, y);

  y += 12;
  doc.text("Thank you for charging with us!", 20, y);

  doc.save(`Invoice_${invoiceNumber}.pdf`);
};

const [amount, setAmount] = useState("0.00");

useEffect(() => {
  const fetchPaymentFromHasura = async () => {
  try {
    const res = await fetch(HASURA_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-hasura-admin-secret": HASURA_ADMIN_SECRET,
      },
      body: JSON.stringify({
        query: `
          query ($sessionId: String!) {
            payments(where: { session_id: { _eq: $sessionId } }) {
              amount
            }
          }
        `,
        variables: {
          sessionId: sessionId,
        },
      }),
    });

    const result = await res.json();

    console.log("💰 HASURA PAYMENT:", result);

    const amt = result?.data?.payments?.[0]?.amount;

    if (amt !== undefined && amt !== null) {
      setAmount((amt / 100).toFixed(2));
    } else {
      console.log("❌ No payment found for this session");
      setAmount("0.00");
    }

  } catch (err) {
    console.error("❌ Hasura payment error:", err);
  }
};

  if (sessionId) {
    fetchPaymentFromHasura();
  }
}, [sessionId]);

useEffect(() => {
  const fetchSessionSummary = async () => {
    try {
      // ✅ STEP 1: Get latest completed transaction
      const txnRes = await fetch(HASURA_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-hasura-admin-secret": HASURA_ADMIN_SECRET,
        },
        body: JSON.stringify({
          query: `
                      query {
            Transactions(
              where: {
                stationId: { _eq: "${chargerId}" },
                endTime: { _is_null: false }
              }
              order_by: { endTime: desc }
              limit: 1
            ) {
              startTime
              endTime
            }
          }
          `,
        }),
      });

      const txnData = await txnRes.json();
      const txn = txnData?.data?.Transactions?.[0];

      if (!txn) {
        console.log("❌ No transaction found");
        return;
      }

      const { startTime, endTime } = txn;

      console.log("🟢 Session Time:", startTime, "→", endTime);
      

      // ✅ STEP 2: Get OCPPMessages inside session
      const msgRes = await fetch(HASURA_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-hasura-admin-secret": HASURA_ADMIN_SECRET,
        },
        body: JSON.stringify({
          query: `
           query {
  OCPPMessages(
    where: {
      stationId: { _eq: "${chargerId}" },
      action: { _eq: "DataTransfer" },
      timestamp: {
        _gte: "${startTime}"
      }
    }
    order_by: { createdAt: desc }
    limit: 100
  ) {
    message
    timestamp
  }
}
          `,
        }),
      });

      const msgData = await msgRes.json();
      const messages = msgData?.data?.OCPPMessages || [];
      console.log("📦 Messages fetched:", messages.length);

      let found = false;

      for (let msgObj of messages) {
        try {
          let parsed = msgObj.message;

          if (typeof parsed === "string") {
            parsed = JSON.parse(parsed);
          }
        

          if (!Array.isArray(parsed) || parsed[0] !== 2) continue;

          const payload = parsed[3];
          console.log("👉 Checking message:", payload?.messageId);
          if (payload?.messageId === "SessionSummary") {
            const data = JSON.parse(payload.data);

            const energyDelivered = data.energyDeliveredWh || 0;
            const durationMinutes = data.durationMinutes || 0;

            // ✅ Console output
            console.log("✅ SESSION SUMMARY FOUND");
            console.log("⚡ Energy Delivered:", energyDelivered, "kWh");
            console.log("⏱ Duration:", durationMinutes, "minutes");

            // ✅ UI update
            setEnergy(energyDelivered.toFixed(2));

            const mins = Math.max(1, Math.round(durationMinutes));
            const h = Math.floor(mins / 60);
            const m = mins % 60;

            setDuration(h > 0 ? `${h}h ${m}m` : `${m} mins`);

            found = true;
            break;
          }
        } catch (err) {
          console.log("parse skip", err);
        }
      }

      if (!found) {
        console.log("⚠️ No SessionSummary found");
        setEnergy("0.00");
        setDuration("0 mins");
      }
    } catch (err) {
      console.error("❌ Error:", err);
      setEnergy("Error");
      setDuration("Error");
    }
  };

  fetchSessionSummary();
}, [chargerId]);

  console.log({energy});
  console.log({duration});

  const navigate = useNavigate();

  useEffect(() => {
  sessionStorage.removeItem("mySession");
}, []);

  return (
    
    <div className="summary-wrapper">
      <div className="summary-container">
        
        {/* Header */}
        <div className="summary-header">
        <ArrowLeft 
          size={22} 
          className="back-icon"
          onClick={() => navigate(-1)}   // 🔥 GO BACK
          style={{ cursor: "pointer" }}
        />
        <h3>Session Summary</h3>
      </div>

        {/* Success Circle */}
        <div className="success-circle">
          <div className="inner-circle">
            ✓
          </div>
        </div>

        <p className="charging-label">CHARGING COMPLETE</p>
        <h2 className="session-title">Session #{chargerId} Success</h2>

        {/* Stats */}
        <div className="stats-row">
          <div className="stat-card">
            <p>Energy Delivered</p>
            {/* <h4>{energy} </h4> */}
            <h4>{energy} Wh</h4>
          </div>

          <div className="stat-card">
            <p>Total Duration</p>
            <h4>{duration}</h4>
          </div>
        </div>

        {/* Amount Card */}
        <div className="amount-card">
          <p>Total Amount Paid</p>
          <h1>₹{amount}</h1>
        </div>

        {/* Breakdown */}
        <div className="breakdown-card">
          <div className="row">
            <span>Rate</span>
            <span>₹18.00 / kWh</span>
          </div>
          <div className="row">
            <span>Taxes & Fees</span>
            <span>₹0.00</span>
          </div>
          <div className="row">
            <span>Station ID</span>
            <span>{chargerId}</span>
          </div>
          {/* <div className="row">
            <span>Payment Method</span>
            <span>Wallet (Ending 4402)</span>
          </div> */}
        </div>

        {/* Buttons */}
       <button className="download-btn" onClick={handleDownloadInvoice}>
          <Download size={18} />
          Download invoice
        </button>

      <button className="close-btn" onClick={handleCloseSession}>
        Start new session
      </button>

      </div>
    </div>
  );
}