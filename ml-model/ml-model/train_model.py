"""
FarmSense Brew — Model Training Script
File: ml-model/train_model.py

Trains a Random Forest classifier on historical sensor data to predict CLR risk.
Run this ONCE to generate the model file, then the Flask API uses it.

TEAM INSTRUCTIONS:
- Place your real collected CSV data in ml-model/data/sensor_history.csv
- Run: python3 train_model.py
- Output: models/clr_risk_model.pkl + models/scaler.pkl
- Required: pip install scikit-learn pandas numpy joblib matplotlib
"""

import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix
import joblib
import os

# ─── PATHS ────────────────────────────────────────────────────────────────────
DATA_PATH  = "data/sensor_history.csv"
MODEL_PATH = "models/clr_risk_model.pkl"
SCALER_PATH = "models/scaler.pkl"

os.makedirs("models", exist_ok=True)

# ─── LOAD DATA ────────────────────────────────────────────────────────────────
print("Loading data...")

# If you don't have real data yet, this generates synthetic training data
# based on the CLR thresholds from literature. REPLACE with real data ASAP.
if not os.path.exists(DATA_PATH):
    print("[INFO] No real data found. Generating synthetic training data based on CLR thresholds.")
    np.random.seed(42)
    n = 1500

    temperatures = np.random.uniform(15, 35, n)
    humidities   = np.random.uniform(40, 100, n)
    soil_pcts    = np.random.uniform(10, 95, n)

    # Label based on CLR thresholds from literature
    labels = []
    for t, h, s in zip(temperatures, humidities, soil_pcts):
        if h >= 80 and 21 <= t <= 25:
            labels.append(2)  # HIGH
        elif h >= 70 and 20 <= t <= 26:
            labels.append(1)  # MODERATE
        else:
            labels.append(0)  # LOW

    df = pd.DataFrame({
        "temperature": temperatures,
        "humidity":    humidities,
        "soil_pct":    soil_pcts,
        "clr_risk":    labels
    })
    os.makedirs("data", exist_ok=True)
    df.to_csv(DATA_PATH, index=False)
    print(f"[INFO] Synthetic dataset saved to {DATA_PATH} ({n} records)")
else:
    df = pd.read_csv(DATA_PATH)
    print(f"[INFO] Loaded {len(df)} records from {DATA_PATH}")

# ─── FEATURES & LABELS ────────────────────────────────────────────────────────
X = df[["temperature", "humidity", "soil_pct"]].values
y = df["clr_risk"].values  # 0=LOW, 1=MODERATE, 2=HIGH

print(f"Class distribution: LOW={sum(y==0)}, MODERATE={sum(y==1)}, HIGH={sum(y==2)}")

# ─── SPLIT ────────────────────────────────────────────────────────────────────
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

# ─── SCALE ────────────────────────────────────────────────────────────────────
scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)
X_test_scaled  = scaler.transform(X_test)

# ─── TRAIN ────────────────────────────────────────────────────────────────────
print("Training Random Forest model...")
model = RandomForestClassifier(
    n_estimators=100,
    max_depth=8,
    random_state=42,
    class_weight="balanced"  # handles class imbalance
)
model.fit(X_train_scaled, y_train)

# ─── EVALUATE ─────────────────────────────────────────────────────────────────
y_pred = model.predict(X_test_scaled)
print("\n── Evaluation Report ──────────────────────────────────────")
print(classification_report(y_test, y_pred, target_names=["LOW", "MODERATE", "HIGH"]))
print("Confusion Matrix:")
print(confusion_matrix(y_test, y_pred))

# Feature importance
importances = model.feature_importances_
features = ["temperature", "humidity", "soil_pct"]
print("\nFeature Importances:")
for f, i in sorted(zip(features, importances), key=lambda x: -x[1]):
    print(f"  {f}: {i:.4f}")

# ─── SAVE ─────────────────────────────────────────────────────────────────────
joblib.dump(model, MODEL_PATH)
joblib.dump(scaler, SCALER_PATH)
print(f"\nModel saved to: {MODEL_PATH}")
print(f"Scaler saved to: {SCALER_PATH}")
print("Done. Run 'python3 app.py' to start the prediction API.")
