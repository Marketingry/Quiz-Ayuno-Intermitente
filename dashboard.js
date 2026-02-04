
import { createClient } from '@supabase/supabase-js';
import Chart from 'chart.js/auto';

// --- CONFIG ---
const SUPABASE_URL = 'https://bwpjmowuqkwogbtnheyp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3cGptb3d1cWt3b2didG5oZXlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxNTc5MjEsImV4cCI6MjA4NTczMzkyMX0.RFSrtexhbic7fTn51gTFuJlmSuo5-9Ciyp367f8I_8A';

let supabase;
let myChart = null;
let currentData = [];

// Logger helpers
const debugLog = document.getElementById('debugLog');

function log(msg) {
    if (debugLog && debugLog.style.display !== 'none') {
        debugLog.innerHTML += `<div>[INFO] ${msg}</div>`;
    }
}

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

        // Close Modal on outside click
        window.onclick = function (event) {
            const modal = document.getElementById('answersModal');
            if (event.target == modal) {
                modal.style.display = "none";
            }
        }

        await fetchData();

        // Ensure table header matches (if HTML is old)
        const thead = document.querySelector('.recent-table thead tr');
        if (thead && !thead.innerHTML.includes('Checkout')) {
            // Hotfix header if HTML not updated yet
            thead.innerHTML = '<th>Data</th><th>Step</th><th>Status</th><th>Infos</th><th>Checkout?</th><th>Ações</th>';
        }

    } catch (e) {
        logError('Falha de inicialização: ' + e.message);
    }
}

async function fetchData() {
    const tbody = document.getElementById('sessionsBody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="text-align:center">Carregando...</td></tr>';

    const start = document.getElementById('dateStart').value;
    const end = document.getElementById('dateEnd').value;

    try {
        let query = supabase
            .from('quiz_sessions')
            .select('*')
            .order('created_at', { ascending: false });

        if (start) query = query.gte('created_at', new Date(start).toISOString());
        if (end) query = query.lte('created_at', new Date(end).toISOString());

        if (!start && !end) query = query.limit(500);

        const { data, error } = await query;

        if (error) throw error;

        currentData = data || [];

        if (currentData.length === 0) {
            if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="text-align:center">Nenhum dado encontrado para este período.</td></tr>';
            updateUIStats(0, 0, 0);
            renderChart([], []);
            return;
        }

        processData(currentData);

    } catch (err) {
        logError('Erro ao buscar dados: ' + (err.message || JSON.stringify(err)));
    }
}

function processData(sessions) {
    try {
        // --- KPI Calculation ---
        const total = sessions.length;
        const completed = sessions.filter(s => s.current_step >= 42 || s.completed).length;
        const rate = total > 0 ? ((completed / total) * 100).toFixed(1) : 0;

        updateUIStats(total, completed, rate);

        // --- Chart Prep ---
        const steps = Array.from({ length: 42 }, (_, i) => i + 1);
        const retentionPercents = steps.map(step => {
            const count = sessions.filter(s => s.current_step >= step).length;
            if (total === 0) return 0;
            return ((count / total) * 100).toFixed(1);
        });

        renderChart(steps, retentionPercents);
        renderTable(sessions.slice(0, 50));

    } catch (e) {
        logError('Erro processando dados: ' + e.message);
    }
}

function updateUIStats(total, completed, rate) {
    document.getElementById('totalSessions').innerText = total;
    document.getElementById('totalCompleted').innerText = completed;
    document.getElementById('conversionRate').innerText = rate + '%';
}

function renderChart(labels, data) {
    const ctxCanvas = document.getElementById('funnelChart');
    if (!ctxCanvas) return;

    const ctx = ctxCanvas.getContext('2d');

    if (myChart) myChart.destroy();

    myChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels.map(l => `${l}`),
            datasets: [{
                label: '% Retenção',
                data: data,
                backgroundColor: data.map(val => (parseFloat(val) > 70 ? '#4CAF50' : '#FF9800')),
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    title: { display: true, text: 'Porcentagem (%)' }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return `Retenção: ${context.parsed.y}%`;
                        },
                        afterLabel: function (context) {
                            const currentIndex = context.dataIndex;
                            if (currentIndex === 0) return 'Início do Funil';

                            const prevVal = parseFloat(context.dataset.data[currentIndex - 1]);
                            const currentVal = parseFloat(context.raw);
                            const drop = (prevVal - currentVal).toFixed(1);

                            // Only show drop if > 0
                            if (drop > 0) return `🔻 Queda: -${drop}% (perda nesta etapa)`;
                            return '✅ Sem queda (manteve)';
                        }
                    }
                }
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

        const clickedCheckout = s.clicked_checkout
            ? '<span style="color:green; font-weight:bold;">SIM</span>'
            : '<span style="color:#ccc;">Não</span>';

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${date}</td>
            <td>Passo ${s.current_step || '?'}</td>
            <td>${status}</td>
            <td>${metrics}</td>
            <td>${clickedCheckout}</td>
            <td>
                <button class="view-btn" data-id="${s.id}" style="background:#2196F3; font-size:12px; padding:6px 10px; border-radius:4px; border:none; color:white; cursor:pointer;">
                    Ver Detalhes
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

    // Aesthetic formatting
    let html = `<div style="display:flex; flex-direction:column; gap:15px; font-family:sans-serif;">`;

    // 1. User Info Block
    html += `
    <div style="background:white; padding:15px; border-radius:8px; border:1px solid #eee;">
        <h4 style="margin:0 0 10px 0; color:#2196F3; border-bottom:1px solid #ddd; padding-bottom:5px;">👤 Perfil do Usuário</h4>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px; font-size:13px; color:#444;">
            <div><strong>ID:</strong> <span style="font-family:monospace;">${data.id.split('-')[0]}...</span></div>
            <div><strong>Data:</strong> ${new Date(data.created_at).toLocaleString()}</div>
            <div><strong>Altura:</strong> ${data.user_data?.height || '-'} cm</div>
            <div><strong>Idade:</strong> ${data.user_data?.age || '-'} anos</div>
            <div><strong>Peso Atual:</strong> ${data.user_data?.currentWeight || '-'} kg</div>
            <div><strong>Peso Meta:</strong> ${data.user_data?.targetWeight || '-'} kg</div>
            <div style="grid-column: span 2; margin-top:5px;">
                <strong>Checkout Button:</strong> 
                ${data.clicked_checkout
            ? '<span style="background:#e8f5e9; color:green; padding:2px 6px; border-radius:4px; font-weight:bold;">CLICOU ✅</span>'
            : '<span style="background:#ffebee; color:red; padding:2px 6px; border-radius:4px;">NÃO CLICOU ❌</span>'}
            </div>
        </div>
    </div>`;

    // 2. Answers Block
    html += `
    <div style="background:white; padding:15px; border-radius:8px; border:1px solid #eee;">
        <h4 style="margin:0 0 10px 0; color:#4CAF50; border-bottom:1px solid #ddd; padding-bottom:5px;">📝 Respostas do Quiz</h4>
        <table style="width:100%; border-collapse:collapse; font-size:13px;">
            <tr style="background:#f9f9f9; text-align:left; color:#666;">
                <th style="padding:8px; border-bottom:1px solid #ddd;">Chave / Pergunta</th>
                <th style="padding:8px; border-bottom:1px solid #ddd;">Resposta</th>
            </tr>
    `;

    if (data.answers && Object.keys(data.answers).length > 0) {
        Object.entries(data.answers).forEach(([key, val], index) => {
            const bg = index % 2 === 0 ? '#fff' : '#fafafa';
            html += `<tr style="background:${bg};">
                <td style="padding:8px; border-bottom:1px solid #eee; font-weight:600; color:#555;">${key}</td>
                <td style="padding:8px; border-bottom:1px solid #eee; color:#333;">${val}</td>
            </tr>`;
        });
    } else {
        html += `<tr><td colspan="2" style="padding:15px; text-align:center; color:#999;">Nenhuma resposta registrada.</td></tr>`;
    }
    html += `</table></div>`;

    // 3. Technical & Footer
    html += `
    <div style="font-size:11px; color:#aaa; margin-top:5px; text-align:right;">
        Device: ${data.device_info || 'Unknown'} • Full ID: ${data.id}
    </div></div>`;

    content.innerHTML = html;
    modal.style.display = 'block';
}

async function resetMetrics() {
    if (!confirm('⚠️ TEM CERTEZA? ISSO APAGARÁ TODAS AS SESSÕES!\nDeseja continuar?')) return;

    try {
        const { error } = await supabase
            .from('quiz_sessions')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000');

        if (error) throw error;

        alert('Dados resetados com sucesso.');
        fetchData();

    } catch (e) {
        logError('Erro ao resetar: ' + e.message);
        alert('Erro: Verifique se a politica de DELETE está habilitada no Supabase.');
    }
}

function exportCSV() {
    if (!currentData || currentData.length === 0) {
        alert('Sem dados para exportar.');
        return;
    }

    const csvRows = [];
    csvRows.push(['ID', 'Data', 'Step', 'Status', 'Altura', 'Peso', 'ClicouCheckout', 'Respostas']);

    currentData.forEach(s => {
        const date = new Date(s.created_at).toISOString().split('T')[0];
        const status = s.completed || s.current_step >= 42 ? 'Completo' : 'Incompleto';
        const height = s.user_data?.height || '';
        const weight = s.user_data?.currentWeight || '';
        const checkout = s.clicked_checkout ? 'SIM' : 'NAO';
        const answers = JSON.stringify(s.answers || {}).replace(/"/g, '""');

        csvRows.push([
            s.id,
            date,
            s.current_step,
            status,
            height,
            weight,
            checkout,
            `"${answers}"`
        ].join(','));
    });

    const csvContent = "data:text/csv;charset=utf-8," + csvRows.join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `leads_analytics_v3.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Start
init();
