// Variáveis globais
let charts = {};
let dashboardData = null;
let currentExcelData = null;
const accentColor = '#00f6ff';
const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// Mapeamento de tipos de manutenção
const TIPO_MAPPING = {
    7: 'Corretiva',
    10: 'Preventiva', 
    22: 'Preditiva',
    12: 'Melhoria',
    21: 'Inspeção',
    11: 'Modificação',
    9: 'Calibração',
    5: 'Limpeza',
    8: 'Outros'
};

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    alert("JavaScript carregado!");
    initializeDashboard();
    setupEventListeners();
    updateDateTime();
    setInterval(updateDateTime, 1000);
});

function setupEventListeners() {
    document.getElementById('btn-refresh').addEventListener('click', loadDashboardData);
    document.getElementById('btn-dashboard').addEventListener('click', () => showView('dashboard'));
    document.getElementById('btn-upload').addEventListener('click', () => showView('upload'));
    document.getElementById('btn-analytics').addEventListener('click', () => showView('analytics'));
    document.getElementById('btn-predictive').addEventListener('click', () => showView('predictive'));
    document.getElementById('btn-edit').addEventListener('click', () => showView('edit'));
    document.getElementById('btn-settings').addEventListener('click', () => showView('settings'));
    document.getElementById('btn-export').addEventListener('click', exportReport);
    document.getElementById('btn-process-file').addEventListener('click', processExcelFile);
    document.getElementById('excel-file-input').addEventListener('change', handleFileSelect);
    
    // Event listeners para botões que podem não existir ainda
    const btnSaveEdit = document.getElementById('btn-save-edit');
    if (btnSaveEdit) btnSaveEdit.addEventListener('click', saveEditedData);
    
    const btnCancelEdit = document.getElementById('btn-cancel-edit');
    if (btnCancelEdit) btnCancelEdit.addEventListener('click', () => showView('dashboard'));
    
    const btnSaveSettings = document.getElementById('btn-save-settings');
    if (btnSaveSettings) btnSaveSettings.addEventListener('click', saveSettings);
    
    const btnCancelSettings = document.getElementById('btn-cancel-settings');
    if (btnCancelSettings) btnCancelSettings.addEventListener('click', () => showView('dashboard'));
}

function showView(viewName) {
    // Esconder todas as views
    const views = ['dashboard', 'upload', 'analytics', 'predictive', 'edit', 'settings'];
    views.forEach(view => {
        const element = document.getElementById(view + '-view');
        if (element) element.classList.add('hidden');
    });

    // Mostrar view selecionada
    const targetView = document.getElementById(viewName + '-view');
    if (targetView) targetView.classList.remove('hidden');

    // Atualizar botões ativos
    document.querySelectorAll('aside button').forEach(btn => {
        btn.classList.remove('text-kpi-accent', 'bg-gray-700/50');
        btn.classList.add('text-gray-400');
    });

    const activeBtn = document.getElementById('btn-' + viewName);
    if (activeBtn) {
        activeBtn.classList.remove('text-gray-400');
        activeBtn.classList.add('text-kpi-accent', 'bg-gray-700/50');
    }

    // Carregar dados específicos da view
    if (viewName === 'analytics' && currentExcelData) {
        loadEquipmentAnalysis();
    } else if (viewName === 'predictive' && currentExcelData) {
        loadPredictiveAnalysis();
    } else if (viewName === 'edit') {
        loadEditForm();
    } else if (viewName === 'settings') {
        loadSettingsForm();
    }
}

function updateDateTime() {
    const now = new Date();
    const dateTimeString = now.toLocaleString('pt-BR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    const element = document.getElementById('date-time-display');
    if (element) element.textContent = dateTimeString;
}

function showLoading(show) {
    const indicator = document.getElementById('loading-indicator');
    if (indicator) {
        if (show) {
            indicator.classList.remove('hidden');
        } else {
            indicator.classList.add('hidden');
        }
    }
}

async function initializeDashboard() {
    // Tentar carregar dados salvos do Firebase
    await loadFromFirebase();
    
    // Se não há dados, mostrar view de upload
    if (!currentExcelData) {
        showView('upload');
    } else {
        await loadDashboardData();
    }
}

function handleFileSelect(event) {
    const file = event.target.files[0];
    const statusEl = document.getElementById('upload-status');
    const processBtn = document.getElementById('btn-process-file');
    
    if (file) {
        statusEl.innerHTML = `<span class="text-blue-400">Arquivo selecionado: ${file.name}</span>`;
        processBtn.disabled = false;
    } else {
        statusEl.innerHTML = 'Selecione um arquivo CSV para começar a análise.';
        processBtn.disabled = true;
    }
}

async function processExcelFile() {
    const fileInput = document.getElementById("excel-file-input");
    const file = fileInput.files[0];
    const statusEl = document.getElementById("upload-status");
    
    if (!file) {
        statusEl.innerHTML = '<span class="text-red-500">Por favor, selecione um arquivo.</span>';
        return;
    }

    statusEl.innerHTML = '<span class="text-yellow-400">Processando arquivo...</span>';
    showLoading(true);

    try {
        let jsonData = [];
        const fileExtension = file.name.split('.').pop().toLowerCase();

        if (fileExtension === 'csv') {
            jsonData = await new Promise((resolve, reject) => {
                Papa.parse(file, {
                    header: true,
                    delimiter: ",",
                    dynamicTyping: true,
                    skipEmptyLines: true,
                    complete: function(results) {
                        if (results.errors.length) {
                            console.warn('Avisos no CSV:', results.errors);
                        }
                        resolve(results.data);
                    },
                    error: function(err) {
                        reject(err);
                    }
                });
            });
        } else {
            throw new Error("Formato de arquivo não suportado. Por favor, use .csv.");
        }
        
        if (jsonData.length === 0) {
            throw new Error("Arquivo está vazio.");
        }

        // Salvar dados processados
        currentExcelData = jsonData;
        
        // Salvar no Firebase
        await saveToFirebase(jsonData, file.name);
        
        statusEl.innerHTML = `<span class="text-green-500">✓ Arquivo processado com sucesso! ${jsonData.length} registros carregados.</span>`;
        
        // Processar dados e atualizar dashboard
        await loadDashboardData();
        
        // Voltar para o dashboard
        setTimeout(() => {
            showView('dashboard');
        }, 2000);
        
    } catch (error) {
        console.error('Erro ao processar arquivo:', error);
        statusEl.innerHTML = `<span class="text-red-500">✗ Erro: ${error.message}</span>`;
    } finally {
        showLoading(false);
    }
}

async function saveToFirebase(data, filename) {
    try {
        if (!window.firebase) {
            console.log('Firebase não configurado, salvando apenas localmente');
            localStorage.setItem('maintenanceData', JSON.stringify(data));
            localStorage.setItem('maintenanceFilename', filename);
            return;
        }

        const { db, doc, setDoc } = window.firebase;
        
        // Salvar dados principais
        await setDoc(doc(db, 'maintenance', 'currentData'), {
            data: data,
            filename: filename,
            uploadDate: new Date().toISOString(),
            recordCount: data.length
        });
        
        console.log('Dados salvos no Firebase com sucesso');
    } catch (error) {
        console.error('Erro ao salvar no Firebase:', error);
        // Fallback para localStorage
        localStorage.setItem('maintenanceData', JSON.stringify(data));
        localStorage.setItem('maintenanceFilename', filename);
    }
}

async function loadFromFirebase() {
    try {
        if (!window.firebase) {
            console.log('Firebase não configurado, carregando do localStorage');
            const data = localStorage.getItem('maintenanceData');
            if (data) {
                currentExcelData = JSON.parse(data);
                return;
            }
            return;
        }

        const { db, doc, getDoc } = window.firebase;
        
        const docRef = doc(db, 'maintenance', 'currentData');
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            const savedData = docSnap.data();
            currentExcelData = savedData.data;
            console.log('Dados carregados do Firebase:', savedData.recordCount, 'registros');
        }
    } catch (error) {
        console.error('Erro ao carregar do Firebase:', error);
        // Fallback para localStorage
        const data = localStorage.getItem('maintenanceData');
        if (data) {
            currentExcelData = JSON.parse(data);
        }
    }
}

async function loadDashboardData() {
    if (!currentExcelData) {
        console.log('Nenhum dado Excel disponível');
        return;
    }

    showLoading(true);
    try {
        const kpis = calculateKPIs(currentExcelData);
        const monthlyData = calculateMonthlyData(currentExcelData);
        const mttrMtbf = calculateMTTRMTBF(currentExcelData);
        const additionalData = calculateAdditionalChartsData(currentExcelData);
        
        dashboardData = {
            kpis: kpis,
            monthly_costs: monthlyData.costs,
            monthly_correctives: monthlyData.correctives,
            monthly_status: monthlyData.statusByMonth,
            mttr: mttrMtbf.mttr,
            mtbf: mttrMtbf.mtbf,
            additionalData: additionalData
        };
        
        updateKPIs(dashboardData.kpis);
        createAllCharts(dashboardData);
        
    } catch (error) {
        console.error('Erro:', error);
        alert('Erro ao processar dados do dashboard: ' + error.message);
    } finally {
        showLoading(false);
    }
}

function calculateKPIs(data) {
    if (!data || data.length === 0) {
        return {
            corretivas: 0, preventivas: 0, preventivasVenc: 0,
            preditivas: 0, melhorias: 0, equipamentos: 0,
            osTotal: 0, availability: 0, custoTotal: 0
        };
    }
    
    // Contagem por tipo de manutenção
    const tipoCounts = {};
    data.forEach(row => {
        const tipo = row['Tipo de Manutenção'];
        if (tipo !== undefined && tipo !== null) {
            tipoCounts[tipo] = (tipoCounts[tipo] || 0) + 1;
        }
    });
    
    const kpis = {
        corretivas: tipoCounts[7] || 0,
        preventivas: tipoCounts[10] || 0,
        preditivas: tipoCounts[22] || 0,
        melhorias: tipoCounts[12] || 0,
        equipamentos: new Set(data.map(row => row['Equipamento']).filter(eq => eq)).size,
        osTotal: data.length,
        preventivasVenc: 0
    };
    
    // Calcular preventivas vencidas
    try {
        const hoje = new Date();
        const preventivas = data.filter(row => row['Tipo de Manutenção'] === 10);
        const vencidas = preventivas.filter(row => {
            const dataStr = row['Data Manutenção'];
            if (!dataStr) return false;
            
            // Tentar diferentes formatos de data
            let dataManutencao;
            if (dataStr.includes('/')) {
                const parts = dataStr.split('/');
                if (parts.length === 3) {
                    // Assumir formato DD/MM/YYYY
                    dataManutencao = new Date(parts[2], parts[1] - 1, parts[0]);
                }
            } else {
                dataManutencao = new Date(dataStr);
            }
            
            return dataManutencao && !isNaN(dataManutencao.getTime()) && dataManutencao < hoje;
        });
        kpis.preventivasVenc = vencidas.length;
    } catch (e) {
        console.log('Erro ao calcular preventivas vencidas:', e);
    }
    
    // Calcular custo total
    try {
        let custoTotal = 0;
        data.forEach(row => {
            const valorMaterial = parseFloat(String(row['Valor Material'] || '0').replace(',', '.').replace(/"/g, '')) || 0;
            const valorMaoObra = parseFloat(String(row['Valor Mão de Obra'] || '0').replace(',', '.').replace(/"/g, '')) || 0;
            custoTotal += valorMaterial + valorMaoObra;
        });
        kpis.custoTotal = custoTotal;
    } catch (e) {
        console.log('Erro ao calcular custo total:', e);
        kpis.custoTotal = 0;
    }
    
    // Calcular disponibilidade (simulada)
    kpis.availability = Math.max(85, Math.min(99, 95 - (kpis.corretivas * 0.5)));
    
    return kpis;
}

function calculateMonthlyData(data) {
    const costs = Array(12).fill(0);
    const correctives = Array(12).fill(0);
    const statusByMonth = {
        'Não Iniciada': Array(12).fill(0),
        'Requisitada': Array(12).fill(0),
        'Iniciada': Array(12).fill(0),
        'Liberada': Array(12).fill(0),
        'Suspensa': Array(12).fill(0)
    };
    
    if (!data || data.length === 0) {
        return { costs, correctives, statusByMonth };
    }
    
    try {
        data.forEach(row => {
            const dataStr = row['Data Manutenção'];
            if (!dataStr) return;
            
            let dataManutencao;
            if (dataStr.includes('/')) {
                const parts = dataStr.split('/');
                if (parts.length === 3) {
                    // Assumir formato DD/MM/YYYY
                    dataManutencao = new Date(parts[2], parts[1] - 1, parts[0]);
                }
            } else {
                dataManutencao = new Date(dataStr);
            }
            
            if (dataManutencao && !isNaN(dataManutencao.getTime())) {
                const month = dataManutencao.getMonth(); // 0-11
                
                // Custos
                const valorMaterial = parseFloat(String(row['Valor Material'] || '0').replace(',', '.').replace(/"/g, '')) || 0;
                const valorMaoObra = parseFloat(String(row['Valor Mão de Obra'] || '0').replace(',', '.').replace(/"/g, '')) || 0;
                costs[month] += valorMaterial + valorMaoObra;
                
                // Corretivas
                if (row['Tipo de Manutenção'] === 7) {
                    correctives[month]++;
                }
                
                // Status das ordens por mês
                const estado = row['Estado'] || 'Não Iniciada';
                if (statusByMonth[estado]) {
                    statusByMonth[estado][month]++;
                }
            }
        });
    } catch (e) {
        console.log('Erro ao calcular dados mensais:', e);
    }
    
    return { costs, correctives, statusByMonth };
}

function calculateMTTRMTBF(data) {
    // MTTR e MTBF simulados baseados nos dados
    const mttr = [8, 6, 4]; // Trimestral
    const mtbf = Array(12).fill(0).map((_, i) => {
        const monthData = data.filter(row => {
            const dataStr = row['Data Manutenção'];
            if (!dataStr) return false;
            
            let date;
            if (dataStr.includes('/')) {
                const parts = dataStr.split('/');
                if (parts.length === 3) {
                    date = new Date(parts[2], parts[1] - 1, parts[0]);
                }
            } else {
                date = new Date(dataStr);
            }
            
            return date && !isNaN(date.getTime()) && date.getMonth() === i;
        });
        return Math.max(100, 1000 - monthData.length * 10);
    });
    
    return { mttr, mtbf };
}

function calculateAdditionalChartsData(data) {
    const maintenanceTypeCounts = {};
    const criticalityCounts = {};
    const analystCounts = {};
    const equipmentCounts = {};

    data.forEach(row => {
        // Tipo de Manutenção
        const tipoDesc = TIPO_MAPPING[row["Tipo de Manutenção"]] || "Outros";
        maintenanceTypeCounts[tipoDesc] = (maintenanceTypeCounts[tipoDesc] || 0) + 1;

        // Criticidade
        const criticidade = row["Criticidade"];
        if (criticidade !== undefined && criticidade !== null) {
            criticalityCounts[criticidade] = (criticalityCounts[criticidade] || 0) + 1;
        }

        // Analista
        const analyst = row["Nome do Analista"];
        if (analyst) {
            analystCounts[analyst] = (analystCounts[analyst] || 0) + 1;
        }

        // Equipamento
        const equipment = row["Nome Equipamento"];
        if (equipment) {
            equipmentCounts[equipment] = (equipmentCounts[equipment] || 0) + 1;
        }
    });

    // Top 5 Equipamentos
    const sortedEquipment = Object.entries(equipmentCounts)
        .sort(([, countA], [, countB]) => countB - countA)
        .slice(0, 5)
        .map(([equipment, count]) => ({ equipment, count }));

    return {
        maintenanceTypeCounts,
        criticalityCounts,
        analystCounts,
        topEquipment: sortedEquipment
    };
}

function updateKPIs(kpis) {
    const elements = {
        'kpi-corretivas': kpis.corretivas || 0,
        'kpi-preventivas': kpis.preventivas || 0,
        'kpi-preventivas-venc': kpis.preventivasVenc || 0,
        'kpi-preditivas': kpis.preditivas || 0,
        'kpi-melhorias': kpis.melhorias || 0,
        'kpi-equipamentos': kpis.equipamentos || 0,
        'kpi-os-total': kpis.osTotal || 0,
        'kpi-availability': Math.round(kpis.availability || 0) + '%',
        'kpi-custo-total': 'R$ ' + (kpis.custoTotal || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})
    };
    
    Object.entries(elements).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    });
}

function createAllCharts(data) {
    try {
        createMTTRChart(data.mttr);
        createMTBFChart(data.mtbf);
        createMonthlyCostsChart(data.monthly_costs);
        createMonthlyCorrectivesChart(data.monthly_correctives);
        createMonthlyStatusChart(data.monthly_status);
        
        // Novos gráficos
        if (data.additionalData) {
            createMaintenanceTypeChart(data.additionalData.maintenanceTypeCounts);
            createCriticalityChart(data.additionalData.criticalityCounts);
            createTopEquipmentChart(data.additionalData.topEquipment);
            createAnalystChart(data.additionalData.analystCounts);
        }
    } catch (error) {
        console.error('Erro ao criar gráficos:', error);
    }
}

function createMTTRChart(mttrData) {
    const ctx = document.getElementById('mttrChart');
    if (!ctx) return;
    
    if (charts.mttr) charts.mttr.destroy();
    
    charts.mttr = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: {
            labels: ['Q1', 'Q2', 'Q3'],
            datasets: [{
                label: 'MTTR (horas)',
                data: mttrData,
                backgroundColor: accentColor,
                borderColor: accentColor,
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: 'white' } }
            },
            scales: {
                y: { 
                    beginAtZero: true,
                    ticks: { color: 'white' },
                    grid: { color: 'rgba(255,255,255,0.1)' }
                },
                x: { 
                    ticks: { color: 'white' },
                    grid: { color: 'rgba(255,255,255,0.1)' }
                }
            }
        }
    });
}

function createMTBFChart(mtbfData) {
    const ctx = document.getElementById('mtbfChart');
    if (!ctx) return;
    
    if (charts.mtbf) charts.mtbf.destroy();
    
    charts.mtbf = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
            labels: meses,
            datasets: [{
                label: 'MTBF (horas)',
                data: mtbfData,
                borderColor: accentColor,
                backgroundColor: accentColor + '20',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: 'white' } }
            },
            scales: {
                y: { 
                    beginAtZero: true,
                    ticks: { color: 'white' },
                    grid: { color: 'rgba(255,255,255,0.1)' }
                },
                x: { 
                    ticks: { color: 'white' },
                    grid: { color: 'rgba(255,255,255,0.1)' }
                }
            }
        }
    });
}

function createMonthlyCostsChart(costsData) {
    const ctx = document.getElementById('monthlyCostsChart');
    if (!ctx) return;
    
    if (charts.costs) charts.costs.destroy();
    
    charts.costs = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: {
            labels: meses,
            datasets: [{
                label: 'Custos (R$)',
                data: costsData,
                backgroundColor: '#10b981',
                borderColor: '#10b981',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: 'white' } }
            },
            scales: {
                y: { 
                    beginAtZero: true,
                    ticks: { 
                        color: 'white',
                        callback: function(value) {
                            return 'R$ ' + value.toLocaleString('pt-BR');
                        }
                    },
                    grid: { color: 'rgba(255,255,255,0.1)' }
                },
                x: { 
                    ticks: { color: 'white' },
                    grid: { color: 'rgba(255,255,255,0.1)' }
                }
            }
        }
    });
}

function createMonthlyCorrectivesChart(correctivesData) {
    const ctx = document.getElementById('monthlyCorrectivesChart');
    if (!ctx) return;
    
    if (charts.correctives) charts.correctives.destroy();
    
    charts.correctives = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
            labels: meses,
            datasets: [{
                label: 'O.S Corretivas',
                data: correctivesData,
                borderColor: '#ef4444',
                backgroundColor: '#ef444420',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: 'white' } }
            },
            scales: {
                y: { 
                    beginAtZero: true,
                    ticks: { color: 'white' },
                    grid: { color: 'rgba(255,255,255,0.1)' }
                },
                x: { 
                    ticks: { color: 'white' },
                    grid: { color: 'rgba(255,255,255,0.1)' }
                }
            }
        }
    });
}

function createMonthlyStatusChart(statusData) {
    const ctx = document.getElementById('monthlyStatusChart');
    if (!ctx) return;
    
    if (charts.status) charts.status.destroy();
    
    const datasets = [];
    const colors = {
        'Não Iniciada': '#ef4444',
        'Requisitada': '#f59e0b', 
        'Iniciada': '#10b981',
        'Liberada': '#3b82f6',
        'Suspensa': '#8b5cf6'
    };
    
    Object.keys(statusData).forEach(status => {
        datasets.push({
            label: status,
            data: statusData[status],
            borderColor: colors[status] || '#6b7280',
            backgroundColor: (colors[status] || '#6b7280') + '20',
            fill: false,
            tension: 0.4
        });
    });
    
    charts.status = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
            labels: meses,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { 
                    labels: { color: 'white' },
                    position: 'top'
                }
            },
            scales: {
                y: { 
                    beginAtZero: true,
                    ticks: { color: 'white' },
                    grid: { color: 'rgba(255,255,255,0.1)' }
                },
                x: { 
                    ticks: { color: 'white' },
                    grid: { color: 'rgba(255,255,255,0.1)' }
                }
            }
        }
    });
}

function createMaintenanceTypeChart(data) {
    const ctx = document.getElementById("maintenanceTypeChart");
    if (!ctx) return;
    
    if (charts.maintenanceType) charts.maintenanceType.destroy();

    const labels = Object.keys(data);
    const values = Object.values(data);

    charts.maintenanceType = new Chart(ctx.getContext('2d'), {
        type: "doughnut",
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: [
                    "#00f6ff", "#10b981", "#f59e0b", "#ef4444", "#3b82f6",
                    "#8b5cf6", "#ec4899", "#f97316", "#6b7280", "#a855f7"
                ],
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: "white" } }
            }
        }
    });
}

function createCriticalityChart(data) {
    const ctx = document.getElementById("criticalityChart");
    if (!ctx) return;
    
    if (charts.criticality) charts.criticality.destroy();

    const labels = Object.keys(data).sort();
    const values = labels.map(key => data[key]);

    charts.criticality = new Chart(ctx.getContext('2d'), {
        type: "bar",
        data: {
            labels: labels,
            datasets: [{
                label: "Número de Ordens",
                data: values,
                backgroundColor: accentColor,
                borderColor: accentColor,
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: "white" } }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { color: "white" },
                    grid: { color: "rgba(255,255,255,0.1)" }
                },
                x: {
                    ticks: { color: "white" },
                    grid: { color: "rgba(255,255,255,0.1)" }
                }
            }
        }
    });
}

function createTopEquipmentChart(data) {
    const ctx = document.getElementById("topEquipmentChart");
    if (!ctx) return;
    
    if (charts.topEquipment) charts.topEquipment.destroy();

    const labels = data.map(item => item.equipment);
    const values = data.map(item => item.count);

    charts.topEquipment = new Chart(ctx.getContext('2d'), {
        type: "bar",
        data: {
            labels: labels,
            datasets: [{
                label: "Número de Ordens",
                data: values,
                backgroundColor: accentColor,
                borderColor: accentColor,
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: "y", // Makes it a horizontal bar chart
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: "white" } }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { color: "white" },
                    grid: { color: "rgba(255,255,255,0.1)" }
                },
                x: {
                    ticks: { color: "white" },
                    grid: { color: "rgba(255,255,255,0.1)" }
                }
            }
        }
    });
}

function createAnalystChart(data) {
    const ctx = document.getElementById("analystChart");
    if (!ctx) return;
    
    if (charts.analyst) charts.analyst.destroy();

    const labels = Object.keys(data);
    const values = Object.values(data);

    charts.analyst = new Chart(ctx.getContext('2d'), {
        type: "doughnut",
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: [
                    "#00f6ff", "#10b981", "#f59e0b", "#ef4444", "#3b82f6",
                    "#8b5cf6", "#ec4899", "#f97316", "#6b7280", "#a855f7"
                ],
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: "white" } }
            }
        }
    });
}

function loadEquipmentAnalysis() {
    if (!currentExcelData) return;
    
    try {
        // Análise por equipamento
        const equipmentStats = {};
        
        currentExcelData.forEach(row => {
            const equipment = row['Nome Equipamento'];
            if (!equipment) return;
            
            if (!equipmentStats[equipment]) {
                equipmentStats[equipment] = {
                    name: equipment,
                    total_orders: 0,
                    corrective: 0,
                    preventive: 0,
                    cost: 0
                };
            }
            
            equipmentStats[equipment].total_orders++;
            
            if (row['Tipo de Manutenção'] === 7) {
                equipmentStats[equipment].corrective++;
            } else if (row['Tipo de Manutenção'] === 10) {
                equipmentStats[equipment].preventive++;
            }
            
            const valorMaterial = parseFloat(String(row['Valor Material'] || '0').replace(',', '.').replace(/"/g, '')) || 0;
            const valorMaoObra = parseFloat(String(row['Valor Mão de Obra'] || '0').replace(',', '.').replace(/"/g, '')) || 0;
            equipmentStats[equipment].cost += valorMaterial + valorMaoObra;
        });
        
        // Converter para array e ordenar por custo
        const equipmentArray = Object.values(equipmentStats)
            .sort((a, b) => b.cost - a.cost)
            .slice(0, 10);
        
        const content = document.getElementById('equipment-analysis-content');
        if (content) {
            content.innerHTML = `
                <h3 class="text-white font-semibold mb-4">Top 10 Equipamentos por Custo</h3>
                <div class="overflow-x-auto">
                    <table class="w-full text-white">
                        <thead>
                            <tr class="border-b border-gray-600">
                                <th class="text-left p-2">Equipamento</th>
                                <th class="text-left p-2">Total O.S</th>
                                <th class="text-left p-2">Corretivas</th>
                                <th class="text-left p-2">Preventivas</th>
                                <th class="text-left p-2">Custo Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${equipmentArray.map(eq => `
                                <tr class="border-b border-gray-700">
                                    <td class="p-2 text-sm">${eq.name}</td>
                                    <td class="p-2">${eq.total_orders}</td>
                                    <td class="p-2 text-red-400">${eq.corrective}</td>
                                    <td class="p-2 text-green-400">${eq.preventive}</td>
                                    <td class="p-2">R$ ${eq.cost.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }
    } catch (error) {
        console.error('Erro ao carregar análise de equipamentos:', error);
    }
}

function loadPredictiveAnalysis() {
    if (!currentExcelData) return;

    try {
        // Análise de risco por equipamento
        const equipmentStats = {};

        currentExcelData.forEach(row => {
            const equipment = row['Nome Equipamento'];
            if (!equipment) return;

            if (!equipmentStats[equipment]) {
                equipmentStats[equipment] = {
                    name: equipment,
                    total_orders: 0,
                    corrective_count: 0,
                    cost: 0,
                    criticality_sum: 0,
                    criticality_count: 0
                };
            }

            equipmentStats[equipment].total_orders++;

            if (row['Tipo de Manutenção'] === 7) {
                equipmentStats[equipment].corrective_count++;
            }

            const valorMaterial = parseFloat(String(row['Valor Material'] || '0').replace(',', '.').replace(/"/g, '')) || 0;
            const valorMaoObra = parseFloat(String(row['Valor Mão de Obra'] || '0').replace(',', '.').replace(/"/g, '')) || 0;
            equipmentStats[equipment].cost += valorMaterial + valorMaoObra;

            const criticality = parseInt(row['Criticidade']);
            if (!isNaN(criticality)) {
                equipmentStats[equipment].criticality_sum += criticality;
                equipmentStats[equipment].criticality_count++;
            }
        });

        // Calcular médias e ratios
        const equipmentArray = Object.values(equipmentStats).map(eq => {
            return {
                ...eq,
                corrective_ratio: eq.total_orders > 0 ? (eq.corrective_count / eq.total_orders) * 100 : 0,
                avg_criticality: eq.criticality_count > 0 ? eq.criticality_sum / eq.criticality_count : 0
            };
        });

        // Normalizar os valores para uma escala de 0-100
        const maxCost = Math.max(...equipmentArray.map(eq => eq.cost));
        const maxCriticality = Math.max(...equipmentArray.map(eq => eq.avg_criticality));

        const normalizedArray = equipmentArray.map(eq => {
            const cost_normalized = maxCost > 0 ? (eq.cost / maxCost) * 100 : 0;
            const criticality_normalized = maxCriticality > 0 ? (eq.avg_criticality / maxCriticality) * 100 : 0;
            return {
                ...eq,
                cost_normalized,
                criticality_normalized
            };
        });

        // Calcular score de risco com pesos
        const weightedArray = normalizedArray.map(eq => {
            const risk_score = (0.5 * eq.corrective_ratio) + (0.3 * eq.cost_normalized) + (0.2 * eq.criticality_normalized);
            return {
                ...eq,
                risk_score
            };
        });

        // Ordenar por score de risco e pegar o top 10
        const riskArray = weightedArray.sort((a, b) => b.risk_score - a.risk_score).slice(0, 10);

        const content = document.getElementById('predictive-analysis-content');
        if (content) {
            content.innerHTML = `
                <h3 class="text-white font-semibold mb-4">Top 10 Equipamentos com Maior Risco</h3>
                <div class="overflow-x-auto">
                    <table class="w-full text-white">
                        <thead>
                            <tr class="border-b border-gray-600">
                                <th class="text-left p-2">Equipamento</th>
                                <th class="text-left p-2">Score de Risco</th>
                                <th class="text-left p-2">Taxa de Corretivas (%)</th>
                                <th class="text-left p-2">Custo Total</th>
                                <th class="text-left p-2">Criticidade Média</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${riskArray.map(eq => `
                                <tr class="border-b border-gray-700">
                                    <td class="p-2 text-sm">${eq.name}</td>
                                    <td class="p-2 font-bold text-red-400">${eq.risk_score.toFixed(2)}</td>
                                    <td class="p-2">${eq.corrective_ratio.toFixed(2)}%</td>
                                    <td class="p-2">R$ ${eq.cost.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                                    <td class="p-2">${eq.avg_criticality.toFixed(2)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }
    } catch (error) {
        console.error('Erro ao carregar análise preditiva:', error);
        const content = document.getElementById('predictive-analysis-content');
        if (content) {
            content.innerHTML = `<p class="text-red-500">Erro ao carregar a análise preditiva: ${error.message}</p>`;
        }
    }
}

function loadEditForm() {
    if (!dashboardData) {
        return;
    }
    
    // Carregar KPIs atuais nos campos de edição (se existirem)
    const fields = [
        'edit-preventivas', 'edit-preventivas-vencer', 'edit-preditivas',
        'edit-melhorias', 'edit-equipamentos', 'edit-os-total', 'edit-disponibilidade'
    ];
    
    fields.forEach(fieldId => {
        const element = document.getElementById(fieldId);
        if (element) {
            const key = fieldId.replace('edit-', '').replace('-', '');
            element.value = dashboardData.kpis[key] || 0;
        }
    });
    
    // Carregar dados mensais de custos
    for (let i = 0; i < 12; i++) {
        const custoEl = document.getElementById(`edit-custo-${i}`);
        const corretivaEl = document.getElementById(`edit-corretiva-${i}`);
        
        if (custoEl) custoEl.value = Math.round(dashboardData.monthly_costs[i] || 0);
        if (corretivaEl) corretivaEl.value = dashboardData.monthly_correctives[i] || 0;
    }
    
    // Carregar MTTR e MTBF
    const mttrEl = document.getElementById('edit-mttr');
    const mtbfEl = document.getElementById('edit-mtbf');
    
    if (mttrEl) mttrEl.value = dashboardData.mttr.join(', ');
    if (mtbfEl) mtbfEl.value = dashboardData.mtbf.join(', ');
}

function loadSettingsForm() {
    // Implementação básica para configurações
    console.log('Carregando formulário de configurações');
}

function saveEditedData() {
    console.log('Salvando dados editados');
    alert('Funcionalidade de edição em desenvolvimento');
}

function saveSettings() {
    console.log('Salvando configurações');
    alert('Funcionalidade de configurações em desenvolvimento');
}

function exportReport() {
    if (!dashboardData) {
        alert('Nenhum dado disponível para exportar');
        return;
    }
    
    try {
        const report = `
RELATÓRIO DE MANUTENÇÃO
========================

KPIs Principais:
- Manutenções Corretivas: ${dashboardData.kpis.corretivas}
- Manutenções Preventivas: ${dashboardData.kpis.preventivas}
- Preventivas Vencidas: ${dashboardData.kpis.preventivasVenc}
- Manutenções Preditivas: ${dashboardData.kpis.preditivas}
- Melhorias: ${dashboardData.kpis.melhorias}
- Total de Equipamentos: ${dashboardData.kpis.equipamentos}
- Total de O.S: ${dashboardData.kpis.osTotal}
- Disponibilidade: ${Math.round(dashboardData.kpis.availability)}%
- Custo Total: R$ ${dashboardData.kpis.custoTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}

Custos Mensais:
${meses.map((mes, i) => `${mes}: R$ ${dashboardData.monthly_costs[i].toLocaleString('pt-BR', {minimumFractionDigits: 2})}`).join('\n')}

Corretivas Mensais:
${meses.map((mes, i) => `${mes}: ${dashboardData.monthly_correctives[i]}`).join('\n')}

Gerado em: ${new Date().toLocaleString('pt-BR')}
        `;
        
        const blob = new Blob([report], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `relatorio_manutencao_${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
    } catch (error) {
        console.error('Erro ao exportar relatório:', error);
        alert('Erro ao exportar relatório: ' + error.message);
    }
}

