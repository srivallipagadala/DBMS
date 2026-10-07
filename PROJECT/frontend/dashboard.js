document.body.innerHTML = `<div class="app"><aside class="sidebar"><div class="brand">AI <b>SECURITY</b></div><nav class="nav" id="nav"><button data-page="dashboard" class="active">Dashboard</button><button data-page="network">Network Traffic</button><button data-page="intrusions">Intrusions</button><button data-page="threats">Threat Intelligence</button><button data-page="alerts">Alerts</button><button data-page="reports">Reports</button><button data-page="ai">AI Detection</button><button data-page="settings">Settings</button></nav><button class="logout" id="logout">Logout</button></aside><main class="main"><header class="topbar"><div><p class="eyebrow">Security operations center</p><h1 id="title">Dashboard</h1><p id="subtitle">Live visibility into network risk and response.</p></div><div class="user-chip" id="user-name">Analyst</div></header><div id="notice" class="notice"></div><section class="page active" id="dashboard"><div class="cards"><div class="card"><h3>Packets analyzed</h3><div class="number blue" id="stat-traffic">0</div><small>Across recorded traffic</small></div><div class="card"><h3>Threats detected</h3><div class="number red" id="stat-threats">0</div><small>AI findings in database</small></div><div class="card"><h3>Blocked attacks</h3><div class="number green" id="stat-blocked">0</div><small>Contained automatically</small></div><div class="card"><h3>Active alerts</h3><div class="number orange" id="stat-alerts">0</div><small>Need analyst attention</small></div></div><div class="grid"><div class="panel"><h2>Network activity</h2><div id="activity-chart" class="chart"></div></div><div class="panel"><h2>Recent threats</h2><div id="recent-threats"></div></div></div><div class="panel"><h2>Latest intrusion events</h2><div class="table-wrap"><table><thead><tr><th>Time</th><th>Source</th><th>Destination</th><th>Attack</th><th>Severity</th><th>Confidence</th></tr></thead><tbody id="dashboard-intrusions"></tbody></table></div></div></section><section class="page" id="network"><div class="cards"><div class="card"><h3>Inbound packets</h3><div class="number blue" id="inbound">0</div></div><div class="card"><h3>Outbound packets</h3><div class="number blue" id="outbound">0</div></div><div class="card"><h3>Bandwidth</h3><div class="number green" id="bandwidth">0 Mbps</div></div><div class="card"><h3>Connections</h3><div class="number orange" id="connections">0</div></div></div><div class="panel"><h2>Network traffic</h2><div class="toolbar"><input id="traffic-search" placeholder="Search IP or protocol"><select id="traffic-status"><option value="">All statuses</option><option>NORMAL</option><option>SUSPICIOUS</option><option>BLOCKED</option></select><select id="traffic-sort"><option value="timestamp">Newest</option><option value="packet_count">Packets</option><option value="data_size_bytes">Data size</option><option value="source_ip">Source IP</option></select></div><div class="table-wrap"><table><thead><tr><th>Time</th><th>Source</th><th>Destination</th><th>Protocol</th><th>Port</th><th>Packets</th><th>Data</th><th>Status</th></tr></thead><tbody id="traffic-table"></tbody></table></div></div></section><section class="page" id="intrusions"><div class="cards"><div class="card"><h3>Total intrusions</h3><div class="number red" id="intrusion-total">0</div></div><div class="card"><h3>Blocked</h3><div class="number green" id="intrusion-blocked">0</div></div><div class="card"><h3>Investigating</h3><div class="number orange" id="intrusion-investigating">0</div></div></div><div class="panel"><h2>AI intrusion findings</h2><div class="toolbar"><input id="intrusion-search" placeholder="Search source, destination, or attack"><select id="intrusion-severity"><option value="">All severity</option><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>CRITICAL</option></select></div><div class="table-wrap"><table><thead><tr><th>Time</th><th>Source</th><th>Destination</th><th>Attack type</th><th>Severity</th><th>Confidence</th><th>Status</th></tr></thead><tbody id="intrusion-table"></tbody></table></div></div></section><section class="page" id="threats"><div class="panel"><h2>Threat intelligence</h2><div class="toolbar"><input id="threat-search" placeholder="Search IOC, threat type, or source"><select id="threat-severity"><option value="">All severity</option><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>CRITICAL</option></select></div><div class="table-wrap"><table><thead><tr><th>IOC</th><th>Type</th><th>Threat</th><th>Severity</th><th>Source</th><th>Last seen</th></tr></thead><tbody id="threat-table"></tbody></table></div></div></section><section class="page" id="alerts"><div class="cards"><div class="card"><h3>Active</h3><div class="number orange" id="alert-active">0</div></div><div class="card"><h3>Critical</h3><div class="number red" id="alert-critical">0</div></div><div class="card"><h3>Acknowledged</h3><div class="number blue" id="alert-ack">0</div></div><div class="card"><h3>Resolved</h3><div class="number green" id="alert-resolved">0</div></div></div><div class="panel"><h2>Alert feed</h2><div id="alert-list"></div></div></section><section class="page" id="reports"><div class="panel"><div class="toolbar"><h2 style="margin:0;flex:1">Security reports</h2><button class="primary" id="generate-report">Generate report</button></div><div class="table-wrap"><table><thead><tr><th>Name</th><th>Type</th><th>Generated</th><th>Status</th></tr></thead><tbody id="report-table"></tbody></table></div></div></section><section class="page" id="ai"><div class="panel"><h2>AI traffic detection</h2><p class="muted">Upload a CSV with source_ip, destination_ip, destination_port, and packet_count columns.</p><form class="form" id="ai-form"><label>Traffic CSV<input type="file" name="file" accept=".csv" required></label><button class="primary" type="submit">Analyze traffic</button></form><div id="ai-result"></div></div></section><section class="page" id="settings"><div class="panel"><h2>Account settings</h2><form class="form" id="settings-form"><label>Email<input id="setting-email" type="email" required></label><label class="check"><input id="setting-2fa" type="checkbox"> Two-factor authentication</label><label class="check"><input id="setting-alerts" type="checkbox"> Email alerts</label><label class="check"><input id="setting-block" type="checkbox"> Auto-block suspicious IPs</label><label>Session timeout (minutes)<input id="setting-timeout" type="number" min="5" max="480" required></label><button class="primary" type="submit">Save settings</button></form></div></section></main></div>`;
document.head.insertAdjacentHTML("beforeend", `<style>.grid{display:grid;grid-template-columns:1.35fr 1fr;gap:18px}.toolbar{display:flex;gap:9px;flex-wrap:wrap;margin-bottom:16px}.toolbar input{flex:1;min-width:180px}.form{display:grid;gap:15px;max-width:620px}.form label{display:grid;gap:6px}.form input,.form select,.toolbar input,.toolbar select{border:1px solid #dfe5e8;padding:10px;border-radius:5px}.notice{display:none;padding:11px 14px;margin-bottom:18px;border-radius:6px}.notice.show{display:block}.notice.error{background:#ffebe7;color:#a33f32}.notice.success{background:#e4f5ed;color:#176e55}.page{display:none}.page.active{display:block}.table-wrap{overflow:auto}.empty{text-align:center;color:#687381;padding:24px}.muted{color:#687381}.check{display:flex!important;align-items:center;gap:9px}.check input{width:16px}.alert-action{margin-left:5px}.pagination{display:flex;align-items:center;justify-content:flex-end;gap:12px;padding-top:14px;color:#718088;font:12px Arial,sans-serif}.pagination[hidden]{display:none}@media(max-width:1050px){.grid{grid-template-columns:1fr}}@media(max-width:700px){.toolbar input{min-width:100%}.topbar h1{font-size:25px}.pagination{justify-content:center;flex-wrap:wrap}}</style>`);
const token = localStorage.getItem("token");
if (!token) window.location.href = "login.html";

const user = JSON.parse(localStorage.getItem("user") || "{}");
const state = { traffic: [], intrusions: [], threats: [], alerts: [], activeAlerts: 0 };
let alertsPage = 1;
const $ = (id) => document.getElementById(id);

function showNotice(message, type = "error") {
    const notice = $("notice");
    notice.textContent = message;
    notice.className = `notice show ${type}`;
    window.clearTimeout(showNotice.timer);
    showNotice.timer = window.setTimeout(() => { notice.className = "notice"; }, 4500);
}

async function api(path, options = {}) {
    const headers = { Authorization: `Bearer ${token}`, ...(options.headers || {}) };
    const response = await fetch(path, { ...options, headers });
    const data = await response.json().catch(() => ({ success: false, message: "Invalid server response." }));
    if (response.status === 401 || response.status === 403) {
        localStorage.clear();
        window.location.href = "login.html";
        return null;
    }
    if (!response.ok || !data.success) throw new Error(data.message || "Request failed.");
    return data;
}

async function analyzeCsvFile(file, onProgress) {
    const reader = file.stream().pipeThrough(new TextDecoderStream("utf-8")).getReader();
    const uploadId = `${file.name}:${file.size}:${file.lastModified}`;
    const batchSize = 500;
    const summary = { analyzed: 0, threats: 0, preview: [], offset: 0 };
    let pending = "";
    let header = "";
    let batch = [];

    async function submitBatch() {
        if (!batch.length) return;
        const csv = `${header}\n${batch.join("\n")}`;
        const result = await api("/api/ai/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ csv, upload_id: uploadId, row_offset: summary.offset })
        });
        summary.analyzed += result.data.analyzed;
        summary.threats += result.data.threats;
        for (const item of result.data.predictions) {
            if (summary.preview.length < 40) summary.preview.push(item);
        }
        summary.offset += batch.length;
        batch = [];
        onProgress(summary.analyzed);
    }

    try {
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            const lines = `${pending}${value}`.split(/\r?\n/);
            pending = lines.pop() || "";
            if (!header && lines.length) header = lines.shift().replace(/^\uFEFF/, "");
            for (const line of lines) {
                if (!line.trim()) continue;
                batch.push(line);
                if (batch.length >= batchSize) await submitBatch();
            }
        }
        pending += "";
        if (pending.trim()) {
            if (!header) header = pending;
            else batch.push(pending);
        }
        await submitBatch();
    } finally {
        reader.releaseLock();
    }

    if (!header || !summary.analyzed) throw new Error("CSV must contain a header and at least one valid record.");
    return summary;
}

function date(value) { return value ? new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "-"; }
function bytes(value) { const number = Number(value || 0); return number < 1024 ? `${number} B` : number < 1048576 ? `${(number / 1024).toFixed(1)} KB` : `${(number / 1048576).toFixed(2)} MB`; }
function badge(value, kind = "status") { const safe = String(value || "-"); return `<span class="${kind} ${safe.toLowerCase()}">${safe}</span>`; }
function emptyRow(columns, text = "No records found") { return `<tr><td colspan="${columns}" class="empty">${text}</td></tr>`; }

function renderDashboard() {
    const total = state.traffic.reduce((sum, item) => sum + Number(item.packet_count || 0), 0);
    $("stat-traffic").textContent = total.toLocaleString();
    $("stat-threats").textContent = state.intrusions.length;
    $("stat-blocked").textContent = state.intrusions.filter(item => item.status === "BLOCKED").length;
    $("stat-alerts").textContent = Number(state.activeAlerts || 0).toLocaleString();
    $("dashboard-intrusions").innerHTML = state.intrusions.slice(0, 5).map(item => `<tr><td>${date(item.timestamp)}</td><td>${item.source_ip || (item.source_dataset ? `CIC row ${Number(item.row_index) + 1}` : "-")}</td><td>${item.destination_ip || (item.source_dataset ? "Not provided" : "-")}</td><td>${item.attack_type}</td><td>${badge(item.severity, "badge")}</td><td>${Number(item.confidence_score || 0).toFixed(1)}%</td></tr>`).join("") || emptyRow(6);
    $("recent-threats").innerHTML = state.intrusions.slice(0, 5).map(item => `<div class="threat"><div><strong>${item.attack_type}</strong><small>${item.source_ip || (item.source_dataset ? `CIC row ${Number(item.row_index) + 1}` : "-")} · ${Number(item.confidence_score || 0).toFixed(1)}% confidence</small></div>${badge(item.severity, "badge")}</div>`).join("") || `<div class="empty">No threats detected.</div>`;
    const grouped = {};
    state.traffic.forEach(item => { const key = new Date(item.timestamp).toLocaleDateString([], { weekday: "short" }); grouped[key] = (grouped[key] || 0) + Number(item.packet_count || 0); });
    const values = Object.values(grouped).slice(-7); const max = Math.max(...values, 1);
    $("activity-chart").innerHTML = values.length ? values.map((value, index) => `<div class="bar" style="height:${Math.max(5, value / max * 100)}%"><span>${Object.keys(grouped).slice(-7)[index]}</span></div>`).join("") : `<div class="empty">No activity data.</div>`;
}

async function loadDashboard() {
    const [stats, traffic, intrusions] = await Promise.all([api("/api/dashboard/stats"), api("/api/network-traffic"), api("/api/intrusions")]);
    state.traffic = traffic.data; state.intrusions = intrusions.data;
    const dashboardStats = stats.data || stats;
    state.activeAlerts = Number(dashboardStats.activeAlerts || 0);
    $("stat-traffic").textContent = Number(dashboardStats.totalTraffic || 0).toLocaleString();
    renderDashboard();
}

async function loadNetwork() {
    const query = new URLSearchParams({ search: $("traffic-search").value, status: $("traffic-status").value, sort: $("traffic-sort").value });
    const [stats, result] = await Promise.all([api("/api/network-traffic/stats"), api(`/api/network-traffic?${query}`)]);
    $("inbound").textContent = Number(stats.data.inbound).toLocaleString(); $("outbound").textContent = Number(stats.data.outbound).toLocaleString(); $("bandwidth").textContent = `${stats.data.bandwidth} Mbps`; $("connections").textContent = stats.data.openConnections;
    $("traffic-table").innerHTML = result.data.map(item => `<tr><td>${date(item.timestamp)}</td><td>${item.source_ip || (item.source_dataset ? `CIC row ${Number(item.row_index) + 1}` : "-")}</td><td>${item.destination_ip || (item.source_dataset ? "Not provided" : "-")}</td><td>${item.protocol || "-"}</td><td>${item.destination_port || item.source_port || "-"}</td><td>${Number(item.packet_count || 0).toLocaleString()}</td><td>${bytes(item.data_size_bytes)}</td><td>${badge(item.status)} ${item.attack_type ? badge(item.attack_type, "badge") : ""}</td></tr>`).join("") || emptyRow(8);
}

async function loadIntrusions() {
    const query = new URLSearchParams({ search: $("intrusion-search").value, severity: $("intrusion-severity").value });
    const [stats, result] = await Promise.all([api("/api/intrusions/stats"), api(`/api/intrusions?${query}`)]);
    $("intrusion-total").textContent = stats.data.total; $("intrusion-blocked").textContent = stats.data.blocked; $("intrusion-investigating").textContent = stats.data.investigating;
    $("intrusion-table").innerHTML = result.data.map(item => `<tr><td>${date(item.timestamp)}</td><td>${item.source_ip || (item.source_dataset ? `CIC row ${Number(item.row_index) + 1}` : "-")}</td><td>${item.destination_ip || (item.source_dataset ? "Not provided" : "-")}</td><td>${item.attack_type}</td><td>${badge(item.severity, "badge")}</td><td>${Number(item.confidence_score || 0).toFixed(1)}%</td><td>${badge(item.status)}</td></tr>`).join("") || emptyRow(7);
}

async function loadThreats() {
    const query = new URLSearchParams({ search: $("threat-search").value, severity: $("threat-severity").value });
    const result = await api(`/api/threat-intelligence?${query}`);
    $("threat-table").innerHTML = result.data.map(item => `<tr><td>${item.ioc_value}</td><td>${item.ioc_type}</td><td>${item.threat_type}</td><td>${badge(item.severity, "badge")}</td><td>${item.source}</td><td>${date(item.last_seen)}</td></tr>`).join("") || emptyRow(6);
}

async function loadAlerts(page = alertsPage) {
    const query = new URLSearchParams({ page: String(page), limit: "100" });
    const [stats, result] = await Promise.all([api("/api/alerts/stats"), api(`/api/alerts?${query}`)]);
    alertsPage = result.pagination?.page || page;
    $("alert-active").textContent = stats.data.active; $("alert-critical").textContent = stats.data.critical; $("alert-ack").textContent = stats.data.acknowledged; $("alert-resolved").textContent = stats.data.resolved;
    $("alert-list").innerHTML = result.data.map(item => `<div class="threat"><div><strong>${item.alert_message}</strong><small>${date(item.created_at)} · ${badge(item.status)}</small></div><div>${badge(item.severity, "badge")} ${item.status === "ACTIVE" ? `<button class="ghost alert-action" data-id="${item.alert_id}" data-status="ACKNOWLEDGED">Acknowledge</button><button class="danger alert-action" data-id="${item.alert_id}" data-status="RESOLVED">Resolve</button>` : ""}</div></div>`).join("") || `<div class="empty">No alerts found.</div>`;
    let pagination = $("alert-pagination");
    if (!pagination) {
        pagination = document.createElement("div");
        pagination.id = "alert-pagination";
        pagination.className = "pagination";
        $("alert-list").after(pagination);
        pagination.addEventListener("click", event => {
            const button = event.target.closest("[data-page]");
            if (button && !button.disabled) loadAlerts(Number(button.dataset.page)).catch(error => showNotice(error.message));
        });
    }
    const pages = result.pagination?.pages || 1;
    pagination.hidden = pages <= 1;
    pagination.innerHTML = `<button class="ghost" data-page="${Math.max(1, alertsPage - 1)}" ${alertsPage <= 1 ? "disabled" : ""}>Previous</button><span>Page ${alertsPage.toLocaleString()} of ${pages.toLocaleString()} · ${Number(result.pagination?.total || 0).toLocaleString()} alerts</span><button class="ghost" data-page="${Math.min(pages, alertsPage + 1)}" ${alertsPage >= pages ? "disabled" : ""}>Next</button>`;
}

async function loadReports() { const result = await api("/api/reports"); $("report-table").innerHTML = result.data.map(item => `<tr><td>${item.report_name}</td><td>${item.report_type}</td><td>${date(item.generated_at)}</td><td>${badge(item.status)}</td><td>${item.status === "READY" ? `<button class="ghost report-download" data-id="${item.report_id}" data-name="${item.report_name}">Download</button>` : "-"}</td></tr>`).join("") || emptyRow(5); }
async function loadSettings() { const result = await api("/api/settings"); const item = result.data; $("setting-email").value = item.email || ""; $("setting-2fa").checked = Boolean(item.two_factor_enabled); $("setting-alerts").checked = Boolean(item.email_alerts); $("setting-block").checked = Boolean(item.auto_block_ips); $("setting-timeout").value = item.session_timeout; }

const pageMeta = { dashboard: ["Dashboard", "Live visibility into network risk and response."], network: ["Network Traffic", "Search and sort recorded network activity."], intrusions: ["Intrusion Detection", "AI findings with severity and confidence."], threats: ["Threat Intelligence", "Search indicators of compromise and feeds."], alerts: ["Alerts", "Acknowledge and resolve security events."], reports: ["Reports", "Generate and review security reports."], ai: ["AI Detection", "Analyze uploaded network traffic."], settings: ["Settings", "Manage account and detection preferences."] };
const loaders = { dashboard: loadDashboard, network: loadNetwork, intrusions: loadIntrusions, threats: loadThreats, alerts: loadAlerts, reports: loadReports, settings: loadSettings };
async function navigate(page) { document.querySelectorAll(".page").forEach(item => item.classList.toggle("active", item.id === page)); document.querySelectorAll(".nav button").forEach(item => item.classList.toggle("active", item.dataset.page === page)); $("title").textContent = pageMeta[page][0]; $("subtitle").textContent = pageMeta[page][1]; try { if (loaders[page]) await loaders[page](); } catch (error) { showNotice(error.message); } }

document.addEventListener("DOMContentLoaded", async () => {
    $("user-name").textContent = user.username || "Analyst";
    document.querySelectorAll(".nav button").forEach(button => button.addEventListener("click", () => navigate(button.dataset.page)));
    $("logout").addEventListener("click", () => { localStorage.clear(); window.location.href = "login.html"; });
    ["traffic-search", "traffic-status", "traffic-sort"].forEach(id => $(id).addEventListener("input", () => navigate("network")));
    ["intrusion-search", "intrusion-severity"].forEach(id => $(id).addEventListener("input", () => navigate("intrusions")));
    ["threat-search", "threat-severity"].forEach(id => $(id).addEventListener("input", () => navigate("threats")));
    $("alert-list").addEventListener("click", async event => { const button = event.target.closest(".alert-action"); if (!button) return; try { await api(`/api/alerts/${button.dataset.id}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: button.dataset.status }) }); showNotice("Alert status updated.", "success"); await loadAlerts(); } catch (error) { showNotice(error.message); } });
    $("generate-report").addEventListener("click", async () => { try { await api("/api/reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ report_type: "Security", report_name: `Security report ${new Date().toLocaleDateString()}` }) }); showNotice("Report generated successfully.", "success"); await loadReports(); } catch (error) { showNotice(error.message); } });
    $("report-table").addEventListener("click", async event => { const button = event.target.closest(".report-download"); if (!button) return; try { const response = await fetch(`/api/reports/${button.dataset.id}/download`, { headers: { Authorization: `Bearer ${token}` } }); if (!response.ok) throw new Error("Unable to download report."); const blob = await response.blob(); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `${button.dataset.name.replace(/[^a-z0-9-_]+/gi, "-")}.json`; link.click(); URL.revokeObjectURL(link.href); } catch (error) { showNotice(error.message); } });
    $("settings-form").addEventListener("submit", async event => { event.preventDefault(); try { await api("/api/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: $("setting-email").value, two_factor_enabled: $("setting-2fa").checked, email_alerts: $("setting-alerts").checked, auto_block_ips: $("setting-block").checked, session_timeout: Number($("setting-timeout").value) }) }); showNotice("Settings saved.", "success"); } catch (error) { showNotice(error.message); } });
    $("ai-form").addEventListener("submit", async event => {
        event.preventDefault();
        const button = event.target.querySelector("button");
        const file = event.target.querySelector("input").files[0];
        if (!file) return showNotice("Choose a CSV file first.");
        button.disabled = true;
        button.textContent = "Analyzing...";
        try {
            const result = await analyzeCsvFile(file, count => { button.textContent = `Analyzed ${count.toLocaleString()}...`; });
            const predictions = result.preview.map(item => `<div class="threat"><div><strong>${item.prediction.attack_type}</strong><small>${item.input.source_ip && item.input.destination_ip ? `${item.input.source_ip} to ${item.input.destination_ip}` : `Ground truth: ${item.prediction.ground_truth_label || "not provided"}`} · ${item.prediction.model_version}</small></div><span class="badge ${item.prediction.severity.toLowerCase()}">${item.prediction.confidence_score}%</span></div>`).join("");
            $("ai-result").innerHTML = `<div class="result"><strong>${result.analyzed.toLocaleString()} records analyzed</strong><br>${result.threats.toLocaleString()} attack predictions recorded.<div>${predictions}</div></div>`;
            showNotice("Traffic analysis complete.", "success");
            await loadDashboard();
        } catch (error) {
            showNotice(error.message);
        } finally {
            button.disabled = false;
            button.textContent = "Analyze traffic";
        }
    });
    try { await loadDashboard(); } catch (error) { showNotice(error.message); }
});
