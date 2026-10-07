const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const { mongoose, connectMongo } = require("./mongo");
const ProjectSourceFile = require("./models/projectSourceFile");

const workspaceRoot = path.resolve(__dirname, "..");
const EXCLUDED_DIRS = new Set([".git", "node_modules", "dist", "build", "coverage", ".next", "__pycache__", "reports", "dataset"]);
const EXCLUDED_FILES = new Set(["package-lock.json", ".env", ".env.local", ".env.production", ".env.development"]);
const ALLOWED_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx", ".html", ".css", ".json", ".sql", ".md", ".py", ".yml", ".yaml"]);

function inferLanguage(filename) {
    const extension = path.extname(filename).toLowerCase();
    const map = {
        ".js": "javascript",
        ".jsx": "javascript",
        ".ts": "typescript",
        ".tsx": "typescript",
        ".html": "html",
        ".css": "css",
        ".json": "json",
        ".sql": "sql",
        ".md": "markdown",
        ".py": "python",
        ".yml": "yaml",
        ".yaml": "yaml"
    };
    return map[extension] || "text";
}

function shouldSkip(relativePath) {
    const normalized = relativePath.replace(/\\/g, "/");
    const segments = normalized.split("/");
    if (segments.some((segment) => EXCLUDED_DIRS.has(segment))) return true;
    if (EXCLUDED_FILES.has(path.basename(normalized))) return true;
    if (normalized.startsWith(".git/")) return true;
    if (normalized.includes("/node_modules/")) return true;
    if (normalized.includes("/dataset/")) return true;
    if (normalized.includes("/reports/")) return true;
    if (fs.existsSync(path.resolve(workspaceRoot, normalized)) && fs.statSync(path.resolve(workspaceRoot, normalized)).isDirectory()) return false;
    if (path.basename(normalized) === ".env.example") return false;
    if (!ALLOWED_EXTENSIONS.has(path.extname(normalized).toLowerCase())) return true;
    return false;
}

function listProjectFiles(rootDir) {
    const files = [];

    function visit(directory) {
        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
            const fullPath = path.join(directory, entry.name);
            const relativePath = path.relative(rootDir, fullPath).replace(/\\/g, "/");

            if (entry.isDirectory()) {
                if (!shouldSkip(relativePath)) {
                    visit(fullPath);
                }
                continue;
            }

            if (!shouldSkip(relativePath)) {
                files.push(fullPath);
            }
        }
    }

    visit(rootDir);
    return files.sort();
}

async function syncProjectSources({ rootDir = workspaceRoot } = {}) {
    try {
        await connectMongo();
    } catch (error) {
        throw new Error("MongoDB is not running or unreachable at mongodb://127.0.0.1:27017/ai_security_db. Start MongoDB Community Server before syncing source snapshots.");
    }

    const filePaths = listProjectFiles(rootDir);
    const summary = {
        total_files: filePaths.length,
        synced: 0,
        updated: 0,
        unchanged: 0,
        skipped: 0,
        documents: []
    };

    for (const filePath of filePaths) {
        const relativePath = path.relative(rootDir, filePath).replace(/\\/g, "/");
        if (shouldSkip(relativePath)) {
            summary.skipped += 1;
            continue;
        }

        const content = fs.readFileSync(filePath, "utf8");
        const contentHash = crypto.createHash("sha256").update(content).digest("hex");
        const document = {
            relative_path: relativePath,
            filename: path.basename(filePath),
            language: inferLanguage(filePath),
            content,
            content_hash: contentHash,
            last_synced_at: new Date(),
            source: "local-project"
        };

        const existing = await ProjectSourceFile.findOne({ relative_path: relativePath }).lean();

        if (!existing) {
            await ProjectSourceFile.create(document);
            summary.synced += 1;
        } else if (existing.content_hash !== contentHash) {
            await ProjectSourceFile.updateOne({ relative_path: relativePath }, { $set: document });
            summary.updated += 1;
        } else {
            summary.unchanged += 1;
        }

        summary.documents.push(relativePath);
    }

    return summary;
}

if (require.main === module) {
    syncProjectSources()
        .then((result) => {
            console.log(JSON.stringify({
                success: true,
                message: "Project source snapshot synchronized to MongoDB.",
                result
            }, null, 2));
        })
        .catch((error) => {
            console.error(JSON.stringify({
                success: false,
                message: error.message
            }, null, 2));
            process.exitCode = 1;
        })
        .finally(() => mongoose.disconnect());
}

module.exports = { syncProjectSources, workspaceRoot, listProjectFiles };
