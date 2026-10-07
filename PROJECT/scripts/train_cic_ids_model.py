#!/usr/bin/env python3
"""Train a Random Forest model from real CIC-IDS2017 flow CSV files."""

import argparse
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.metrics import accuracy_score, confusion_matrix, f1_score, precision_score, recall_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DATASET_DIR = Path.home() / "Downloads" / "MachineLearningCSV"
MODEL_DIR = ROOT / "models"
MODEL_PATH = MODEL_DIR / "cic_ids_rf_model.joblib"
METADATA_PATH = ROOT / "ml-model-metadata.json"
MAX_ROWS_PER_CLASS = 10000
ROWS_PER_CLASS_PER_CHUNK = 1000


def normalize_col_name(value):
    return re.sub(r"[^a-zA-Z0-9]+", "_", str(value).strip()).strip("_").lower()


def find_csv_files(dataset_dir):
    if not dataset_dir.exists():
        return []
    return sorted(path for path in dataset_dir.rglob("*.csv") if path.is_file())


def collect_training_sample(csv_files):
    sampled_chunks = []
    full_label_counts = Counter()
    rows_scanned = 0
    feature_columns = None

    for file_index, csv_path in enumerate(csv_files):
        chunk_index = 0
        try:
            reader = pd.read_csv(csv_path, chunksize=100000, encoding="utf-8-sig", encoding_errors="replace")
            for chunk in reader:
                original_columns = list(chunk.columns)
                normalized_columns = [normalize_col_name(column) for column in original_columns]
                if len(normalized_columns) != len(set(normalized_columns)):
                    raise ValueError(f"Duplicate columns after normalization in {csv_path.name}.")
                chunk.columns = normalized_columns
                if "label" not in chunk.columns:
                    raise ValueError(f"Required Label column was not found in {csv_path.name}.")

                chunk["label"] = chunk["label"].astype("string").str.strip()
                chunk = chunk[chunk["label"].notna() & chunk["label"].ne("")]
                if chunk.empty:
                    chunk_index += 1
                    continue

                rows_scanned += len(chunk)
                full_label_counts.update(chunk["label"].value_counts().to_dict())
                current_features = [
                    column for column in chunk.columns
                    if column != "label" and column not in {"ground_truth", "target", "attack_type", "class"}
                ]
                if feature_columns is None:
                    feature_columns = current_features
                elif current_features != feature_columns:
                    missing = sorted(set(feature_columns) - set(current_features))
                    extra = sorted(set(current_features) - set(feature_columns))
                    if missing or extra:
                        raise ValueError(f"Inconsistent features in {csv_path.name}; missing={missing}, extra={extra}.")

                chunk = chunk[feature_columns + ["label"]].copy()
                for column in feature_columns:
                    chunk[column] = pd.to_numeric(chunk[column], errors="coerce")
                chunk[feature_columns] = chunk[feature_columns].replace([np.inf, -np.inf], np.nan)

                for label, group in chunk.groupby("label", sort=False):
                    sample_size = min(ROWS_PER_CLASS_PER_CHUNK, len(group))
                    sampled_chunks.append(group.sample(n=sample_size, random_state=42 + file_index + chunk_index))
                chunk_index += 1
        except Exception as error:
            raise ValueError(f"Unable to process {csv_path}: {error}") from error

    if not sampled_chunks or not feature_columns:
        raise ValueError("No labeled CIC-IDS2017 rows were found.")

    candidates = pd.concat(sampled_chunks, ignore_index=True)
    balanced = []
    for _, group in candidates.groupby("label", sort=True):
        balanced.append(group.sample(n=min(MAX_ROWS_PER_CLASS, len(group)), random_state=42))
    training_data = pd.concat(balanced, ignore_index=True).sample(frac=1, random_state=42).reset_index(drop=True)
    return training_data[feature_columns], training_data["label"], feature_columns, rows_scanned, full_label_counts


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("dataset_dir", nargs="?", type=Path, default=DEFAULT_DATASET_DIR)
    args = parser.parse_args()

    csv_files = find_csv_files(args.dataset_dir)
    if not csv_files:
        print(json.dumps({
            "success": False,
            "message": "No CIC-IDS2017 CSV files found. Pass the extracted MachineLearningCSV directory.",
            "dataset_dir": str(args.dataset_dir)
        }, indent=2, ensure_ascii=True))
        return 1

    try:
        X, y, feature_columns, rows_scanned, full_label_counts = collect_training_sample(csv_files)
        X_train, X_test, y_train, y_test = train_test_split(
            X,
            y,
            test_size=0.2,
            random_state=42,
            stratify=y
        )
        pipeline = Pipeline([
            ("imputer", SimpleImputer(strategy="median", keep_empty_features=True)),
            ("classifier", RandomForestClassifier(
                n_estimators=200,
                max_depth=24,
                min_samples_leaf=2,
                random_state=42,
                class_weight="balanced_subsample",
                n_jobs=-1
            ))
        ])
        pipeline.fit(X_train, y_train)
        predictions = pipeline.predict(X_test)
        labels = sorted(y.unique().tolist())
        metrics = {
            "accuracy": float(accuracy_score(y_test, predictions)),
            "precision_weighted": float(precision_score(y_test, predictions, average="weighted", zero_division=0)),
            "recall_weighted": float(recall_score(y_test, predictions, average="weighted", zero_division=0)),
            "f1_weighted": float(f1_score(y_test, predictions, average="weighted", zero_division=0)),
            "confusion_matrix": confusion_matrix(y_test, predictions, labels=labels).tolist(),
            "labels": [str(label) for label in labels],
            "train_records": int(len(X_train)),
            "test_records": int(len(X_test)),
            "sampled_records_by_label": {str(label): int(count) for label, count in y.value_counts().sort_index().items()},
            "dataset_records_scanned": int(rows_scanned),
            "dataset_label_counts": {str(label): int(count) for label, count in sorted(full_label_counts.items())}
        }

        import joblib
        MODEL_DIR.mkdir(parents=True, exist_ok=True)
        joblib.dump(pipeline, MODEL_PATH)
        metadata = {
            "model_version": "random-forest-cic-ids-2017-v1",
            "dataset_name": "CIC-IDS2017 MachineLearningCSV",
            "training_timestamp": pd.Timestamp.now(tz="UTC").isoformat(),
            "feature_configuration": {
                "target_column": "label",
                "feature_count": len(feature_columns),
                "features": feature_columns,
                "sampling": "stratified per-class cap after chunked file scan",
                "max_rows_per_class": MAX_ROWS_PER_CLASS
            },
            "metrics": metrics,
            "artifact_location": str(MODEL_PATH),
            "training_status": "completed"
        }
        METADATA_PATH.write_text(json.dumps(metadata, indent=2, ensure_ascii=True), encoding="utf-8")
    except Exception as error:
        print(json.dumps({"success": False, "message": str(error)}, indent=2, ensure_ascii=True))
        return 1

    print(json.dumps({
        "success": True,
        "dataset_dir": str(args.dataset_dir),
        "dataset_files": [str(file) for file in csv_files],
        "metrics": metrics,
        "artifact": str(MODEL_PATH),
        "metadata": str(METADATA_PATH)
    }, indent=2, ensure_ascii=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
