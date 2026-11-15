"""
FarmSense Brew — CLR Risk Model Training (FB-51 / FB-57)

Trains a Random Forest classifier to predict Coffee Leaf Rust risk
(MINIMAL / LOW / MODERATE / HIGH / CRITICAL) from live sensor readings.

Training data: the farm's own `sensor_readings` table.
Labels: the agronomy rule engine used in production (Hemileia vastatrix
thrives at 21-25 °C with sustained high humidity) — i.e. knowledge
distillation of the expert system into a probabilistic model.

Outputs:
  model.joblib   — trained classifier (loaded by app.py)
  metrics.json   — hold-out Precision / Recall / F1 + confusion matrix

Run:  python train.py
"""
import json
import os
from datetime import datetime

import joblib
import numpy as np
import pandas as pd
import pymysql
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.model_selection import train_test_split

DB = dict(
    host=os.environ.get("DB_HOST", "127.0.0.1"),
    port=int(os.environ.get("DB_PORT", 3306)),
    user=os.environ.get("DB_USER", "root"),
    password=os.environ.get("DB_PASSWORD", ""),
    database=os.environ.get("DB_NAME", "farmsense_db"),
)

CLASSES = ["MINIMAL", "LOW", "MODERATE", "HIGH", "CRITICAL"]


def dew_point(temp: float, hum: float) -> float:
    """Magnus formula, same constants as backend/services/clr-risk.js."""
    rh = min(100.0, max(1.0, hum))
    a, b = 17.62, 243.12
    g = np.log(rh / 100.0) + a * temp / (b + temp)
    return b * g / (a - g)


def rule_label(temp: float, hum: float, soil: float = None) -> str:
    """Expert rule engine, identical to backend computeClrRisk() (clr-risk.js):
    temperature 35 + humidity 25 + estimated leaf wetness 40 points; soil not scored."""
    if 21 <= temp <= 25:
        t = 35
    elif 18 <= temp < 21 or 25 < temp <= 28:
        t = 22
    elif 15 <= temp < 18 or 28 < temp <= 30:
        t = 10
    else:
        t = 0
    h = 25 if hum >= 90 else 20 if hum >= 85 else 15 if hum >= 80 else 8 if hum >= 70 else 0
    dpd = temp - dew_point(temp, hum)
    w = 40 if dpd <= 1 else 30 if dpd <= 2 else 15 if dpd <= 3 else 0
    score = min(100, t + h + w)
    if score <= 20:
        return "MINIMAL"
    if score <= 40:
        return "LOW"
    if score <= 60:
        return "MODERATE"
    if score <= 80:
        return "HIGH"
    return "CRITICAL"


def load_readings() -> pd.DataFrame:
    conn = pymysql.connect(**DB)
    df = pd.read_sql(
        "SELECT temperature, humidity, soil_pct FROM sensor_readings "
        "WHERE temperature IS NOT NULL AND humidity IS NOT NULL AND soil_pct IS NOT NULL",
        conn,
    )
    conn.close()
    return df.astype(float)


def main() -> None:
    df = load_readings()
    print(f"Loaded {len(df)} readings from MySQL")

    df["label"] = [
        rule_label(t, h, s)
        for t, h, s in zip(df.temperature, df.humidity, df.soil_pct)
    ]
    print("Class distribution:", df.label.value_counts().to_dict())

    X = df[["temperature", "humidity", "soil_pct"]]
    y = df["label"]

    # Stratify when every class has at least 2 rows (a rare class may not).
    counts = y.value_counts()
    strat = y if (counts >= 2).all() else None
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=strat
    )

    model = RandomForestClassifier(
        n_estimators=200, max_depth=8, random_state=42, class_weight="balanced"
    )
    model.fit(X_train, y_train)

    # Honest evaluation: perturb the held-out inputs with realistic sensor
    # measurement error (DHT22 datasheet: ±0.5 °C, ±2-5 %RH; capacitive
    # soil probe ≈ ±3 %) while keeping the TRUE labels from clean values.
    # This measures whether the model recovers the true field condition
    # from noisy sensor data — the situation it actually faces in the farm.
    rng = np.random.default_rng(42)
    X_test_noisy = X_test.copy()
    X_test_noisy["temperature"] += rng.normal(0, 0.5, len(X_test))
    X_test_noisy["humidity"] = (X_test_noisy["humidity"]
                                + rng.normal(0, 2.5, len(X_test))).clip(0, 100)
    X_test_noisy["soil_pct"] = (X_test_noisy["soil_pct"]
                                + rng.normal(0, 3.0, len(X_test))).clip(0, 100)

    y_pred = model.predict(X_test_noisy)
    report = classification_report(
        y_test, y_pred, labels=CLASSES, output_dict=True, zero_division=0
    )
    cm = confusion_matrix(y_test, y_pred, labels=CLASSES).tolist()

    # Clean-input scores for reference (should be ~1.0)
    clean_report = classification_report(
        y_test, model.predict(X_test), labels=CLASSES,
        output_dict=True, zero_division=0
    )

    metrics = {
        "trained_at": datetime.now().isoformat(timespec="seconds"),
        "algorithm": "RandomForestClassifier (n_estimators=200, max_depth=8)",
        "training_rows": len(X_train),
        "test_rows": len(X_test),
        "labeling": "Expert rule engine (agronomic CLR thresholds) — knowledge distillation",
        "classes": CLASSES,
        "per_class": {
            c: {
                "precision": round(report[c]["precision"], 4),
                "recall": round(report[c]["recall"], 4),
                "f1": round(report[c]["f1-score"], 4),
                "support": int(report[c]["support"]),
            }
            for c in CLASSES
        },
        "macro_f1": round(report["macro avg"]["f1-score"], 4),
        "accuracy": round(report["accuracy"], 4),
        "evaluation_protocol": (
            "Hold-out test inputs perturbed with sensor measurement noise "
            "(temp σ=0.5°C, humidity σ=2.5%, soil σ=3%) against clean-value labels"
        ),
        "clean_input_accuracy": round(clean_report["accuracy"], 4),
        "confusion_matrix": {"labels": CLASSES, "matrix": cm},
        "feature_importances": dict(
            zip(X.columns, [round(v, 4) for v in model.feature_importances_])
        ),
    }

    out = os.path.dirname(os.path.abspath(__file__))
    joblib.dump(model, os.path.join(out, "model.joblib"))
    with open(os.path.join(out, "metrics.json"), "w") as f:
        json.dump(metrics, f, indent=2)

    print(json.dumps(metrics["per_class"], indent=2))
    print(f"macro F1={metrics['macro_f1']}  accuracy={metrics['accuracy']}")
    print("Saved model.joblib + metrics.json")


if __name__ == "__main__":
    main()
