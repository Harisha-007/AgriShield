from unittest import result

from fastapi import FastAPI
from dotenv import load_dotenv
import os
import requests
from fastapi.middleware.cors import CORSMiddleware
load_dotenv()

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def home():
    return {"message": "AgriShield backend is running"}

@app.get("/test-env")
def test_env():
    return {
        "client_id_loaded": bool(os.getenv("SENTINEL_CLIENT_ID")),
        "client_secret_loaded": bool(os.getenv("SENTINEL_CLIENT_SECRET"))
    }

@app.get("/sentinel-token")
@app.get("/sentinel-test")
def sentinel_test():
    response = requests.post(
        "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token",
        data={
            "grant_type": "client_credentials",
            "client_id": os.getenv("SENTINEL_CLIENT_ID"),
            "client_secret": os.getenv("SENTINEL_CLIENT_SECRET"),
        }
    )

    if response.status_code == 200:
        return {"sentinel_authenticated": True}

    return {
        "sentinel_authenticated": False,
        "status_code": response.status_code
    }
@app.get("/ndvi-test")
def ndvi_test():
    return {
        "message": "NDVI endpoint ready",
        "latitude": 13.08,
        "longitude": 80.27
    }
@app.get("/ndvi")
def get_ndvi():

    # 1. Get Sentinel Hub access token
    token_response = requests.post(
        "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token",
        data={
            "grant_type": "client_credentials",
            "client_id": os.getenv("SENTINEL_CLIENT_ID"),
            "client_secret": os.getenv("SENTINEL_CLIENT_SECRET"),
        }
    )

    if token_response.status_code != 200:
        return {
            "error": "Sentinel authentication failed",
            "status_code": token_response.status_code
        }

    access_token = token_response.json()["access_token"]

    # 2. Ask Sentinel Hub for NDVI statistics
    payload = {
        "input": {
            "bounds": {
                "bbox": [80.265, 13.075, 80.275, 13.085],
                "properties": {
                    "crs": "http://www.opengis.net/def/crs/EPSG/0/4326"
                }
            },
            "data": [
                {
                    "type": "sentinel-2-l2a",
                    "dataFilter": {
                        "timeRange": {
                            "from": "2026-08-01T00:00:00Z",
                            "to": "2026-09-19T23:59:59Z"
                        },
                        "maxCloudCoverage": 30
                    }
                }
            ]
        },
        "aggregation": {
            "timeRange": {
                "from": "2026-08-01T00:00:00Z",
                "to": "2026-09-19T23:59:59Z"
            },
            "aggregationInterval": {
                "of": "P1D"
            },
            "evalscript": """
//VERSION=3

function setup() {
    return {
        input: ["B04", "B08", "dataMask"],
        output: [
            { id: "ndvi", bands: 1 },
            { id: "dataMask", bands: 1 }
        ]
    };
}

function evaluatePixel(sample) {
    let ndvi = (sample.B08 - sample.B04) /
               (sample.B08 + sample.B04);

    return {
        ndvi: [ndvi],
        dataMask: [sample.dataMask]
    };
}
"""
        }
    }

    response = requests.post(
        "https://sh.dataspace.copernicus.eu/statistics/v1",
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        },
        json=payload
    )

    result = response.json()

    return {
        "ndvi": result["data"][0]["outputs"]["ndvi"]["bands"]["B0"]["stats"]["mean"]
    }