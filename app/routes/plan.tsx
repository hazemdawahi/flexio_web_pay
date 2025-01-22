import { useAtom } from "jotai";
import type { MetaFunction } from "@remix-run/node";
import { accessTokenAtom, refreshTokenAtom } from "~/state/atoms";

export const meta: MetaFunction = () => {
  return [
    { title: "Plan Page" },
    { name: "description", content: "Plan page showing payment options." },
  ];
};

export default function PlanPage() {
  const [accessToken] = useAtom(accessTokenAtom);
  const [refreshToken] = useAtom(refreshTokenAtom);

  function handlePay(option: number) {
    alert(`You chose to pay in ${option} installments.`);
  }

  return (
    <div style={styles.container}>
      <h1>Plan Page</h1>
      <div style={styles.tokensBox}>
        <p>
          <strong>Access Token:</strong> {accessToken ?? "No access token"}
        </p>
        <p>
          <strong>Refresh Token:</strong> {refreshToken ?? "No refresh token"}
        </p>
      </div>
      <div style={styles.paymentOptions}>
        <h2>Choose Payment Plan</h2>
        <button style={styles.button} onClick={() => handlePay(4)}>
          Pay in 4
        </button>
        <button style={styles.button} onClick={() => handlePay(6)}>
          Pay in 6
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: { fontFamily: "sans-serif", padding: "1rem" },
  tokensBox: {
    marginTop: "1rem",
    border: "1px solid #ddd",
    padding: "1rem",
    borderRadius: "4px",
  },
  paymentOptions: { marginTop: "1rem" },
  button: {
    marginRight: "1rem",
    padding: "0.5rem 1rem",
  },
} as const;
