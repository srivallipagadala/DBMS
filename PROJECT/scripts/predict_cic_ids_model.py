#!/usr/bin/env python3
"""Load the saved CIC-IDS2017 model and predict JSON traffic rows from stdin."""

import json
import math
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
MODEL_PATH = ROOT / "models" / "cic_ids_rf_model.joblib"
METADATA_PATH = ROOT / "ml-model-metadata.json"


def normalize_key(value):
    import re
    return re.sub(r"[^a-zA-Z0-9]+", "_", str(value).strip()).strip("_").lower()


def severity_for(label):
    normalized = str(label).strip().lower()
    if normalized == "benign":
        return "LOW"
    if "infiltration" in normalized or "heartbleed" in normalized:
        return "CRITICAL"
    if "dos" in normalized or "ddos" in normalized:
        return "HIGH"
    return "MEDIUM"


def main():
    if not MODEL_PATH.is_file() or not METADATA_PATH.is_file():
        print(json.dumps({
            "success": False,
            "message": "A trained CIC-IDS2017 model is required. Run the CIC-IDS2017 training command first."
        }), file=sys.stderr)
        return 2

    try:
        metadata = json.loads(METADATA_PATH.read_text(encoding="utf-8"))
        feature_columns = metadata["feature_configuration"]["features"]
        model = joblib.load(MODEL_PATH)
        rows = json.load(sys.stdin)
        if not isinstance(rows, list) or not rows:
            raise ValueError("Expected a non-empty JSON array of traffic rows.")

        prepared = []
        ground_truth = []
        for row in rows:
            normalized = {normalize_key(key): value for key, value in row.items()}
            ground_truth.append(normalized.get("label"))
            values = {}
            for feature in feature_columns:
                value = normalized.get(feature)
                if value is None or str(value).strip() == "":
                    values[feature] = np.nan
                    continue
                try:
                    numeric = float(value)
                    values[feature] = numeric if math.isfinite(numeric) else np.nan
                except (TypeError, ValueError):
                    values[feature] = np.nan
            prepared.append(values)

        features = pd.DataFrame(prepared, columns=feature_columns)
        predicted = model.predict(features)
        probabilities = model.predict_proba(features)
        classes = [str(value) for value in model.named_steps["classifier"].classes_]
        results = []
        for index, label in enumerate(predicted):
            class_index = classes.index(str(label))
            probability = float(probabilities[index][class_index])
            results.append({
                "attack_type": str(label),
                "severity": severity_for(label),
                "confidence_score": round(probability * 100, 2),
                "model_version": metadata["model_version"],
                "ground_truth_label": None if ground_truth[index] is None else str(ground_truth[index]).strip()
            })
        print(json.dumps({"success": True, "predictions": results}, ensure_ascii=True, allow_nan=False))
        return 0
    except Exception as error:
        print(json.dumps({"success": False, "message": str(error)}, ensure_ascii=True), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
