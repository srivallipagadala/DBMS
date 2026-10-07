# AI Security Dashboard

## Run locally

1. Start MongoDB Community Server if it is not already running. The default URI is `mongodb://127.0.0.1:27017/ai_security_db`.
2. If `backend/.env` does not exist, copy `backend/.env.example` to `backend/.env` and set a long random `JWT_SECRET`. Do not replace an existing `.env` file.
3. Install backend dependencies:

```text
cd backend
npm install
```

4. Optionally create the initial admin account and settings:

```text
node seed.js
```

5. Start the application:

```text
npm start
```

Open `http://localhost:5000/`.

The seed script creates only an admin account and settings; it does not add demo traffic, intrusion, alert, or threat records. The default seed login is `admin` / `admin123`; change it before deployment. Users can also register through the login page.

Authentication, settings, network traffic, predictions, intrusions, threat intelligence, alerts, reports, source snapshots, and model metadata are persisted in MongoDB. The legacy `database/schema.sql` file is not used by the application runtime.

## AI analysis CSV

The AI Detection page streams CSV files in batches. Existing IP traffic CSV files remain supported. CIC-IDS2017 MachineLearningCSV rows are also accepted; their actual `Label` is kept separate from prediction features, and CIC records and predictions are stored in MongoDB's `network_traffic` collection.

Train the Random Forest using the extracted dataset directory:

```powershell
cd backend
& "C:\Users\Kavya\AppData\Local\Programs\Python\Python314\python.exe" .\scripts\train_cic_ids_model.py "C:\Users\kavya\Downloads\MachineLearningCSV"
npm run sync:ml-metadata
```

Training scans CSVs in chunks and uses a reproducible per-class cap for the train/test split. The saved model and feature order are in `backend/models/cic_ids_rf_model.joblib` and `backend/ml-model-metadata.json`. Predictions require that artifact; the old centroid JSON is not used as a fallback. Set `PYTHON_EXECUTABLE` in `backend/.env` to the Python executable if `python`/`py` is not on PATH. The default MongoDB URI is `mongodb://127.0.0.1:27017/ai_security_db`.

Synchronize selected project source files explicitly:

```text
cd backend
npm run sync:source
```

In MongoDB Compass, connect to `mongodb://127.0.0.1:27017` and open `ai_security_db`. Collections include `users`, `settings`, `network_traffic`, `ai_predictions`, `intrusions`, `threat_intelligence`, `alerts`, `reports`, `ml_models`, and `project_source_files`. CIC records and predictions are stored in `network_traffic`, with `Label` saved separately as ground truth.

For the original IP traffic CSV format, the required fields are:

```csv
source_ip,destination_ip,protocol,destination_port,packet_count,data_size_bytes
198.51.100.10,192.0.2.100,TCP,22,260,18400
```

`POST /api/ai/analyze` stores supported IP traffic and predictions in MongoDB. CIC flow records use the saved Random Forest and are persisted in MongoDB; the model's per-class probability estimate is shown with each prediction.

## Checks

```text
cd backend
npm run test:model
```
