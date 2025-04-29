import React, { useState } from "react";
import axios from "axios";

const endpoint = "https://will-m9al3x9d-swedencentral.openai.azure.com/";
const apiKey = "86h0Qg6Z9EJ67XOr9idZA3TGi5ia8qS5Pj1vikcxXKbrfFmdbrQQJQQJ99BDACfhMk5XJ3w3AAAAACOGv7Hv";
const apiVersion = "2023-05-15";

function ConnectionTest() {
  const [status, setStatus] = useState(null);
  const [details, setDetails] = useState("");
  const [loading, setLoading] = useState(false);

  const testConnection = async () => {
    setLoading(true);
    setStatus(null);
    setDetails("");
    try {
      // Minimal test: list models endpoint (should return 200 if key/endpoint valid)
      const url = `${endpoint}openai/deployments?api-version=${apiVersion}`;
      const response = await axios.get(url, {
        headers: { "api-key": apiKey }
      });
      setStatus("success");
      setDetails(JSON.stringify(response.data, null, 2));
    } catch (err) {
      setStatus("error");
      setDetails(err.response?.data?.error?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 600, margin: "32px auto", padding: 24, border: "1px solid #ccc", borderRadius: 8 }}>
      <h2>Test Azure OpenAI Connection</h2>
      <button onClick={testConnection} disabled={loading} style={{ padding: "8px 16px", fontSize: 16 }}>
        {loading ? "Testing..." : "Test Connection"}
      </button>
      {status && (
        <div style={{ marginTop: 16, color: status === "success" ? "green" : "red" }}>
          {status === "success" ? "Connection successful!" : "Connection failed."}
        </div>
      )}
      {details && (
        <pre style={{ marginTop: 8, background: "#f4f4f4", padding: 12, borderRadius: 4, fontSize: 12 }}>{details}</pre>
      )}
    </div>
  );
}

export default ConnectionTest;
