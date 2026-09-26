from datetime import datetime
import os
import time

import requests
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()


# ============================================================
# CONFIGURATION
# ============================================================

APP_NAME = "AgriShield Backend"

FRONTEND_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

# Demonstration farm location
FARM_LATITUDE = float(
    os.getenv("FARM_LATITUDE", "13.08")
)

FARM_LONGITUDE = float(
    os.getenv("FARM_LONGITUDE", "80.27")
)

# Risk configuration
PAYOUT_RISK_THRESHOLD = int(
    os.getenv("PAYOUT_RISK_THRESHOLD", "20")
)

WEATHER_WEIGHT = float(
    os.getenv("WEATHER_WEIGHT", "0.5")
)

CROP_WEIGHT = float(
    os.getenv("CROP_WEIGHT", "0.5")
)

# Prototype rice active-growth NDVI reference
RICE_NDVI_REFERENCE = float(
    os.getenv("RICE_NDVI_REFERENCE", "0.70")
)

# Sentinel demonstration period
NDVI_FROM_DATE = os.getenv(
    "NDVI_FROM_DATE",
    "2026-08-01T00:00:00Z"
)

NDVI_TO_DATE = os.getenv(
    "NDVI_TO_DATE",
    "2026-09-19T23:59:59Z"
)

# ============================================================
# COPERNICUS DATA SPACE
# ============================================================

SENTINEL_CLIENT_ID = os.getenv(
    "SENTINEL_CLIENT_ID"
)

SENTINEL_CLIENT_SECRET = os.getenv(
    "SENTINEL_CLIENT_SECRET"
)

SENTINEL_TOKEN_URL = (
    "https://identity.dataspace.copernicus.eu/"
    "auth/realms/CDSE/protocol/openid-connect/token"
)

SENTINEL_STATISTICS_URL = (
    "https://sh.dataspace.copernicus.eu/statistics/v1"
)

# Cached Sentinel token
_sentinel_access_token = None
_sentinel_token_expiry = 0


# ============================================================
# BLOCKCHAIN CONFIGURATION
# ============================================================

CONTRACT_ADDRESS = os.getenv(
    "CONTRACT_ADDRESS",
    "0xFe44143619CFE2Cd1eE17BeA7a551C5F5e4F0CE9"
)

SEPOLIA_RPC_URL = os.getenv(
    "SEPOLIA_RPC_URL"
)

ORACLE_PRIVATE_KEY = os.getenv(
    "ORACLE_PRIVATE_KEY"
)

ORACLE_ENABLED = (
    os.getenv(
        "ORACLE_ENABLED",
        "false"
    ).lower()
    == "true"
)

ORACLE_API_KEY = os.getenv(
    "ORACLE_API_KEY"
)

CHAIN_ID = 11155111

# Minimal ABI required by backend
CONTRACT_ABI = [
    {
        "inputs": [],
        "name": "oracle",
        "outputs": [
            {
                "internalType": "address",
                "name": "",
                "type": "address"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "getBalance",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "policyId",
                "type": "uint256"
            }
        ],
        "name": "policies",
        "outputs": [
            {
                "internalType": "address",
                "name": "farmer",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "premium",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "coverageAmount",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "startTime",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "endTime",
                "type": "uint256"
            },
            {
                "internalType": "bool",
                "name": "active",
                "type": "bool"
            },
            {
                "internalType": "bool",
                "name": "payoutTriggered",
                "type": "bool"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "policyId",
                "type": "uint256"
            }
        ],
        "name": "triggerPayout",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
]


# ============================================================
# FASTAPI
# ============================================================

app = FastAPI(
    title=APP_NAME,
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# GENERAL HELPERS
# ============================================================

def clamp(
    value: float,
    minimum: float = 0,
    maximum: float = 100
) -> float:
    return max(
        minimum,
        min(maximum, value)
    )


def calculate_risk_level(
    risk_score: int
) -> str:

    if risk_score < 40:
        return "Low Risk"

    if risk_score < 70:
        return "Moderate Risk"

    return "High Risk"


# ============================================================
# SENTINEL AUTHENTICATION
# ============================================================

def get_sentinel_access_token():

    global _sentinel_access_token
    global _sentinel_token_expiry

    if (
        _sentinel_access_token
        and time.time()
        < _sentinel_token_expiry
    ):
        return _sentinel_access_token

    if not SENTINEL_CLIENT_ID:
        raise RuntimeError(
            "SENTINEL_CLIENT_ID is not configured"
        )

    if not SENTINEL_CLIENT_SECRET:
        raise RuntimeError(
            "SENTINEL_CLIENT_SECRET is not configured"
        )

    response = requests.post(
        SENTINEL_TOKEN_URL,
        data={
            "grant_type":
                "client_credentials",
            "client_id":
                SENTINEL_CLIENT_ID,
            "client_secret":
                SENTINEL_CLIENT_SECRET,
        },
        timeout=30
    )

    if response.status_code != 200:
        raise RuntimeError(
            "Sentinel authentication failed: "
            f"{response.status_code}"
        )

    token_data = response.json()

    _sentinel_access_token = (
        token_data["access_token"]
    )

    expires_in = int(
        token_data.get(
            "expires_in",
            3600
        )
    )

    # Refresh one minute before expiration
    _sentinel_token_expiry = (
        time.time()
        + max(expires_in - 60, 60)
    )

    return _sentinel_access_token


# ============================================================
# NDVI
# ============================================================

def fetch_ndvi():

    access_token = (
        get_sentinel_access_token()
    )

    payload = {
        "input": {
            "bounds": {
                "bbox": [
                    80.265,
                    13.075,
                    80.275,
                    13.085
                ],
                "properties": {
                    "crs":
                        "http://www.opengis.net/"
                        "def/crs/EPSG/0/4326"
                }
            },
            "data": [
                {
                    "type":
                        "sentinel-2-l2a",

                    "dataFilter": {
                        "timeRange": {
                            "from":
                                NDVI_FROM_DATE,
                            "to":
                                NDVI_TO_DATE
                        },
                        "maxCloudCoverage":
                            30
                    }
                }
            ]
        },

        "aggregation": {
            "timeRange": {
                "from":
                    NDVI_FROM_DATE,
                "to":
                    NDVI_TO_DATE
            },

            "aggregationInterval": {
                "of": "P1D"
            },

            "evalscript": """
//VERSION=3

function setup() {
    return {
        input: [
            "B04",
            "B08",
            "dataMask"
        ],

        output: [
            {
                id: "ndvi",
                bands: 1
            },
            {
                id: "dataMask",
                bands: 1
            }
        ]
    };
}

function evaluatePixel(sample) {

    let denominator =
        sample.B08 + sample.B04;

    let ndvi = 0;

    if (denominator !== 0) {
        ndvi =
            (sample.B08 - sample.B04)
            / denominator;
    }

    return {
        ndvi: [ndvi],
        dataMask: [sample.dataMask]
    };
}
"""
        }
    }

    response = requests.post(
        SENTINEL_STATISTICS_URL,
        headers={
            "Authorization":
                f"Bearer {access_token}",
            "Content-Type":
                "application/json"
        },
        json=payload,
        timeout=60
    )

    if response.status_code != 200:
        raise RuntimeError(
            "Sentinel Statistics API failed: "
            f"{response.status_code} "
            f"{response.text[:500]}"
        )

    result = response.json()

    try:
        ndvi = (
            result["data"][0]
            ["outputs"]["ndvi"]
            ["bands"]["B0"]
            ["stats"]["mean"]
        )
    except (
        KeyError,
        IndexError,
        TypeError
    ) as error:

        raise RuntimeError(
            "NDVI value was not available "
            "in Sentinel response"
        ) from error

    return float(ndvi)


# ============================================================
# WEATHER
# ============================================================

def fetch_weather():

    url = (
        "https://api.open-meteo.com/v1/forecast"
    )

    params = {
        "latitude":
            FARM_LATITUDE,

        "longitude":
            FARM_LONGITUDE,

        "daily":
            "rain_sum,temperature_2m_mean",

        "forecast_days":
            7,

        "timezone":
            "auto"
    }

    response = requests.get(
        url,
        params=params,
        timeout=30
    )

    response.raise_for_status()

    data = response.json()

    daily = data["daily"]

    rainfall_values = [
        float(value or 0)
        for value
        in daily["rain_sum"]
    ]

    temperature_values = [
        float(value)
        for value
        in daily[
            "temperature_2m_mean"
        ]
    ]

    seven_day_rainfall = sum(
        rainfall_values
    )

    today_rainfall = (
        rainfall_values[0]
        if rainfall_values
        else 0
    )

    today_temperature = (
        temperature_values[0]
        if temperature_values
        else None
    )

    weather_risk = round(
        min(
            seven_day_rainfall * 2,
            100
        )
    )

    return {
        "today_rainfall_mm":
            today_rainfall,

        "today_temperature_c":
            today_temperature,

        "seven_day_rainfall_mm":
            round(
                seven_day_rainfall,
                2
            ),

        "rainfall_series":
            rainfall_values,

        "weather_risk":
            weather_risk
    }


# ============================================================
# RISK ENGINE
# ============================================================

def build_risk_result():

    weather = fetch_weather()

    ndvi = fetch_ndvi()

    weather_risk = weather[
        "weather_risk"
    ]

    crop_risk = round(
        clamp(
            (
                RICE_NDVI_REFERENCE
                - ndvi
            ) * 100
        )
    )

    risk_score = round(
        (
            weather_risk
            * WEATHER_WEIGHT
        )
        +
        (
            crop_risk
            * CROP_WEIGHT
        )
    )

    risk_score = round(
        clamp(risk_score)
    )

    risk_level = (
        calculate_risk_level(
            risk_score
        )
    )

    payout_eligible = (
        risk_score
        >= PAYOUT_RISK_THRESHOLD
    )

    if payout_eligible:
        payout_reason = (
            "High agricultural risk "
            "threshold reached"
        )
    else:
        payout_reason = (
            "Risk threshold for payout "
            "not reached"
        )

    return {
        "farm_location": {
            "latitude":
                FARM_LATITUDE,

            "longitude":
                FARM_LONGITUDE
        },

        "crop": "Rice",

        "assumed_growth_stage":
            "Active growth / tillering",

        "weather": weather,

        "ndvi": round(
            ndvi,
            4
        ),

        "crop_risk":
            crop_risk,

        "soil_risk":
            0,

        "weights": {
            "weather":
                WEATHER_WEIGHT,

            "crop":
                CROP_WEIGHT
        },

        "risk_score":
            risk_score,

        "risk_level":
            risk_level,

        "payout_threshold":
            PAYOUT_RISK_THRESHOLD,

        "payout_eligible":
            payout_eligible,

        "payout_reason":
            payout_reason,

        "methodology": {
            "weather":
                "7-day accumulated rainfall "
                "prototype risk factor",

            "crop":
                "Sentinel-2 NDVI compared "
                "with a rice active-growth "
                "prototype reference",

            "soil":
                "Not yet connected",

            "production_note":
                "Thresholds require local "
                "historical calibration and "
                "field validation before "
                "automated insurance decisions."
        }
    }


# ============================================================
# WEB3 HELPERS
# ============================================================

def get_web3():

    if not SEPOLIA_RPC_URL:
        raise RuntimeError(
            "SEPOLIA_RPC_URL is not configured"
        )

    try:
        from web3 import Web3
    except ImportError as error:

        raise RuntimeError(
            "web3 is not installed. "
            "Run: python -m pip install web3"
        ) from error

    w3 = Web3(
        Web3.HTTPProvider(
            SEPOLIA_RPC_URL,
            request_kwargs={
                "timeout": 30
            }
        )
    )

    if not w3.is_connected():
        raise RuntimeError(
            "Unable to connect to Sepolia RPC"
        )

    return w3


def get_contract(w3):

    checksum_address = (
        w3.to_checksum_address(
            CONTRACT_ADDRESS
        )
    )

    return w3.eth.contract(
        address=checksum_address,
        abi=CONTRACT_ABI
    )


def read_on_chain_policy(
    policy_id: int = 1
):

    w3 = get_web3()

    contract = get_contract(w3)

    result = (
        contract.functions
        .policies(policy_id)
        .call()
    )

    return {
        "farmer":
            result[0],

        "premium_wei":
            int(result[1]),

        "coverage_wei":
            int(result[2]),

        "start_time":
            int(result[3]),

        "end_time":
            int(result[4]),

        "active":
            bool(result[5]),

        "payout_triggered":
            bool(result[6]),

        "contract_balance_wei":
            int(
                w3.eth
                .get_balance(
                    contract.address
                )
            )
    }


# ============================================================
# ORACLE PAYOUT
# ============================================================

def execute_oracle_payout(
    policy_id: int = 1
):

    if not ORACLE_ENABLED:
        raise RuntimeError(
            "Backend oracle execution is disabled. "
            "Set ORACLE_ENABLED=true locally when ready."
        )

    if not ORACLE_PRIVATE_KEY:
        raise RuntimeError(
            "ORACLE_PRIVATE_KEY is not configured."
        )

    w3 = get_web3()

    contract = get_contract(w3)

    account = (
        w3.eth.account
        .from_key(
            ORACLE_PRIVATE_KEY
        )
    )

    contract_oracle = (
        contract.functions
        .oracle()
        .call()
    )

    if (
        contract_oracle.lower()
        != account.address.lower()
    ):
        raise RuntimeError(
            "Configured oracle wallet does not "
            "match the smart contract oracle."
        )

    policy = read_on_chain_policy(
        policy_id
    )

    if not policy["active"]:
        raise RuntimeError(
            "Policy is not active."
        )

    if policy[
        "payout_triggered"
    ]:
        raise RuntimeError(
            "Payout has already been triggered."
        )

    if (
        policy["contract_balance_wei"]
        < policy["coverage_wei"]
    ):
        raise RuntimeError(
            "Insufficient contract balance "
            "for coverage payout."
        )

    function = (
        contract.functions
        .triggerPayout(policy_id)
    )

    nonce = (
        w3.eth
        .get_transaction_count(
            account.address,
            "pending"
        )
    )

    latest_block = (
        w3.eth.get_block(
            "latest"
        )
    )

    base_fee = latest_block.get(
        "baseFeePerGas"
    )

    if base_fee is not None:

        priority_fee = (
            w3.to_wei(
                1,
                "gwei"
            )
        )

        max_fee = (
            int(base_fee) * 2
            + priority_fee
        )

        transaction = (
            function
            .build_transaction(
                {
                    "from":
                        account.address,

                    "nonce":
                        nonce,

                    "chainId":
                        CHAIN_ID,

                    "maxPriorityFeePerGas":
                        priority_fee,

                    "maxFeePerGas":
                        max_fee
                }
            )
        )

    else:

        transaction = (
            function
            .build_transaction(
                {
                    "from":
                        account.address,

                    "nonce":
                        nonce,

                    "chainId":
                        CHAIN_ID,

                    "gasPrice":
                        w3.eth.gas_price
                }
            )
        )

    estimated_gas = (
        w3.eth
        .estimate_gas(
            transaction
        )
    )

    transaction["gas"] = int(
        estimated_gas * 1.20
    )

    signed = (
        w3.eth.account
        .sign_transaction(
            transaction,
            private_key=
                ORACLE_PRIVATE_KEY
        )
    )

    raw_transaction = getattr(
        signed,
        "raw_transaction",
        None
    )

    if raw_transaction is None:
        raw_transaction = (
            signed.rawTransaction
        )

    tx_hash = (
        w3.eth
        .send_raw_transaction(
            raw_transaction
        )
    )

    receipt = (
        w3.eth
        .wait_for_transaction_receipt(
            tx_hash,
            timeout=120
        )
    )

    return {
        "transaction_hash":
            tx_hash.hex(),

        "block_number":
            receipt["blockNumber"],

        "status":
            receipt["status"],

        "oracle":
            account.address,

        "policy_id":
            policy_id
    }


# ============================================================
# API ROUTES
# ============================================================

@app.get("/")
def home():

    return {
        "message":
            "AgriShield backend is running",

        "version":
            "1.0.0"
    }


@app.get("/health")
def health():

    return {
        "status":
            "ok"
    }


@app.get("/test-env")
def test_env():

    return {
        "client_id_loaded":
            bool(
                SENTINEL_CLIENT_ID
            ),

        "client_secret_loaded":
            bool(
                SENTINEL_CLIENT_SECRET
            ),

        "contract_configured":
            bool(
                CONTRACT_ADDRESS
            ),

        "sepolia_rpc_configured":
            bool(
                SEPOLIA_RPC_URL
            ),

        "oracle_private_key_configured":
            bool(
                ORACLE_PRIVATE_KEY
            ),

        "oracle_enabled":
            ORACLE_ENABLED
    }


@app.get("/sentinel-token")
@app.get("/sentinel-test")
def sentinel_test():

    try:

        token = (
            get_sentinel_access_token()
        )

        return {
            "sentinel_authenticated":
                True,

            "token_available":
                bool(token)
        }

    except Exception as error:

        return {
            "sentinel_authenticated":
                False,

            "error":
                str(error)
        }


@app.get("/ndvi-test")
def ndvi_test():

    return {
        "message":
            "NDVI endpoint ready",

        "latitude":
            FARM_LATITUDE,

        "longitude":
            FARM_LONGITUDE
    }


@app.get("/ndvi")
def get_ndvi():

    try:

        ndvi = fetch_ndvi()

        return {
            "ndvi":
                round(ndvi, 4),

            "source":
                "Sentinel-2 L2A / Copernicus Data Space",

            "latitude":
                FARM_LATITUDE,

            "longitude":
                FARM_LONGITUDE
        }

    except Exception as error:

        raise HTTPException(
            status_code=502,
            detail=str(error)
        )


@app.get("/weather")
def get_weather():

    try:

        return fetch_weather()

    except Exception as error:

        raise HTTPException(
            status_code=502,
            detail=str(error)
        )


@app.get("/risk-check")
def risk_check():

    try:

        return build_risk_result()

    except Exception as error:

        raise HTTPException(
            status_code=502,
            detail=str(error)
        )


@app.get("/blockchain-policy/{policy_id}")
def blockchain_policy(
    policy_id: int
):

    try:

        return read_on_chain_policy(
            policy_id
        )

    except Exception as error:

        raise HTTPException(
            status_code=502,
            detail=str(error)
        )


@app.get("/oracle-status")
def oracle_status():

    web3_available = False
    rpc_connected = False

    try:

        from web3 import Web3

        web3_available = True

        if SEPOLIA_RPC_URL:

            w3 = Web3(
                Web3.HTTPProvider(
                    SEPOLIA_RPC_URL,
                    request_kwargs={
                        "timeout": 10
                    }
                )
            )

            rpc_connected = (
                w3.is_connected()
            )

    except Exception:
        pass

    return {
        "oracle_enabled":
            ORACLE_ENABLED,

        "private_key_configured":
            bool(
                ORACLE_PRIVATE_KEY
            ),

        "rpc_configured":
            bool(
                SEPOLIA_RPC_URL
            ),

        "rpc_connected":
            rpc_connected,

        "web3_installed":
            web3_available,

        "contract_address":
            CONTRACT_ADDRESS,

        "chain_id":
            CHAIN_ID
    }


@app.post("/oracle/process/{policy_id}")
def process_oracle(
    policy_id: int
):

    if (
        ORACLE_API_KEY
        and ORACLE_API_KEY
        != os.getenv(
            "X_ORACLE_API_KEY"
        )
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid API key."
        )

    try:

        risk = (
            build_risk_result()
        )

        policy = (
            read_on_chain_policy(
                policy_id
            )
        )

        response = {
            "risk":
                risk,

            "policy":
                policy,

            "action":
                "NO_PAYOUT"
        }

        if not risk[
            "payout_eligible"
        ]:

            response[
                "reason"
            ] = (
                "Risk threshold not reached."
            )

            return response

        if not policy[
            "active"
        ]:

            response[
                "reason"
            ] = (
                "Policy is not active."
            )

            return response

        if policy[
            "payout_triggered"
        ]:

            response[
                "reason"
            ] = (
                "Policy payout already triggered."
            )

            return response

        if not ORACLE_ENABLED:

            response[
                "action"
            ] = "PAYOUT_READY"

            response[
                "reason"
            ] = (
                "Risk threshold reached, "
                "but backend oracle execution "
                "is disabled."
            )

            return response

        payout = (
            execute_oracle_payout(
                policy_id
            )
        )

        response[
            "action"
        ] = "PAYOUT_TRIGGERED"

        response[
            "payout"
        ] = payout

        response[
            "reason"
        ] = (
            "Risk threshold reached and "
            "smart-contract payout executed."
        )

        return response

    except Exception as error:

        raise HTTPException(
            status_code=502,
            detail=str(error)
        )