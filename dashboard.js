
import { createClient } from '@supabase/supabase-js';
import Chart from 'chart.js/auto';

// --- CONFIG ---
const SUPABASE_URL = 'https://bwpjmowuqkwogbtnheyp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3cGptb3d1cWt3b2didG5oZXlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxNTc5MjEsImV4cCI6MjA4NTczMzkyMX0.RFSrtexhbic7fTn51gTFuJlmSuo5-9Ciyp367f8I_8A';

let supabase;
let myChart = null;

// Logger helpers
const debugLog = document.getElementById('debugLog');

function log(msg) {
    console.log(msg);
    if (debugLog) {
        debugLog.style.display = 'block';
        debugLog.innerHTML += `<div>[INFO] ${msg}</div>`;
    }
}

function logError(msg) {
    console.error(msg);
    if (debugLog) {
        debugLog.style.display = 'block';
        debugLog.innerHTML += `<div style="color:red">[ERROR] ${msg}</div>`;
    }
    const tbody = document.getElementById('sessionsBody');
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align:center; color:red; font-weight:bold;">
                    ${msg}
                </td>
            </tr>
        `;
    }
}

async function init() {
    try {
        log('Inicializando Dashboard v2 (Modules)...');
        supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

        // Bind button
        const btn = document.getElementById('refreshBtn');
        if (btn) btn.addEventListener('click', fetchData);

        await fetchData();
    } catch (e) {
        logError('Falha crônica na inicialização: ' + e.message);
    }
}

async function fetchData() {
    log('Buscando dados...');
    const tbody = document.getElementById('sessionsBody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">Carregando...</td></tr>';

    try {
        const { data, error } = await supabase
            .from('quiz_sessions')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(200);

        if (error) {
            throw error;
        }

        if (!data || data.length === 0) {
            log('Nenhum dado encontrado.');
            if (tbody) tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">Sem dados recentes.</td></tr>';
            return;
        }

        log(`Carregado: ${data.length} sessões.`);
        processData(data);

    } catch (err) {
        logError('Erro no Fetch: ' + (err.message || JSON.stringify(err)));
    }
}

function processData(sessions) {
    try {
        // --- KPI Calculation ---
        const total = sessions.length;
        const completed = sessions.filter(s => s.current_step >= 42 || s.completed).length;
        const rate = total > 0 ? ((completed / total) * 100).toFixed(1) : 0;

        document.getElementById('totalSessions').innerText = total;
        document.getElementById('totalCompleted').innerText = completed;
        document.getElementById('conversionRate').innerText = rate + '%';

        // --- Chart Prep ---
        const steps = Array.from({ length: 42 }, (_, i) => i + 1);
        const funnelCounts = steps.map(step => {
            return sessions.filter(s => s.current_step >= step).length;
        });

        renderChart(steps, funnelCounts);
        renderTable(sessions.slice(0, 50));

    } catch (e) {
        logError('Erro processando lógica local: ' + e.message);
    }
}

function renderChart(labels, data) {
    const ctxCanvas = document.getElementById('funnelChart');
    if (!ctxCanvas) return;

    const ctx = ctxCanvas.getContext('2d');

    if (myChart) myChart.destroy();

    myChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Retenção por Etapa',
                data: data,
                backgroundColor: '#4CAF50',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}

function renderTable(sessions) {
    const tbody = document.getElementById('sessionsBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    sessions.forEach(s => {
        const date = new Date(s.created_at).toLocaleString();
        const status = s.completed || s.current_step >= 42
            ? '<span class="status-badge status-complete">Completo</span>'
            : '<span class="status-badge status-progress">Em progresso</span>';

        let metrics = '-';
        if (s.user_data && s.user_data.height) {
            metrics = `${s.user_data.height}cm / ${s.user_data.currentWeight || '?'}kg`;
        }

        const shortId = s.id ? s.id.slice(0, 8) : '???';

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${date}</td>
            <td>Passo ${s.current_step || '?'}</td>
            <td>${status}</td>
            <td>${metrics}</td>
            <td style="font-family:monospace; color:#888">${shortId}</td>
        `;
        tbody.appendChild(row);
    });
}

// Start
init();
