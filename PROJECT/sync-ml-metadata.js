const fs = require("fs");
const path = require("path");

const { mongoose, connectMongo } = require("./mongo");
const MlModel = require("./models/mlModel");

async function syncModelMetadata() {
    const metadataPath = path.join(__dirname, "ml-model-metadata.json");
    if (!fs.existsSync(metadataPath)) {
        throw new Error("No trained model metadata found. Train the CIC-IDS2017 model first.");
    }

    const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
    if (metadata.training_status !== "completed" || !metadata.model_version) {
        throw new Error("The saved model metadata is incomplete or training did not complete.");
    }

    await connectMongo();
    await MlModel.updateOne(
        { model_version: metadata.model_version },
        {
            $set: {
                model_version: metadata.model_version,
                dataset_name: metadata.dataset_name,
                training_status: metadata.training_status,
                training_timestamp: new Date(metadata.training_timestamp),
                feature_configuration: metadata.feature_configuration,
                metrics: metadata.metrics,
                artifact_location: metadata.artifact_location,
                created_by: "local-trainer"
            }
        },
        { upsert: true }
    );

    return {
        model_version: metadata.model_version,
        database: mongoose.connection.name,
        collection: "ml_models"
    };
}

if (require.main === module) {
    syncModelMetadata()
        .then((result) => console.log(JSON.stringify({ success: true, result }, null, 2)))
        .catch((error) => {
            console.error(JSON.stringify({ success: false, message: error.message }, null, 2));
            process.exitCode = 1;
        })
        .finally(() => mongoose.disconnect());
}

module.exports = { syncModelMetadata };
