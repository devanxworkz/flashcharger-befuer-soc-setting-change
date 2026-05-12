import React, { useEffect, useState } from "react";
import "./thankyou.css";
import { useNavigate, useParams } from "react-router-dom";

const HASURA_URL = "https://ocpp.rivotmotors.com/v1/graphql";
const HASURA_ADMIN_SECRET = "CitrineOS!";

export default function ThanksScreen() {
  const navigate = useNavigate();
  const { chargerId, connectorId } = useParams();

  const [isUnplugged, setIsUnplugged] = useState(false);

  // 🔌 Poll connector status
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(HASURA_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-hasura-admin-secret": HASURA_ADMIN_SECRET,
          },
          body: JSON.stringify({
            query: `
              query {
                Connectors(
                  where: {
                    stationId: { _eq: "${chargerId}" },
                    connectorId: { _eq: ${connectorId} }
                  }
                ) {
                  status
                }
              }
            `,
          }),
        });

        const data = await res.json();
        const status = data?.data?.Connectors?.[0]?.status;

        if (status === "Available") {
          setIsUnplugged(true);
          clearInterval(interval);
        }
      } catch (err) {
        console.error(err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [chargerId, connectorId]);

  return (
    <div className="thanks-root">
      <div className="thanks-card">

        {/* Icon */}
        <div className="thanks-icon-wrap">
          <div className="thanks-icon">⚡</div>
        </div>

        {/* Title */}
        <h1 className="thanks-title">Charging Complete</h1>
        <p className="thanks-main">
  Thank you for charging with us
</p>

        {/* Main Text */}
        <p className="thanks-main">
          Your charging session has been successfully completed.
        </p>

        {/* Dynamic Message */}
        {!isUnplugged ? (
          <p className="thanks-sub">
             Please unplug the charger to proceed.
          </p>
        ) : (
          <p className="thanks-sub success">
             Connector removed. You’re ready to start a new session.
          </p>
        )}

        {/* Divider */}
        <div className="thanks-divider"></div>

        {/* Button */}
        <button
          className="thanks-btn"
          disabled={!isUnplugged}
          onClick={() => navigate(`/${chargerId}/${connectorId}`)}
        >
          {!isUnplugged ? (
            <span className="btn-loader-wrap">
              <span className="btn-loader"></span>
              Waiting for unplug charger...
            </span>
          ) : (
            "Start new session"
          )}
        </button>

      </div>
    </div>
  );
}