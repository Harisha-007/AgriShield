import { BrowserProvider, Contract } from "ethers";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "./contract";
import { useEffect, useState } from "react";

function App() {
  const [walletAddress, setWalletAddress] = useState(null);

  const [riskScore, setRiskScore] = useState(24);
  const [riskLevel, setRiskLevel] = useState("Low Risk");
  const [weather, setWeather] = useState(null);
  const [ndvi, setNdvi] = useState(null);

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

  const rainfallRisk = weather
    ? Math.min(weather.rain_sum[0] * 10, 100)
    : 0;

  const cropRisk =
    ndvi !== null
      ? Math.round(
          Math.max(0, Math.min(100, (0.6 - ndvi) * 100))
        )
      : 0;

  const soilRisk = 0;

  const calculateRisk = () => {
    return Math.round(
      rainfallRisk * 0.5 + cropRisk * 0.5
    );
  };

  const handleRiskCheck = () => {
    const newScore = calculateRisk();

    setRiskScore(newScore);

    if (newScore < 40) {
      setRiskLevel("Low Risk");
    } else if (newScore < 70) {
      setRiskLevel("Moderate Risk");
    } else {
      setRiskLevel("High Risk");
    }
  };

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
                  Demo risk contribution
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
                  Demo risk contribution
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

              <h2>
                {riskLevel}
              </h2>

              <p>
                No predefined drought or flood trigger detected.
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

              <button>
                📋 View Policy
              </button>

              <button>
                💳 Buy Insurance
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