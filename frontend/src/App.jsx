import { BrowserProvider, Contract, formatEther } from "ethers";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "./contract";
import { useEffect, useState } from "react";

function App() {
  const [walletAddress, setWalletAddress] = useState(null);

  const [riskScore, setRiskScore] = useState(24);
  const [riskLevel, setRiskLevel] = useState("Low Risk");

  const [weather, setWeather] = useState(null);
  const [ndvi, setNdvi] = useState(null);

  const [policy, setPolicy] = useState(null);
  const [payoutEligible, setPayoutEligible] = useState(false);
  const [creditScore, setCreditScore] = useState(null);

  // -----------------------------
  // CONNECT WALLET
  // -----------------------------
  const connectWallet = async () => {
    if (!window.ethereum) {
      alert("Please install MetaMask");
      return;
    }

    try {
      const provider = new BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);

      setWalletAddress(accounts[0]);

      const contract = new Contract(
        CONTRACT_ADDRESS,
        CONTRACT_ABI,
        provider
      );

      const oracleAddress = await contract.oracle();
      console.log("Contract Oracle:", oracleAddress);

      const balance = await contract.getBalance();
      console.log("Contract Balance:", balance.toString());
    } catch (error) {
      console.error("Wallet connection error:", error);
    }
  };

  // -----------------------------
  // FUND CONTRACT
  // -----------------------------
  const fundContract = async () => {
    if (!window.ethereum) {
      alert("Please install MetaMask");
      return;
    }

    try {
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      const contract = new Contract(
        CONTRACT_ADDRESS,
        CONTRACT_ABI,
        signer
      );

      const tx = await contract.fundContract({
        value: "1000000000000000"
      });

      console.log("Funding transaction:", tx.hash);

      await tx.wait();

      console.log("Contract funded successfully");
    } catch (error) {
      console.error("Funding error:", error);
    }
  };

  // -----------------------------
  // CREATE INSURANCE POLICY
  // -----------------------------
  const createPolicy = async () => {
    if (!window.ethereum) {
      alert("Please install MetaMask");
      return;
    }

    try {
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      const contract = new Contract(
        CONTRACT_ADDRESS,
        CONTRACT_ABI,
        signer
      );

      const tx = await contract.createPolicy(
        1,
        "10000000000000",
        "500000000000000",
        2592000,
        {
          value: "10000000000000"
        }
      );

      console.log("Policy creation transaction:", tx.hash);

      await tx.wait();

      console.log("Insurance policy created successfully");
    } catch (error) {
      console.error("Policy creation error:", error);
    }
  };

  // -----------------------------
  // GET POLICY
  // -----------------------------
  const getPolicy = async () => {
    if (!window.ethereum) {
      alert("Please install MetaMask");
      return;
    }

    try {
      const provider = new BrowserProvider(window.ethereum);

      const contract = new Contract(
        CONTRACT_ADDRESS,
        CONTRACT_ABI,
        provider
      );

      const result = await contract.policies(1);

      console.log("Policy result:", result);

      setPolicy({
        farmer: result.farmer,
        premium: formatEther(result.premium),
        coverageAmount: formatEther(result.coverageAmount),
        active: result.active,
        payoutTriggered: result.payoutTriggered
      });
      return {
        farmer: result.farmer,
        premium: formatEther(result.premium),
        coverageAmount: formatEther(result.coverageAmount),
        active: result.active,
        payoutTriggered: result.payoutTriggered
    };
    } catch (error) {
      console.error("Policy read error:", error);
    }
  };

  // -----------------------------
  // TRIGGER PAYOUT
  // -----------------------------
  const triggerPayout = async () => {
    if (!window.ethereum) {
      alert("Please install MetaMask");
      return;
    }

    try {
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      const contract = new Contract(
        CONTRACT_ADDRESS,
        CONTRACT_ABI,
        signer
      );

      const tx = await contract.triggerPayout(1);

      console.log("Payout transaction:", tx.hash);

      await tx.wait();

      console.log("Insurance payout triggered successfully");

      // Refresh policy information after payout
      await getPolicy();
    } catch (error) {
      console.error("Payout error:", error);
    }
  };

  // -----------------------------
  // WEATHER + NDVI DATA
  // -----------------------------
  useEffect(() => {
    fetch(
      "https://api.open-meteo.com/v1/forecast?latitude=13.08&longitude=80.27&daily=rain_sum,temperature_2m_mean&timezone=auto"
    )
      .then((response) => response.json())
      .then((data) => {
        setWeather(data.daily);
      })
      .catch((error) => {
        console.error("Weather API error:", error);
      });

    fetch("http://localhost:8000/ndvi")
      .then((response) => response.json())
      .then((data) => {
        setNdvi(data.ndvi);
      })
      .catch((error) => {
        console.error("NDVI API error:", error);
      });
  }, []);

  // -----------------------------
  // RISK CALCULATION
  // -----------------------------
  const rainfallRisk = weather
    ? Math.min(weather.rain_sum[0] * 10, 100)
    : 0;

  const cropRisk =
    ndvi !== null
      ? Math.round(
          Math.max(
            0,
            Math.min(100, (0.6 - ndvi) * 100)
          )
        )
      : 0;

  const soilRisk = 0;

  const calculateRisk = () => {
    return Math.round(
      rainfallRisk * 0.5 + cropRisk * 0.5
    );
  };
  const evaluatePayoutEligibility = (score) => {
  if (score >= 70) {
    return {
      eligible: true,
      reason: "High agricultural risk detected"
    };
  }

  return {
    eligible: false,
    reason: "Risk threshold for payout not reached"
  };
};

  const handleRiskCheck = async () => {
  await getPolicy();
  const newScore = calculateRisk();
  const payoutDecision = evaluatePayoutEligibility(newScore);
  const policyData = await getPolicy();
  const newCreditScore = calculateCreditScore(policyData);
  setCreditScore(newCreditScore);

  setRiskScore(newScore);

  if (newScore < 40) {
    setRiskLevel("Low Risk");
  } else if (newScore < 70) {
    setRiskLevel("Moderate Risk");
  } else {
    setRiskLevel("High Risk");
  }

  setPayoutEligible(payoutDecision.eligible);
  if (payoutDecision.eligible && policy?.active) {
  await triggerPayout();
}
  console.log("AgriShield Risk Decision:", {
    riskScore: newScore,
    riskLevel:
      newScore < 40
        ? "Low Risk"
        : newScore < 70
        ? "Moderate Risk"
        : "High Risk",
        payoutEligible: payoutDecision.eligible,
        reason: payoutDecision.reason
  });
};
const calculateCreditScore = (policyData) => {
  if (!policyData) {
    return 0;
  }    

  let score = 0;

  // Verified insurance policy exists
  score += 40;

  // Policy was completed through the blockchain
  if (policyData.payoutTriggered) {
    score += 30;
  }

  // Policy was previously active
  if (!policyData.active) {
    score += 30;
  }

  return score;
};
  // -----------------------------
  // UI
  // -----------------------------
  return (
    <>
      {/* Wallet Button */}
      <div className="wallet-container">
        <button onClick={connectWallet}>
          {walletAddress
            ? "Connected: " +
              walletAddress.slice(0, 6) +
              "..." +
              walletAddress.slice(-4)
            : "🔗 Connect Wallet"}
        </button>
      </div>

      <div className="app">

        {/* Navigation */}
        <header className="navbar">
          <div>
            <h1>🌾 AgriShield</h1>
            <p>Smart Crop Insurance Platform</p>
          </div>

          <div className="farmer-info">
            <span>Farmer</span>
            <strong>Demo Farmer</strong>
          </div>
        </header>

        {/* Main Dashboard */}
        <main className="dashboard">

          {/* Welcome */}
          <section className="welcome">
            <h2>Welcome back, Farmer 👋</h2>

            <p>
              Monitor your farm risk, insurance policy and
              verified agricultural data.
            </p>
          </section>

          {/* Live Weather */}
          <section className="weather-section">
            <h2>🌦️ Live Weather</h2>

            {weather ? (
              <p>
                Temperature:{" "}
                {weather.temperature_2m_mean[0]}°C | Rain:{" "}
                {weather.rain_sum[0]} mm
              </p>
            ) : (
              <p>Loading weather data...</p>
            )}
          </section>

          {/* Summary Cards */}
          <section className="cards">

            <div className="card">
              <h3>🌦️ Weather Risk</h3>
              <p className="value">LOW</p>

              <p>
                Current environmental risk
              </p>
            </div>

            <div className="card">
              <h3>🛡️ Insurance</h3>
              <p className="value">ACTIVE</p>

              <p>
                Policy is currently valid
              </p>
            </div>

            <div className="card">
              <h3>💰 Coverage</h3>
              <p className="value">₹50,000</p>

              <p>
                Maximum protected amount
              </p>
            </div>

          </section>

          {/* Risk Verification */}
          <section className="risk-section">

            <div className="section-header">

              <div>
                <h2>
                  Multi-Source Risk Verification
                </h2>

                <p>
                  Agricultural risk is evaluated using
                  multiple environmental signals.
                </p>
              </div>

              <button
                className="primary-button"
                onClick={handleRiskCheck}
              >
                Check Risk
              </button>

            </div>

            <div className="risk-grid">

              {/* Weather Risk */}
              <div className="risk-card">

                <span>🌧️</span>

                <h3>
                  Weather Risk
                </h3>

                <strong>
                  {rainfallRisk}
                </strong>

                <p>
                  Weather risk contribution
                </p>

              </div>

              {/* Soil Risk */}
              <div className="risk-card">

                <span>💧</span>

                <h3>
                  Soil Risk
                </h3>

                <strong>
                  {soilRisk}
                </strong>

                <p>
                  Soil risk contribution
                </p>

              </div>

              {/* Crop Condition */}
              <div className="risk-card">

                <span>🌱</span>

                <h3>
                  Crop Condition
                </h3>

                <strong>
                  {ndvi !== null
                    ? ndvi.toFixed(2)
                    : "Loading..."}
                </strong>

                <p>
                  Sentinel-2 NDVI
                </p>

              </div>

            </div>

          </section>

          {/* Risk Result */}
          <section className="risk-result">

            <div>

              <span className="status-label">
                CURRENT FARM RISK
              </span>
          {creditScore !== null && (
            <div>
              <h3>💳 Credit Readiness Index</h3>
              <p>Based on verified blockchain insurance history</p>
            </div>
          )}

              <h2>
                {riskLevel}
              </h2>

              <p>
               {payoutEligible
                 ? "🚨 Payout Eligible"
                 : "✅ Payout Not Eligible"}
              </p>

            </div>

            <div className="risk-score">

              <span>
                Risk Score
              </span>

              <strong>
                {riskScore}
              </strong>

              <small>
                / 100
              </small>

            </div>

          </section>

          {/* Quick Actions */}
          <section className="actions">

            <h2>
              Quick Actions
            </h2>

            <div className="action-grid">

              <button onClick={createPolicy}>
                💳 Buy Insurance
              </button>

              <button onClick={getPolicy}>
                🔍 View Policy
              </button>

              <button onClick={triggerPayout}>
                💸 Trigger Payout
              </button>

              <button>
                💸 View Payouts
              </button>

              <button>
                🔗 Blockchain Record
              </button>

              <button>
                🏦 Credit Assessment
              </button>

              <button>
                📊 Detailed Analysis
              </button>

              <button onClick={fundContract}>
                💰 Fund Contract
              </button>

            </div>

          </section>

          {/* Policy Details */}
          {policy && (
            <section className="activity">

              <h2>
                📋 Insurance Policy #1
              </h2>
              <p>
                🔗 Blockchain Verified — Ethereum Sepolia
              </p>
              <p>
                Contract:{" "}
                <a
                 href={`https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}`}
                 target="_blank"
                 rel="noreferrer"
               >
                 View on Etherscan
               </a>
              </p>
              <div className="activity-item">

                <div>
                  <strong>
                    Farmer
                  </strong>

                  <p>
                    {policy.farmer}
                  </p>
                </div>

              </div>

              <div className="activity-item">

                <div>
                  <strong>
                    Premium
                  </strong>

                  <p>
                    {policy.premium} ETH
                  </p>
                </div>

              </div>

              <div className="activity-item">

                <div>
                  <strong>
                    Coverage
                  </strong>

                  <p>
                    {policy.coverageAmount} ETH
                  </p>
                </div>

              </div>

              <div className="activity-item">

                <div>
                  <strong>
                    Status
                  </strong>

                  <p>
                    {policy.active
                      ? "Active"
                      : "Inactive"}
                  </p>
                </div>

              </div>

              <div className="activity-item">

                <div>
                  <strong>
                    Payout
                  </strong>

                  <p>
                    {policy.payoutTriggered
                      ? "Triggered"
                      : "Not Triggered"}
                  </p>
                </div>

              </div>

            </section>
          )}

          {/* Recent Activity */}
          <section className="activity">

            <h2>
              Recent Activity
            </h2>

            <div className="activity-item">

              <span>✓</span>

              <div>
                <strong>
                  Insurance policy verified
                </strong>

                <p>
                  Policy information successfully recorded.
                </p>
              </div>

            </div>

            <div className="activity-item">

              <span>✓</span>

              <div>
                <strong>
                  Environmental data received
                </strong>

                <p>
                  Weather and agricultural signals available.
                </p>
              </div>

            </div>

            <div className="activity-item">

              <span>✓</span>

              <div>
                <strong>
                  Risk assessment completed
                </strong>

                <p>
                  Current farm risk classified as low.
                </p>
              </div>

            </div>

          </section>

        </main>

      </div>
    </>
  );
}

export default App;