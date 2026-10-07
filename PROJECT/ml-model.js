const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const MODEL_PATH = path.join(__dirname, "models", "cic_ids_rf_model.joblib");
const METADATA_PATH = path.join(__dirname, "ml-model-metadata.json");
const PREDICTOR_PATH = path.join(__dirname, "scripts", "predict_cic_ids_model.py");

function normalizeKey(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, "");
}

function trainedModelAvailable() {
    return fs.existsSync(MODEL_PATH) && fs.existsSync(METADATA_PATH);
}

function predictTrafficBatch(rows) {
    if (!trainedModelAvailable()) {
        throw new Error("A trained CIC-IDS2017 model is required. Run the training command first.");
    }

    const pythonExecutable = process.env.PYTHON_EXECUTABLE || (process.platform === "win32" ? "py" : "python3");
    let output;
    try {
        output = execFileSync(pythonExecutable, [PREDICTOR_PATH], {
            input: JSON.stringify(rows),
            encoding: "utf8",
            windowsHide: true,
            maxBuffer: 8 * 1024 * 1024
        });
    } catch (error) {
        const detail = error.stderr ? String(error.stderr).trim() : error.message;
        if (error.code === "ENOENT") {
            throw new Error("Python was not found. Set PYTHON_EXECUTABLE in backend/.env to the installed Python executable.");
        }
        throw new Error(detail || "The saved CIC-IDS2017 model could not make a prediction.");
    }

    const result = JSON.parse(output);
    if (!result.success || !Array.isArray(result.predictions)) {
        throw new Error(result.message || "The saved CIC-IDS2017 model returned an invalid response.");
    }
    return result.predictions;
}

function predictTraffic(row) {
    return predictTrafficBatch([row])[0];
}

module.exports = { predictTraffic, predictTrafficBatch, normalizeKey, trainedModelAvailable };
