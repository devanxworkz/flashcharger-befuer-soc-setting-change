import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "./chargercomapletindex.css";

export default function ChargingCompleted() {
  const navigate = useNavigate();
  const { chargerId, connectorId, sessionId } = useParams();

  const [status, setStatus] = useState("finishing");
  const [hasNavigated, setHasNavigated] = useState(false);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch("https://ocpp.rivotmotors.com/v1/graphql", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-hasura-admin-secret": "CitrineOS!",
          },
          body: JSON.stringify({
            query: `
              query {
                Connectors(
                  where: {
                    stationId: { _eq: "${chargerId}" },
                    connectorId: { _eq: ${Number(connectorId)} }
                  }
                ) {
                  status
                }
              }
            `,
          }),
        });

        const json = await res.json();

        const newStatus = json.data?.Connectors?.[0]?.status
          ?.toString()
          .trim()
          .toLowerCase();

        console.log(" CURRENT STATUS:", newStatus);

        setStatus(newStatus);

        // ✅ When unplugged → go to summary
        if (newStatus === "available" && !hasNavigated) {
          console.log("✅ DISCONNECTED → GO SUMMARY");

          setHasNavigated(true);

                navigate(`/${chargerId}/${connectorId}/summary/${sessionId}`, {
                replace: true,
              });
        }
      } catch (err) {
        console.error("Error fetching status:", err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [chargerId, connectorId, navigate, hasNavigated]);

  return (
    <div className="completeWrapper">
      <div className="completeCard">

        {/* ✅ Success Icon */}
        <div className="iconWrapper">
          <div className="tick">✓</div>
        </div>

        {/* ✅ Title */}
        <h1 className="title">
          Charging completed successfully
        </h1>
    
        <p className="primaryText1">
          Please disconnect the charging gun
        </p>

        {/* ✅ Loader */}
        {status !== "available" && (
          <div className="loaderWrap">
            <div className="loader"></div>
            <p className="waitingText">
              Waiting for disconnection...
            </p>
          </div>
        )}

      </div>
    </div>
  );
}