
import { createClient } from '@supabase/supabase-js';

// --- CONFIG ---
const SUPABASE_URL = 'https://bwpjmowuqkwogbtnheyp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3cGptb3d1cWt3b2didG5oZXlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxNTc5MjEsImV4cCI6MjA4NTczMzkyMX0.RFSrtexhbic7fTn51gTFuJlmSuo5-9Ciyp367f8I_8A';

let supabase;
let currentData = [];

// Logger helpers
const debugLog = document.getElementById('debugLog');

function logError(msg) {
    if (debugLog) {
        debugLog.style.display = 'block';
        debugLog.innerHTML += `<div style="color:red">[ERROR] ${msg}</div>`;
    }
    console.error(msg);
}

async function init() {
    try {
        supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

        // Bind buttons
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) refreshBtn.addEventListener('click', () => fetchData());

        const filterBtn = document.getElementById('filterBtn');
        if (filterBtn) filterBtn.addEventListener('click', () => fetchData());

        const resetBtn = document.getElementById('resetBtn');
        if (resetBtn) resetBtn.addEventListener('click', resetMetrics);

        const exportBtn = document.getElementById('exportBtn');
        if (exportBtn) exportBtn.addEventListener('click', exportCSV);

        // Bind global modal close
        window.onclick = function (event) {
            const modal = document.getElementById('answersModal');
            if (event.target == modal) {
                modal.style.display = "none";
            }
        }

        const quickDate = document.getElementById('quickDate');
        if (quickDate) quickDate.addEventListener('change', (e) => applyQuickDate(e.target.value));

        await fetchData();

    } catch (e) {
        logError('Falha de inicialização: ' + e.message);
    }
}

function applyQuickDate(mode) {
    const startInput = document.getElementById('dateStart');
    const endInput = document.getElementById('dateEnd');

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    endInput.value = todayStr;

    if (mode === 'today') {
        startInput.value = todayStr;
    } else if (mode === '3days') {
        const d = new Date();
        d.setDate(d.getDate() - 3);
        startInput.value = d.toISOString().split('T')[0];
    } else if (mode === '7days') {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        startInput.value = d.toISOString().split('T')[0];
    } else {
        return;
    }

    fetchData();
}

async function fetchData() {
    const listContainer = document.getElementById('funnelList');
    if (listContainer) listContainer.innerHTML = '<div style="text-align:center; padding:20px;">Carregando dados...</div>';

    const start = document.getElementById('dateStart').value;
    const end = document.getElementById('dateEnd').value;

    try {
        let query = supabase
            .from('quiz_sessions')
            .select('*')
            .order('created_at', { ascending: false });

        if (start) {
            const startDate = new Date(start);
            query = query.gte('created_at', startDate.toISOString());
        }
        if (end) {
            const endDate = new Date(end);
            endDate.setHours(23, 59, 59, 999);
            query = query.lte('created_at', endDate.toISOString());
        }

        if (!start && !end) query = query.limit(1000);

        const { data, error } = await query;

        if (error) throw error;

        currentData = data || [];

        if (currentData.length === 0) {
            if (listContainer) listContainer.innerHTML = '<div style="text-align:center; padding:20px;">Sem dados.</div>';
            updateUIStats(0, 0, 0, 0);
            return;
        }

        processData(currentData);

    } catch (err) {
        logError('Erro ao buscar dados: ' + (err.message || JSON.stringify(err)));
    }
}

function processData(sessions) {
    try {
        const total = sessions.length;
        const completed = sessions.filter(s => s.current_step >= 42 || s.completed).length;
        const sales = sessions.filter(s => s.clicked_checkout).length;

        const conversionRate = total > 0 ? ((completed / total) * 100).toFixed(1) : 0;

        updateUIStats(total, completed, conversionRate, sales);
        renderFunnelList(sessions, total);
        renderTable(sessions.slice(0, 50));

    } catch (e) {
        logError('Erro processando dados: ' + e.message);
    }
}

function updateUIStats(total, completed, rate, sales) {
    document.getElementById('totalVisitors').innerText = total;
    document.getElementById('leadsCaptured').innerText = completed;
    document.getElementById('overallConversion').innerText = rate + '%';
    document.getElementById('salesClicks').innerText = sales;
}

function renderFunnelList(sessions, totalSessions) {
    const container = document.getElementById('funnelList');
    if (!container) return;

    let html = '';

    const stepCounts = [];
    for (let i = 1; i <= 42; i++) {
        const count = sessions.filter(s => s.current_step >= i).length;
        stepCounts.push({ step: i, count: count });
    }

    const checkoutCount = sessions.filter(s => s.clicked_checkout).length;
    let previousCount = totalSessions;

    stepCounts.forEach((item, index) => {
        if (item.count === 0 && index > 5) return;

        const conversion = previousCount > 0 ? ((item.count / previousCount) * 100).toFixed(1) : 0;
        const drop = (100 - conversion).toFixed(1);
        const globalPercent = totalSessions > 0 ? (item.count / totalSessions) * 100 : 0;

        // Hide stats for Step 1
        const statsHtml = item.step === 1
            ? `<div class="funnel-stats" style="visibility:hidden; height:10px;">.</div>`
            : `<div class="funnel-stats">
                <span class="stat-green">Conversão: ${conversion}%</span>
                <span class="stat-red">📉 Perca: ${drop}%</span>
               </div>`;

        html += `
        <div class="funnel-item">
            <div class="funnel-header">
                <div class="funnel-label">
                    Quiz Passo ${item.step}
                </div>
                <div class="funnel-count">
                    ${item.count} <small>sessões</small>
                </div>
            </div>
            <div class="progress-bg">
                <div class="progress-fill" style="width: ${globalPercent}%"></div>
            </div>
            ${statsHtml}
        </div>
        `;

        previousCount = item.count;
    });

    // Checkout Step
    const checkoutConv = previousCount > 0 ? ((checkoutCount / previousCount) * 100).toFixed(1) : 0;
    const checkoutDrop = (100 - checkoutConv).toFixed(1);
    const checkoutGlobal = totalSessions > 0 ? (checkoutCount / totalSessions) * 100 : 0;

    html += `
    <div class="funnel-item">
        <div class="funnel-header">
            <div class="funnel-label">
                <span style="color:var(--primary)">🛒</span> Clicaram no CTA (Checkout)
            </div>
            <div class="funnel-count">
                ${checkoutCount} <small>sessões</small>
            </div>
        </div>
        <div class="progress-bg">
            <div class="progress-fill" style="width: ${checkoutGlobal}%; background:#2196F3;"></div>
        </div>
        <div class="funnel-stats">
            <span class="stat-green">Conversão: ${checkoutConv}%</span>
            <span class="stat-red">📉 Perca: ${checkoutDrop}%</span>
        </div>
    </div>
    `;

    container.innerHTML = html;
}

function renderTable(sessions) {
    const tbody = document.getElementById('sessionsBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    sessions.forEach(s => {
        const date = new Date(s.created_at).toLocaleString();
        const status = s.completed || s.current_step >= 42
            ? '<span style="color:green; font-weight:bold;">Completo</span>'
            : '<span style="color:orange;">Parou passo ' + s.current_step + '</span>';

        const checkout = s.clicked_checkout
            ? '<span style="background:#e8f5e9; color:green; padding:2px 6px; border-radius:4px; font-weight:bold; font-size:11px;">SIM</span>'
            : '<span style="color:#ccc; font-size:11px;">-</span>';

        const shortId = s.id.split('-')[0];

        const row = document.createElement('tr');
        row.innerHTML = `
            <td><div style="font-size:12px; font-weight:600;">${date}</div><div style="font-size:10px; color:#999;">ID: ${shortId}</div></td>
            <td>${status}</td>
            <td>${checkout}</td>
            <td>
                <button class="view-btn" data-id="${s.id}" style="background:#ddd; color:#333; font-size:11px; padding:4px 8px;">
                    Detalhes
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });

    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.getAttribute('data-id');
            const session = currentData.find(s => s.id === id);
            if (session) showModal(session);
        });
    });
}

function showModal(data) {
    const content = document.getElementById('modalContent');
    const modal = document.getElementById('answersModal');

    let html = `
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #eee; padding-bottom:10px; margin-bottom:15px;">
            <h3 style="margin:0;">Sessão ${data.id.slice(0, 6)}...</h3>
            <button onclick="document.getElementById('answersModal').style.display='none'" style="background:transparent; color:#333; font-size:20px; padding:0;">&times;</button>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; font-size:13px; margin-bottom:20px;">
            <div><strong>Data:</strong> ${new Date(data.created_at).toLocaleString()}</div>
            <div><strong>Checkout:</strong> ${data.clicked_checkout ? '✅ SIM' : '❌ NÃO'}</div>
            <div><strong>Passo Final:</strong> ${data.current_step}</div>
            <div><strong>Dispositivo:</strong> ${data.device_info || '-'}</div>
        </div>
        <h4 style="margin:0 0 10px 0; color:#4CAF50;">Respostas</h4>
        <div style="background:#f9f9f9; padding:10px; border-radius:8px; max-height:400px; overflow-y:auto; font-size:13px;">
    `;

    if (data.answers && Object.keys(data.answers).length > 0) {
        html += '<ul style="list-style:none; padding:0; margin:0;">';
        Object.entries(data.answers).forEach(([k, v]) => {
            html += `<li style="margin-bottom:8px; border-bottom:1px solid #eee; padding-bottom:4px;">
                <div style="font-weight:600; color:#555;">${k}</div>
                <div>${v}</div>
            </li>`;
        });
        html += '</ul>';
    } else {
        html += '<div>Sem respostas registradas.</div>';
    }

    html += '</div>';
    content.innerHTML = html;
    modal.style.display = 'block';
}

async function resetMetrics() {
    if (!confirm('⚠️ TEM CERTEZA? ISSO APAGARÁ TODAS AS SESSÕES!')) return;
    try {
        const { error } = await supabase.from('quiz_sessions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (error) throw error;
        alert('Resetado!');
        fetchData();
    } catch (e) {
        alert('Erro ao resetar: ' + e.message);
    }
}

function exportCSV() {
    if (!currentData.length) return alert('Sem dados.');
    const rows = [['ID', 'Data', 'Step', 'Checkout', 'Respostas']];
    currentData.forEach(s => {
        rows.push([
            s.id, new Date(s.created_at).toISOString(), s.current_step, s.clicked_checkout ? 'SIM' : 'NAO',
            JSON.stringify(s.answers || {}).replace(/"/g, '""')
        ]);
    });
    const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", "quiz_data.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Start
init();
