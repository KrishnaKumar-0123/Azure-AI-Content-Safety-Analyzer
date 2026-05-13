const STORAGE_KEYS = {
    endpoint: "aiShieldEndpoint",
    apiKey: "aiShieldApiKey",
    history: "aiShieldHistory",
    theme: "aiShieldTheme"
};

const categoryLabels = ["Hate", "Self-harm", "Sexual", "Violence"];
const categoryKeys = ["Hate", "SelfHarm", "Sexual", "Violence"];
let charts = {};

document.addEventListener("DOMContentLoaded", () => {
    if (window.AOS) AOS.init({ duration: 750, once: true, offset: 80 });
    initTheme();
    initParticles();
    initCredentials();
    initAnalyzer();
    initHistory();
    initCharts();
    initExports();
    initChatbot();
    refreshDashboard();
    animateHero();
});

function initTheme() {
    const saved = localStorage.getItem(STORAGE_KEYS.theme) || "dark";
    document.body.classList.toggle("theme-light", saved === "light");
    document.body.classList.toggle("theme-dark", saved !== "light");
    document.querySelectorAll("#themeToggle").forEach((button) => {
        button.addEventListener("click", () => {
            const isLight = document.body.classList.toggle("theme-light");
            document.body.classList.toggle("theme-dark", !isLight);
            localStorage.setItem(STORAGE_KEYS.theme, isLight ? "light" : "dark");
            toast(`Theme switched to ${isLight ? "light" : "dark"} mode.`, "success");
            refreshDashboard();
        });
    });
}

function initCredentials() {
    const endpoint = document.getElementById("endpointInput");
    const apiKey = document.getElementById("apiKeyInput");
    if (!endpoint || !apiKey) return;

    endpoint.value = localStorage.getItem(STORAGE_KEYS.endpoint) || "";
    apiKey.value = localStorage.getItem(STORAGE_KEYS.apiKey) || "";

    document.getElementById("saveCredentials")?.addEventListener("click", () => {
        if (!endpoint.value.trim() || !apiKey.value.trim()) {
            toast("Add both Azure endpoint and API key before saving.", "error");
            return;
        }
        localStorage.setItem(STORAGE_KEYS.endpoint, endpoint.value.trim());
        localStorage.setItem(STORAGE_KEYS.apiKey, apiKey.value.trim());
        toast("Azure credentials saved in browser storage.", "success");
    });

    document.getElementById("clearCredentials")?.addEventListener("click", () => {
        localStorage.removeItem(STORAGE_KEYS.endpoint);
        localStorage.removeItem(STORAGE_KEYS.apiKey);
        endpoint.value = "";
        apiKey.value = "";
        toast("Stored credentials cleared.", "success");
    });

    document.getElementById("toggleKey")?.addEventListener("click", () => {
        apiKey.type = apiKey.type === "password" ? "text" : "password";
    });

    document.getElementById("testConnection")?.addEventListener("click", async () => {
        const credentials = readCredentials();
        if (!credentials) return;
        const result = await apiPost("/api/test-connection", credentials);
        if (result?.success) toast(result.result.message, "success");
    });
}

function initAnalyzer() {
    const input = document.getElementById("contentInput");
    const analyzeButton = document.getElementById("analyzeButton");
    if (!input || !analyzeButton) return;

    input.addEventListener("input", () => {
        const count = input.value.length;
        document.getElementById("charCount").textContent = `${count} / 10000`;
        document.getElementById("validationState").textContent = count > 0 ? "Valid text" : "Ready";
    });

    analyzeButton.addEventListener("click", async () => {
        const text = input.value.trim();
        if (text.length < 3) {
            toast("Enter at least 3 characters to analyze.", "error");
            return;
        }
        const credentials = readCredentials();
        if (!credentials) return;

        setLoading(true);
        const response = await apiPost("/api/analyze", { ...credentials, text });
        setLoading(false);

        if (response?.success) {
            renderResult(response.result, text);
            saveHistory(response.result, text);
            refreshDashboard();
            toast(`Analysis complete: ${response.result.verdict}`, response.result.safe ? "success" : "error");
        }
    });
}

function readCredentials() {
    const endpointValue = document.getElementById("endpointInput")?.value.trim() || localStorage.getItem(STORAGE_KEYS.endpoint) || "";
    const keyValue = document.getElementById("apiKeyInput")?.value.trim() || localStorage.getItem(STORAGE_KEYS.apiKey) || "";
    if (!endpointValue || !keyValue) {
        toast("Azure endpoint and API key are required.", "error");
        return null;
    }
    localStorage.setItem(STORAGE_KEYS.endpoint, endpointValue);
    localStorage.setItem(STORAGE_KEYS.apiKey, keyValue);
    return { endpoint: endpointValue, apiKey: keyValue };
}

async function apiPost(url, body) {
    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });
        const payload = await response.json();
        if (!response.ok || !payload.success) {
            toast(payload.error || "Request failed.", "error");
            return null;
        }
        return payload;
    } catch (error) {
        toast(`Network error: ${error.message}`, "error");
        return null;
    }
}

function setLoading(isLoading) {
    const button = document.getElementById("analyzeButton");
    if (!button) return;
    button.disabled = isLoading;
    button.querySelector(".btn-label")?.classList.toggle("hidden", isLoading);
    button.querySelector(".spinner")?.classList.toggle("hidden", !isLoading);
}

function renderResult(result, text) {
    document.getElementById("verdictText").textContent = result.verdict;
    document.getElementById("verdictCopy").textContent = result.safe
        ? "No category crossed the unsafe threshold. Keep monitoring and reviewing edge cases."
        : "One or more categories show elevated risk. Review content before publishing.";
    updateThreatMeter(result.threatScore, result.safe);

    const resultGrid = document.getElementById("categoryResults");
    if (resultGrid) {
        resultGrid.innerHTML = result.categories.map((item) => `
            <article class="glass-card result-card" style="border-left-color:${item.color}">
                <div class="badge" style="color:${item.color};border-color:${item.color}55;background:${item.color}14">${item.risk}</div>
                <h3>${item.label}</h3>
                <div class="severity">${item.severity}/7</div>
                <p class="muted">Azure severity score for this harm category.</p>
            </article>
        `).join("");
        gsap.from(".result-card", { y: 18, opacity: 0, stagger: 0.08, duration: 0.45 });
    }

    const input = document.getElementById("contentInput");
    if (input && !input.value) input.value = text;
}

function updateThreatMeter(score, isSafe) {
    const meter = document.getElementById("threatMeter");
    const label = document.getElementById("threatScore");
    if (!meter || !label) return;
    const circumference = 314;
    meter.style.strokeDashoffset = String(circumference - (circumference * score / 100));
    meter.style.stroke = isSafe ? "#22c55e" : score > 75 ? "#ef4444" : "#f59e0b";
    label.textContent = `${score}%`;
}

function saveHistory(result, text) {
    const history = getHistory();
    history.unshift({
        id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
        createdAt: new Date().toISOString(),
        text,
        verdict: result.verdict,
        safe: result.safe,
        threatScore: result.threatScore,
        maxSeverity: result.maxSeverity,
        categories: result.categories
    });
    localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(history.slice(0, 60)));
}

function getHistory() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEYS.history) || "[]");
    } catch {
        return [];
    }
}

function initHistory() {
    document.querySelectorAll("#historySearch").forEach((input) => {
        input.addEventListener("input", () => renderHistory(input.value));
    });
    renderHistory("");
}

function renderHistory(query = "") {
    const host = document.getElementById("historyList");
    if (!host) return;
    const filtered = getHistory().filter((item) => item.text.toLowerCase().includes(query.toLowerCase()));
    host.innerHTML = filtered.length ? filtered.map((item) => `
        <div class="history-item">
            <div>
                <strong>${item.verdict} - Threat ${item.threatScore}%</strong>
                <p>${escapeHtml(item.text.slice(0, 150))}${item.text.length > 150 ? "..." : ""}</p>
                <p>${new Date(item.createdAt).toLocaleString()}</p>
            </div>
            <span class="badge" style="color:${item.safe ? "#22c55e" : "#ef4444"}">${item.maxSeverity}/7</span>
        </div>
    `).join("") : `<p class="muted">No scans saved yet.</p>`;
}

function initCharts() {
    Chart.defaults.color = getComputedStyle(document.body).getPropertyValue("--muted").trim();
    Chart.defaults.borderColor = "rgba(148, 210, 255, 0.16)";
}

function refreshDashboard() {
    const history = getHistory();
    const safe = history.filter((item) => item.safe).length;
    const unsafe = history.length - safe;
    const avg = history.length ? Math.round(history.reduce((sum, item) => sum + item.threatScore, 0) / history.length) : 0;

    setText("totalScans", history.length);
    setText("safeScans", safe);
    setText("unsafeScans", unsafe);
    setText("avgThreat", `${avg}%`);
    updateCounters();
    renderHistory(document.getElementById("historySearch")?.value || "");
    renderHeatmap(history);
    renderCharts(history, safe, unsafe);
}

function renderCharts(history, safe, unsafe) {
    const categoryTotals = categoryKeys.map((key) =>
        history.reduce((sum, item) => sum + (item.categories.find((cat) => cat.category === key)?.severity || 0), 0)
    );
    const recent = history.slice(0, 10).reverse();

    makeChart("doughnutChart", "doughnut", {
        labels: ["Safe", "Unsafe"],
        datasets: [{ data: [safe, unsafe], backgroundColor: ["#22c55e", "#ef4444"], borderWidth: 0 }]
    });
    makeChart("barChart", "bar", {
        labels: categoryLabels,
        datasets: [{ label: "Severity total", data: categoryTotals, backgroundColor: ["#38bdf8", "#f59e0b", "#ec4899", "#ef4444"], borderRadius: 8 }]
    });
    makeChart("lineChart", "line", {
        labels: recent.map((item) => new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })),
        datasets: [{ label: "Threat score", data: recent.map((item) => item.threatScore), borderColor: "#00d4ff", backgroundColor: "rgba(0, 212, 255, 0.12)", tension: 0.35, fill: true }]
    });
    makeChart("pieChart", "pie", {
        labels: categoryLabels,
        datasets: [{ data: categoryTotals.map((value) => value || 1), backgroundColor: ["#38bdf8", "#f59e0b", "#ec4899", "#ef4444"], borderWidth: 0 }]
    });
}

function makeChart(id, type, data) {
    const canvas = document.getElementById(id);
    if (!canvas) return;
    if (charts[id]) charts[id].destroy();
    charts[id] = new Chart(canvas, {
        type,
        data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: "bottom" } },
            scales: type === "bar" || type === "line" ? { y: { beginAtZero: true, suggestedMax: type === "line" ? 100 : undefined } } : undefined
        }
    });
}

function renderHeatmap(history) {
    const host = document.getElementById("riskHeatmap");
    if (!host) return;
    const cells = [];
    const source = history.slice(0, 8);
    categoryKeys.forEach((key, index) => {
        source.forEach((item) => {
            const severity = item.categories.find((cat) => cat.category === key)?.severity || 0;
            cells.push({ label: categoryLabels[index], severity });
        });
    });
    host.innerHTML = (cells.length ? cells : categoryLabels.flatMap((label) => Array.from({ length: 4 }, () => ({ label, severity: 0 })))).map((cell) => {
        const color = severityColor(cell.severity);
        return `<div class="heat-cell" title="${cell.label}: ${cell.severity}/7" style="background:${color};opacity:${Math.max(0.28, (cell.severity + 1) / 8)}">${cell.severity}</div>`;
    }).join("");
}

function severityColor(severity) {
    if (severity === 0) return "#22c55e";
    if (severity <= 2) return "#38bdf8";
    if (severity <= 4) return "#f59e0b";
    if (severity <= 6) return "#f97316";
    return "#ef4444";
}

function updateCounters() {
    document.querySelectorAll(".counter").forEach((counter) => {
        const target = Number(counter.textContent || "0");
        gsap.fromTo(counter, { innerText: 0 }, { innerText: target, duration: 0.8, snap: { innerText: 1 } });
    });
}

function initExports() {
    document.querySelectorAll("#downloadAnalytics").forEach((button) => {
        button.addEventListener("click", () => {
            const blob = new Blob([JSON.stringify(getHistory(), null, 2)], { type: "application/json" });
            downloadBlob(blob, `ai-shield-analytics-${Date.now()}.json`);
            toast("Analytics JSON downloaded.", "success");
        });
    });
    document.querySelectorAll("#exportPdf").forEach((button) => {
        button.addEventListener("click", exportPdfReport);
    });
}

async function exportPdfReport() {
    if (!window.jspdf || !window.html2canvas) {
        toast("PDF libraries are still loading. Try again in a moment.", "error");
        return;
    }
    const { jsPDF } = window.jspdf;
    const target = document.querySelector("main");
    const canvas = await html2canvas(target, { scale: 1.2, backgroundColor: "#07111f" });
    const img = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const width = pdf.internal.pageSize.getWidth();
    const height = canvas.height * width / canvas.width;
    pdf.addImage(img, "PNG", 0, 0, width, Math.min(height, 290));
    pdf.save(`ai-shield-report-${Date.now()}.pdf`);
    toast("PDF report exported.", "success");
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}

function initChatbot() {
    const input = document.getElementById("chatInput");
    const send = document.getElementById("chatSend");
    if (!input || !send) return;
    const submit = () => {
        const question = input.value.trim();
        if (!question) return;
        appendChat(question, "user-msg");
        appendChat(answerQuestion(question), "bot-msg");
        input.value = "";
    };
    send.addEventListener("click", submit);
    input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") submit();
    });
}

function appendChat(message, className) {
    const log = document.getElementById("chatLog");
    const div = document.createElement("div");
    div.className = className;
    div.textContent = message;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
}

function answerQuestion(question) {
    const q = question.toLowerCase();
    if (q.includes("key") || q.includes("endpoint")) return "Create an Azure AI Content Safety resource, copy its endpoint and key from Resource Management, then paste them into the connection panel.";
    if (q.includes("severity")) return "Azure returns severity from 0 to 7 in this app. 0 means no detected harm, while higher values indicate stronger risk for that category.";
    if (q.includes("ai-900")) return "This demonstrates AI-900 skills: prebuilt Azure AI services, responsible AI, REST integration, and content moderation workflows.";
    if (q.includes("responsible")) return "Responsible AI means designing for safety, transparency, fairness, accountability, privacy, and human review when automated decisions affect people.";
    return "AI Shield analyzes text with Azure AI Content Safety, stores local scan history, and visualizes category severity so reviewers can make informed moderation decisions.";
}

function toast(message, type = "success") {
    const host = document.getElementById("toastHost");
    if (!host) return;
    const item = document.createElement("div");
    item.className = `toast ${type}`;
    item.textContent = message;
    host.appendChild(item);
    gsap.fromTo(item, { x: 40, opacity: 0 }, { x: 0, opacity: 1, duration: 0.25 });
    setTimeout(() => {
        gsap.to(item, { x: 40, opacity: 0, duration: 0.25, onComplete: () => item.remove() });
    }, 3600);
}

function initParticles() {
    const canvas = document.getElementById("particleCanvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const particles = Array.from({ length: 70 }, () => ({ x: 0, y: 0, vx: 0, vy: 0, r: 0 }));
    const resize = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        particles.forEach((p) => {
            p.x = Math.random() * canvas.width;
            p.y = Math.random() * canvas.height;
            p.vx = (Math.random() - 0.5) * 0.35;
            p.vy = (Math.random() - 0.5) * 0.35;
            p.r = Math.random() * 1.7 + 0.5;
        });
    };
    const draw = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach((p, i) => {
            p.x += p.vx;
            p.y += p.vy;
            if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
            if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(0, 212, 255, 0.55)";
            ctx.fill();
            particles.slice(i + 1).forEach((other) => {
                const distance = Math.hypot(p.x - other.x, p.y - other.y);
                if (distance < 110) {
                    ctx.strokeStyle = `rgba(0, 212, 255, ${0.12 - distance / 1000})`;
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(p.x, p.y);
                    ctx.lineTo(other.x, other.y);
                    ctx.stroke();
                }
            });
        });
        requestAnimationFrame(draw);
    };
    resize();
    draw();
    window.addEventListener("resize", resize);
}

function animateHero() {
    if (!window.gsap) return;
    gsap.from(".brand-mark", { rotate: -12, scale: 0.85, duration: 0.7, ease: "back.out(1.7)" });
    gsap.from(".scanner-ring", { rotate: 180, opacity: 0, duration: 1.1, ease: "power2.out" });
}

function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
}

function escapeHtml(value) {
    return value.replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    }[char]));
}
