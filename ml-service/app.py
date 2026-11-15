"""
FarmSense Brew — CLR Risk ML Service (FB-51)

FastAPI wrapper around the trained Random Forest model.

Run:  python -m uvicorn app:app --host 0.0.0.0 --port 5000
Endpoints:
  GET  /health   — liveness + model status
  POST /predict  — {temperature, humidity, soil_pct} → risk + probabilities
  GET  /metrics  — hold-out evaluation (Precision / Recall / F1, FB-57)
"""
import json
import os

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

HERE = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(HERE, "model.joblib")
METRICS_PATH = os.path.join(HERE, "metrics.json")

app = FastAPI(title="FarmSense Brew ML Service", version="1.0.0")

model = joblib.load(MODEL_PATH) if os.path.exists(MODEL_PATH) else None


class Reading(BaseModel):
    temperature: float
    humidity: float
    soil_pct: float


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "FarmSense Brew ML",
        "model_loaded": model is not None,
    }


@app.post("/predict")
def predict(r: Reading):
    if model is None:
        raise HTTPException(503, "Model not trained yet — run train.py")
    X = pd.DataFrame(
        [[r.temperature, r.humidity, r.soil_pct]],
        columns=["temperature", "humidity", "soil_pct"],
    )
    proba = model.predict_proba(X)[0]
    classes = list(model.classes_)
    best = classes[int(proba.argmax())]
    return {
        "risk_level": best,
        "confidence": round(float(proba.max()), 4),
        "probabilities": {c: round(float(p), 4) for c, p in zip(classes, proba)},
    }


@app.get("/metrics")
def metrics():
    if not os.path.exists(METRICS_PATH):
        raise HTTPException(404, "No metrics yet — run train.py")
    with open(METRICS_PATH) as f:
        return json.load(f)
