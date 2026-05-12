import { useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";

const HASURA_URL = "https://ocpp.rivotmotors.com/v1/graphql";
const HASURA_ADMIN_SECRET = "CitrineOS!";

export default function StatusWatcher() {
  const { chargerId, connectorId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!chargerId || !connectorId) return;

    const fetchStatus = async () => {
      try {
        const res = await fetch(HASURA_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-hasura-admin-secret": HASURA_ADMIN_SECRET,
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

        const result = await res.json();
        const status =
          result.data?.Connectors?.[0]?.status?.trim().toLowerCase() ||
          "unknown";

        console.log("🚦 STATUS:", status);

        // 🔥 ONLY THIS LOGIC
        if (
          status === "finishing" &&
          location.pathname !== `/${chargerId}/${connectorId}/summary`
        ) {
          console.log("🚀 GO TO SUMMARY");
          navigate(`/${chargerId}/${connectorId}/summary`);
        }

      } catch (err) {
        console.error(err);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);

    return () => clearInterval(interval);
  }, [chargerId, connectorId, navigate, location.pathname]);

  return null;
}