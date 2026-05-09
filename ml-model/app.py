from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator
import joblib
import numpy as np
import os
from datetime import datetime

app = FastAPI(
    title="FarmSense Brew — ML Prediction API",
    description="CLR Disease Risk Scoring for Coffee Farming",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL_PATH  = os.path.join(os.path.dirname(__file__), "models", "clr_risk_model.pkl")
SCALER_PATH = os.path.join(os.path.dirname(__file__), "models", "scaler.pkl")

model  = None
scaler = None

@app.on_event("startup")
def load_model():
    global model, scaler
    if os.path.exists(MODEL_PATH):
        model  = joblib.load(MODEL_PATH)
        scaler = joblib.load(SCALER_PATH)
        print(f"[{datetime.now()}] Model loaded successfully.")
    else:
        print("[WARNING] Model not found. Run train_model.py first.")

class SensorInput(BaseModel):
    node_id:     str   = Field(..., example="NODE_01")
    temperature: float = Field(..., ge=10.0, le=40.0, example=24.3)
    humidity:    float = Field(..., ge=0.0,  le=100.0, example=82.1)
    soil_pct:    int   = Field(..., ge=0,    le=100,   example=67)

class PredictionOutput(BaseModel):
    node_id:        str
    risk_level:     str
    confidence_pct: float
    inputs:         dict
    gemini_prompt:  str | None
    timestamp:      str

@app.get("/health")
def health():
    return {
        "status": "ok",
        "model_loaded": model is not None,
        "service": "FarmSense Brew ML API"
    }

@app.post("/predict", response_model=PredictionOutput)
def predict(data: SensorInput):
    if model is None:
        raise HTTPException(
            status_code=503,
            detail="Model not loaded. Run train_model.py first."
        )

    features        = np.array([[data.temperature, data.humidity, data.soil_pct]])
    features_scaled = scaler.transform(features)
    prediction      = model.predict(features_scaled)[0]
    probabilities   = model.predict_proba(features_scaled)[0]
    confidence      = round(float(max(probabilities)) * 100, 1)

    risk_labels = {0: "LOW", 1: "MODERATE", 2: "HIGH"}
    risk_level  = risk_labels.get(int(prediction), "UNKNOWN")

    gemini_prompt = None
    if risk_level in ["MODERATE", "HIGH"]:
        gemini_prompt = (
            f"You are an expert agricultural advisor for a Philippine coffee farm. "
            f"Sensor {data.node_id} reads: Temp {data.temperature}°C, "
            f"Humidity {data.humidity}%, Soil {data.soil_pct}%. "
            f"CLR Risk: {risk_level} ({confidence}% confidence). "
            f"Provide a 3-part response: WHAT / WHY / WHAT TO DO. "
            f"Plain language, under 100 words, Taglish okay."
        )

    return PredictionOutput(
        node_id        = data.node_id,
        risk_level     = risk_level,
        confidence_pct = confidence,
        inputs         = data.model_dump(),
        gemini_prompt  = gemini_prompt,
        timestamp      = datetime.now().isoformat()
    )

@app.post("/predict/batch")
def predict_batch(readings: list[SensorInput]):
    return [predict(r) for r in readings]