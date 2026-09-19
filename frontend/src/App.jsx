import { useState } from 'react'

function App() {
  const [riskScore, setRiskScore] = useState(24)
  const [riskLevel, setRiskLevel] = useState('Low Risk')
  const rainfallRisk = 20
  const soilRisk = 30
  const cropRisk = 25

  const calculateRisk = () => {
  return Math.round(
    rainfallRisk * 0.4 +
    soilRisk * 0.3 +
    cropRisk * 0.3
  )
}
  return (
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
            Monitor your farm risk, insurance policy and verified agricultural data.
          </p>
        </section>

        {/* Summary Cards */}
        <section className="cards">

          <div className="card">
            <h3>🌦️ Weather Risk</h3>
            <p className="value">LOW</p>
            <p>Current environmental risk</p>
          </div>

          <div className="card">
            <h3>🛡️ Insurance</h3>
            <p className="value">ACTIVE</p>
            <p>Policy is currently valid</p>
          </div>

          <div className="card">
            <h3>💰 Coverage</h3>
            <p className="value">₹50,000</p>
            <p>Maximum protected amount</p>
          </div>

        </section>

        {/* Risk Verification */}
        <section className="risk-section">

          <div className="section-header">
            <div>
              <h2>Multi-Source Risk Verification</h2>
              <p>
                Agricultural risk is evaluated using multiple environmental signals.
              </p>
            </div>

            <button
              className="primary-button"
              onClick={() => {
                const newScore = calculateRisk()

                setRiskScore(newScore)

                if (newScore < 40) {
                  setRiskLevel('Low Risk')
                } else if (newScore < 70) {
                  setRiskLevel('Moderate Risk')
                } else {
                  setRiskLevel('High Risk')
                }
              }}
>
  Check Risk
</button>
          </div>

          <div className="risk-grid">

            <div className="risk-card">
              <span>🌧️</span>
              <h3>Weather Risk</h3>
              <strong>{rainfallRisk}</strong>
              <p>Demo risk contribution</p>
            </div>

            <div className="risk-card">
              <span>💧</span>
              <h3>Soil Risk</h3>
              <strong>{soilRisk}</strong>
              <p>Demo risk contribution</p>
            </div>

            <div className="risk-card">
              <span>🌱</span>
              <h3>Crop Risk</h3>
              <strong>{cropRisk}</strong>
              <p>Demo risk contribution</p>
            </div>

          </div>

        </section>

        {/* Risk Result */}
        <section className="risk-result">

          <div>
            <span className="status-label">CURRENT FARM RISK</span>
            <h2>{riskLevel}</h2>
            <p>
              No predefined drought or flood trigger detected.
            </p>
          </div>

          <div className="risk-score">
            <span>Risk Score</span>
            <strong>{riskScore}</strong>
            <small>/ 100</small>
          </div>

        </section>

        {/* Actions */}
        <section className="actions">

          <h2>Quick Actions</h2>

          <div className="action-grid">

            <button>📋 View Policy</button>
            <button>💳 Buy Insurance</button>
            <button>💸 View Payouts</button>
            <button>🔗 Blockchain Record</button>
            <button>🏦 Credit Assessment</button>
            <button>📊 Detailed Analysis</button>

          </div>

        </section>

        {/* Recent Activity */}
        <section className="activity">

          <h2>Recent Activity</h2>

          <div className="activity-item">
            <span>✓</span>
            <div>
              <strong>Insurance policy verified</strong>
              <p>Policy information successfully recorded.</p>
            </div>
          </div>

          <div className="activity-item">
            <span>✓</span>
            <div>
              <strong>Environmental data received</strong>
              <p>Weather and agricultural signals available.</p>
            </div>
          </div>

          <div className="activity-item">
            <span>✓</span>
            <div>
              <strong>Risk assessment completed</strong>
              <p>Current farm risk classified as low.</p>
            </div>
          </div>

        </section>

      </main>

    </div>
  )
}

export default App