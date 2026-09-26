
import {
  BrowserProvider,
  Contract,
  formatEther
} from "ethers";
import {
  CONTRACT_ADDRESS,
  CONTRACT_ABI
} from "./contract";
import {
  useEffect,
  useState
} from "react";

function App() {
  const [walletAddress, setWalletAddress] =
    useState(null);

  const [riskScore, setRiskScore] =
    useState(null);

  const [riskLevel, setRiskLevel] =
    useState("Waiting for risk assessment");

  const [weather, setWeather] =
    useState(null);

  const [ndvi, setNdvi] =
    useState(null);

  const [sevenDayRainfall, setSevenDayRainfall] =
    useState(null);

  const [rainfallRisk, setRainfallRisk] =
    useState(null);

  const [cropRisk, setCropRisk] =
    useState(null);

  const [soilRisk] =
    useState(0);

  const [policy, setPolicy] =
    useState(null);

  const [payoutTxHash, setPayoutTxHash] =
    useState(() => {
      return localStorage.getItem(
        "agrishield_payout_tx_hash"
      );
    });

  const [payoutEligible, setPayoutEligible] =
    useState(false);

  const [payoutReason, setPayoutReason] =
    useState(
      "Run Check Risk to evaluate the farm."
    );

  const [creditScore, setCreditScore] =
    useState(null);

  const [riskLoading, setRiskLoading] =
    useState(false);

  // =====================================================
  // CONNECT WALLET
  // =====================================================

  const connectWallet = async () => {
    if (!window.ethereum) {
      alert("Please install MetaMask");
      return;
    }

    try {
      const provider =
        new BrowserProvider(
          window.ethereum
        );

      const accounts =
        await provider.send(
          "eth_requestAccounts",
          []
        );

      setWalletAddress(accounts[0]);

      const contract =
        new Contract(
          CONTRACT_ADDRESS,
          CONTRACT_ABI,
          provider
        );

      const oracleAddress =
        await contract.oracle();

      const balance =
        await contract.getBalance();

      console.log(
        "Contract Oracle:",
        oracleAddress
      );

      console.log(
        "Contract Balance:",
        balance.toString()
      );

      await getPolicy();
    } catch (error) {
      console.error(
        "Wallet connection error:",
        error
      );
    }
  };

  // =====================================================
  // GET POLICY
  // =====================================================

  const getPolicy = async () => {
    if (!window.ethereum) {
      return null;
    }

    try {
      const provider =
        new BrowserProvider(
          window.ethereum
        );

      const contract =
        new Contract(
          CONTRACT_ADDRESS,
          CONTRACT_ABI,
          provider
        );

      const result =
        await contract.policies(1);

      const policyData = {
        farmer: result.farmer,
        premium: formatEther(
          result.premium
        ),
        coverageAmount:
          formatEther(
            result.coverageAmount
          ),
        active: result.active,
        payoutTriggered:
          result.payoutTriggered
      };

      setPolicy(policyData);

      return policyData;
    } catch (error) {
      console.error(
        "Policy read error:",
        error
      );

      return null;
    }
  };

  // =====================================================
  // CREATE POLICY
  // =====================================================

  const createPolicy = async () => {
    if (!window.ethereum) {
      alert("Please install MetaMask");
      return;
    }

    try {
      const provider =
        new BrowserProvider(
          window.ethereum
        );

      const signer =
        await provider.getSigner();

      const contract =
        new Contract(
          CONTRACT_ADDRESS,
          CONTRACT_ABI,
          signer
        );

      const tx =
        await contract.createPolicy(
          1,
          "10000000000000",
          "500000000000000",
          2592000,
          {
            value:
              "10000000000000"
          }
        );

      console.log(
        "Policy creation transaction:",
        tx.hash
      );

      await tx.wait();

      await getPolicy();

      setPayoutTxHash(null);

      localStorage.removeItem(
        "agrishield_payout_tx_hash"
      );

      alert(
        "Insurance policy created successfully."
      );
    } catch (error) {
      console.error(
        "Policy creation error:",
        error
      );

      alert(
        error?.shortMessage ||
          error?.reason ||
          "Policy creation failed."
      );
    }
  };

  // =====================================================
  // TRIGGER PAYOUT
  // =====================================================

  const triggerPayout = async () => {
    if (!window.ethereum) {
      alert("Please install MetaMask");
      return false;
    }

    try {
      const provider =
        new BrowserProvider(
          window.ethereum
        );

      const signer =
        await provider.getSigner();

      const contract =
        new Contract(
          CONTRACT_ADDRESS,
          CONTRACT_ABI,
          signer
        );

      const tx =
        await contract.triggerPayout(
          1
        );

      console.log(
        "Payout transaction:",
        tx.hash
      );

      await tx.wait();

      setPayoutTxHash(
        tx.hash
      );

      localStorage.setItem(
        "agrishield_payout_tx_hash",
        tx.hash
      );

      await getPolicy();

      alert(
        "Insurance payout recorded successfully on Ethereum Sepolia."
      );

      return true;
    } catch (error) {
      console.error(
        "Payout error:",
        error
      );

      alert(
        error?.shortMessage ||
          error?.reason ||
          "Payout transaction failed."
      );

      return false;
    }
  };

  // =====================================================
  // FUND CONTRACT
  // =====================================================

  const fundContract = async () => {
    if (!window.ethereum) {
      alert("Please install MetaMask");
      return;
    }

    try {
      const provider =
        new BrowserProvider(
          window.ethereum
        );

      const signer =
        await provider.getSigner();

      const contract =
        new Contract(
          CONTRACT_ADDRESS,
          CONTRACT_ABI,
          signer
        );

      const tx =
        await contract.fundContract({
          value:
            "1000000000000000"
        });

      await tx.wait();

      alert(
        "Contract funded successfully."
      );
    } catch (error) {
      console.error(
        "Funding error:",
        error
      );

      alert(
        error?.shortMessage ||
          error?.reason ||
          "Funding transaction failed."
      );
    }
  };

  // =====================================================
  // CREDIT READINESS INDEX
  // =====================================================

  const calculateCreditScore =
    (policyData) => {
      if (!policyData) {
        return 0;
      }

      let score = 0;

      // Verified insurance policy
      score += 40;

      // Verified payout lifecycle
      if (
        policyData.payoutTriggered
      ) {
        score += 30;
      }

      // Completed policy lifecycle
      if (
        !policyData.active
      ) {
        score += 30;
      }

      return score;
    };

  // =====================================================
  // BACKEND RISK ENGINE
  // =====================================================

  const loadRiskData =
    async () => {
      setRiskLoading(true);

      try {
        const response =
          await fetch(
            "http://localhost:8000/risk-check"
          );

        if (!response.ok) {
          throw new Error(
            "Backend risk request failed"
          );
        }

        const data =
          await response.json();

        console.log(
          "AgriShield Backend Risk:",
          data
        );

        // Weather
        setWeather(
          data.weather
        );

        setSevenDayRainfall(
          data.weather
            .seven_day_rainfall_mm
        );

        setRainfallRisk(
          data.weather
            .weather_risk
        );

        // Satellite
        setNdvi(
          data.ndvi
        );

        setCropRisk(
          data.crop_risk
        );

        // Soil
        // Currently reserved
        setRiskScore(
          data.risk_score
        );

        setRiskLevel(
          data.risk_level
        );

        setPayoutEligible(
          data.payout_eligible
        );

        setPayoutReason(
          data.payout_reason
        );

        // Read blockchain policy
        const policyData =
          await getPolicy();

        const newCreditScore =
          calculateCreditScore(
            policyData
          );

        setCreditScore(
          newCreditScore
        );

        return data;
      } catch (error) {
        console.error(
          "Risk check error:",
          error
        );

        alert(
          "Unable to calculate risk from the backend. Make sure FastAPI is running."
        );

        return null;
      } finally {
        setRiskLoading(false);
      }
    };

  // =====================================================
  // INITIAL LOAD
  // =====================================================

  useEffect(() => {
    getPolicy();
    loadRiskData();
  }, []);

  // =====================================================
  // UI
  // =====================================================

  return (
    <>
      {/* WALLET */}

      <div className="wallet-container">
        <button
          onClick={
            connectWallet
          }
        >
          {walletAddress
            ? "Connected: " +
              walletAddress.slice(
                0,
                6
              ) +
              "..." +
              walletAddress.slice(
                -4
              )
            : "🔗 Connect Wallet"}
        </button>
      </div>

      <div className="app">

        {/* HEADER */}

        <header className="navbar">

          <div>
            <h1>
              🌾 AgriShield
            </h1>

            <p>
              Smart Crop Insurance Platform
            </p>
          </div>

          <div className="farmer-info">

            <span>
              Farmer
            </span>

            <strong>
              Demo Farmer
            </strong>

          </div>

        </header>

        {/* DASHBOARD */}

        <main className="dashboard">

          {/* WELCOME */}

          <section className="welcome">

            <h2>
              Welcome back, Farmer 👋
            </h2>

            <p>
              Monitor your farm risk,
              insurance policy and
              verified agricultural data.
            </p>

          </section>

          {/* ENVIRONMENT */}

          <section className="weather-section">

            <h2>
              🌦️ Environmental Conditions
            </h2>

            {weather ? (
              <>
                <p>
                  Temperature:{" "}
                  {
                    weather
                      .today_temperature_c
                  }
                  °C | Today's Rain:{" "}
                  {
                    weather
                      .today_rainfall_mm
                  }{" "}
                  mm
                </p>

                <p>
                  7-Day Rainfall:{" "}
                  {
                    sevenDayRainfall
                  }{" "}
                  mm
                </p>

                <small>
                  Weather source:
                  Open-Meteo
                </small>
              </>
            ) : (
              <p>
                Loading environmental
                data...
              </p>
            )}

          </section>

          {/* SUMMARY CARDS */}

          <section className="cards">

            <div className="card">

              <h3>
                🌦️ Weather Risk
              </h3>

              <p className="value">
                {rainfallRisk !== null
                  ? rainfallRisk
                  : "--"}
              </p>

              <p>
                Backend-calculated
                environmental risk
              </p>

            </div>

            <div className="card">

              <h3>
                🛡️ Insurance
              </h3>

              <p className="value">

                {policy
                  ? policy.active
                    ? "ACTIVE"
                    : "INACTIVE"
                  : "LOADING..."}

              </p>

              <p>

                {policy
                  ? policy.active
                    ? "Policy is currently valid"
                    : "Policy is no longer active"
                  : "Checking blockchain policy..."}

              </p>

            </div>

          </section>

          {/* RISK VERIFICATION */}

          <section className="risk-section">

            <div className="section-header">

              <div>

                <h2>
                  Multi-Source Risk
                  Verification
                </h2>

                <p>
                  Risk is calculated by
                  the AgriShield backend
                  using weather and
                  Sentinel-2 NDVI.
                </p>

              </div>

              <button
                className="primary-button"
                onClick={
                  loadRiskData
                }
                disabled={
                  riskLoading
                }
              >
                {riskLoading
                  ? "Checking..."
                  : "Check Risk"}
              </button>

            </div>

            <div className="risk-grid">

              {/* WEATHER */}

              <div className="risk-card">

                <span>
                  🌧️
                </span>

                <h3>
                  Weather Risk
                </h3>

                <strong>
                  {rainfallRisk !== null
                    ? rainfallRisk
                    : "--"}
                </strong>

                <p>
                  7-day rainfall
                  contribution
                </p>

              </div>

              {/* SOIL */}

              <div className="risk-card">

                <span>
                  💧
                </span>

                <h3>
                  Soil Risk
                </h3>

                <strong>
                  {soilRisk}
                </strong>

                <p>
                  Real soil data
                  source pending
                </p>

              </div>

              {/* NDVI */}

              <div className="risk-card">

                <span>
                  🌱
                </span>

                <h3>
                  Crop Condition
                </h3>

                <strong>
                  {ndvi !== null
                    ? Number(ndvi).toFixed(
                        2
                      )
                    : "--"}
                </strong>

                <p>
                  Sentinel-2 NDVI
                </p>

              </div>

            </div>

            <small>

              Backend risk engine combines
              7-day rainfall and
              Sentinel-2 NDVI.
              Soil risk remains reserved
              for a future real soil-data
              source.

            </small>

            {/* METHODOLOGY */}

            <div className="methodology-note">

              <strong>
                Risk Methodology
              </strong>

              <p>
                Farm risk currently uses
                two verified signals:
                7-day rainfall and
                Sentinel-2 NDVI.
              </p>

              <p>
                Weather Risk and Crop Risk
                each contribute 50% to
                the prototype risk score.
              </p>

              <p>
                The demonstration assumes
                rice in the active-growth /
                tillering stage.
                Production deployment
                requires local historical
                calibration and field
                validation.
              </p>

            </div>

          </section>

          {/* RISK RESULT */}

          <section className="risk-result">

            <div>

              <span className="status-label">
                CURRENT FARM RISK
              </span>

              <h2>
                {riskLevel}
              </h2>

              <p>
                {payoutEligible
                  ? "🚨 Payout Eligible"
                  : "✅ Payout Not Eligible"}
              </p>

              <p>
                {payoutReason}
              </p>

              {creditScore !== null && (
                <div>

                  <h3>
                    💳 Credit Readiness Index
                  </h3>

                  <p>
                    Based on verified
                    blockchain insurance
                    history
                  </p>

                  <strong>
                    {creditScore}/100
                  </strong>

                </div>
              )}

            </div>

            <div className="risk-score">

              <span>
                Risk Score
              </span>

              <strong>
                {riskScore !== null
                  ? riskScore
                  : "--"}
              </strong>

              <small>
                / 100
              </small>

            </div>

          </section>

          {/* QUICK ACTIONS */}

          <section className="actions">

            <h2>
              Quick Actions
            </h2>

            <div className="action-grid">

              <button
                onClick={
                  createPolicy
                }
              >
                💳 Buy Insurance
              </button>

              <button
                onClick={
                  getPolicy
                }
              >
                🔍 View Policy
              </button>

              <button
                onClick={
                  triggerPayout
                }
              >
                💸 Trigger Payout
              </button>

              <button
                onClick={() => {

                  if (
                    payoutTxHash
                  ) {
                    window.open(
                      `https://sepolia.etherscan.io/tx/${payoutTxHash}`,
                      "_blank",
                      "noopener,noreferrer"
                    );
                  } else {
                    alert(
                      "No payout transaction recorded by this dashboard session yet."
                    );
                  }

                }}
              >
                💸 View Payouts
              </button>

              <button
                onClick={() => {

                  window.open(
                    `https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}`,
                    "_blank",
                    "noopener,noreferrer"
                  );

                }}
              >
                🔗 Blockchain Record
              </button>

              <button
                onClick={() => {

                  if (
                    creditScore !== null
                  ) {
                    alert(
                      `Credit Readiness Index: ${creditScore}/100\n\nThis is a prototype insurance-history index, not a bank-issued credit score.`
                    );
                  } else {
                    alert(
                      "Run Check Risk first."
                    );
                  }

                }}
              >
                🏦 Credit Assessment
              </button>

              <button
                onClick={() => {

                  alert(
                    `Risk Score: ${
                      riskScore ?? "--"
                    }/100\n\nRisk Level: ${riskLevel}\n\nWeather Risk: ${
                      rainfallRisk ?? "--"
                    }\n\nCrop Risk: ${
                      cropRisk ?? "--"
                    }\n\nNDVI: ${
                      ndvi !== null
                        ? Number(
                            ndvi
                          ).toFixed(
                            4
                          )
                        : "--"
                    }\n\nPayout Eligible: ${
                      payoutEligible
                        ? "Yes"
                        : "No"
                    }\n\nReason: ${payoutReason}`
                  );

                }}
              >
                📊 Detailed Analysis
              </button>

              <button
                onClick={
                  fundContract
                }
              >
                💰 Fund Contract
              </button>

            </div>

          </section>

          {/* POLICY */}

          {policy && (
            <section className="activity">

              <h2>
                📋 Insurance Policy #1
              </h2>

              <p>
                🔗 Blockchain Verified —
                Ethereum Sepolia
              </p>

              <p>
                Contract:{" "}
                <a
                  href={
                    `https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}`
                  }
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

              {payoutTxHash && (
                <div className="activity-item">

                  <div>

                    <strong>
                      Payout Transaction
                    </strong>

                    <p>

                      <a
                        href={
                          `https://sepolia.etherscan.io/tx/${payoutTxHash}`
                        }
                        target="_blank"
                        rel="noreferrer"
                      >
                        View confirmed
                        payout transaction
                      </a>

                    </p>

                  </div>

                </div>
              )}

            </section>
          )}

          {/* RECENT ACTIVITY */}

          <section className="activity">

            <h2>
              Recent Activity
            </h2>

            <div className="activity-item">

              <span>
                ✓
              </span>

              <div>

                <strong>
                  Insurance policy verified
                </strong>

                <p>
                  Policy information
                  retrieved from
                  Ethereum Sepolia.
                </p>

              </div>

            </div>

            <div className="activity-item">

              <span>
                ✓
              </span>

              <div>

                <strong>
                  Environmental data received
                </strong>

                <p>
                  Open-Meteo weather and
                  Sentinel-2 agricultural
                  data available.
                </p>

              </div>

            </div>

            <div className="activity-item">

              <span>
                ✓
              </span>

              <div>

                <strong>
                  Backend risk assessment
                </strong>

                <p>
                  Current farm risk:{" "}
                  {riskLevel}
                </p>

              </div>

            </div>

            {policy?.payoutTriggered && (
              <div className="activity-item">

                <span>
                  ✓
                </span>

                <div>

                  <strong>
                    Insurance payout recorded
                  </strong>

                  <p>
                    Blockchain policy
                    confirms the payout
                    has been triggered.
                  </p>

                </div>

              </div>
            )}

          </section>

        </main>

      </div>
    </>
  );
}

export default App;