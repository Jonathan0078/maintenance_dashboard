// Configuração do Tailwind CSS
tailwind.config = {
    theme: {
        extend: {
            colors: {
                'kpi-main': '#30395e',
                'kpi-dark': '#262f4e',
                'kpi-accent': '#00f6ff',
                'success': '#10b981',
                'warning': '#f59e0b',
                'danger': '#ef4444'
            }
        }
    }
};

// Variáveis globais
let currentExcelData = null;
let dashboardData = null;
let charts = {};

// Constantes
const accentColor = '#00f6ff';
const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// Mapeamento de tipos de manutenção
const TIPO_MAPPING = {
    7: "Corretiva",
    10: "Preventiva",
    22: "Preditiva",
    12: "Melhoria",
    // Adicione outros mapeamentos conforme necessário
};

// Inicialização quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    setupEventListeners();
    updateDateTime();
    setInterval(updateDateTime, 1000);
    
    // Carregar dados do Firebase/localStorage na inicialização
    loadFromFirebase().then(() => {
        if (currentExcelData) {
            loadDashboardData();
        }
    });
    
    // Mostrar dashboard por padrão
    showView('dashboard');
}

function setupEventListeners() {
    // Botões de navegação
    document.getElementById('btn-dashboard').addEventListener('click', () => {
        showView('dashboard');
        if (currentExcelData) loadDashboardData();
    });
    
    document.getElementById('btn-upload').addEventListener('click', () => showView('upload'));
    document.getElementById('btn-analytics').addEventListener('click', () => {
        showView('analytics');
        loadEquipmentAnalysis();
    });
    
    document.getElementById('btn-predictive').addEventListener('click', () => {
        showView('predictive');
        loadPredictiveAnalysis();
    });
    
    document.getElementById('btn-edit').addEventListener('click', () => {
        showView('edit');
        loadEditForm();
    });
    
    document.getElementById('btn-settings').addEventListener('click', () => {
        showView('settings');
        loadSettingsForm();
    });
    
    document.getElementById('btn-export').addEventListener('click', exportReport);
    document.getElementById('btn-refresh').addEventListener('click', () => {
        if (currentExcelData) loadDashboardData();
    });
    
    // Upload de arquivo
    document.getElementById('btn-process-file').addEventListener('click', processFile);
    document.getElementById('excel-file-input').addEventListener('change', function() {
        const btn = document.getElementById('btn-process-file');
        btn.disabled = !this.files.length;
    });
}

function updateDateTime() {
    const now = new Date();
    const dateTimeString = now.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    document.getElementById('date-time-display').textContent = dateTimeString;
}

function showView(viewName) {
    // Esconder todas as views
    const views = ['dashboard-view', 'upload-view', 'analytics-view', 'predictive-view', 'edit-view', 'settings-view'];
    views.forEach(view => {
        document.getElementById(view).classList.add('hidden');
    });
    
    // Mostrar a view selecionada
    document.getElementById(viewName + '-view').classList.remove('hidden');
    
    // Atualizar botões ativos
    const buttons = ['btn-dashboard', 'btn-upload', 'btn-analytics', 'btn-predictive', 'btn-edit', 'btn-settings'];
    buttons.forEach(btn => {
        const element = document.getElementById(btn);
        element.classList.remove('text-kpi-accent', 'bg-gray-700/50');
        element.classList.add('text-gray-400');
    });
    
    // Ativar botão atual
    const activeBtn = document.getElementById('btn-' + viewName);
    if (activeBtn) {
        activeBtn.classList.remove('text-gray-400');
        activeBtn.classList.add('text-kpi-accent', 'bg-gray-700/50');
    }
}

function showLoading(show) {
    const indicator = document.getElementById('loading-indicator');
    if (show) {
        indicator.classList.remove('hidden');
    } else {
        indicator.classList.add('hidden');
    }
}

function processFile() {
    const fileInput = document.getElementById('excel-file-input');
    const file = fileInput.files[0];
    
    if (!file) {
        alert('Por favor, selecione um arquivo CSV.');
        return;
    }
    
    showLoading(true);
    document.getElementById('upload-status').textContent = 'Processando arquivo...';
    
    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        encoding: 'UTF-8',
        complete: function(results) {
            try {
                if (results.errors.length > 0) {
                    console.warn('Avisos durante o parsing:', results.errors);
                }
                
                currentExcelData = results.data;
                console.log('Dados carregados:', currentExcelData.length, 'registros');
                
                // Salvar no Firebase/localStorage
                saveToFirebase(currentExcelData, file.name);
                
                // Carregar dashboard
                loadDashboardData();
                
                document.getElementById('upload-status').textContent = 
                    `Arquivo processado com sucesso! ${currentExcelData.length} registros carregados.`;
                
                // Voltar para o dashboard
                setTimeout(() => {
                    showView('dashboard');
                }, 2000);
                
            } catch (error) {
                console.error('Erro ao processar arquivo:', error);
                document.getElementById('upload-status').textContent = 
                    'Erro ao processar arquivo: ' + error.message;
            } finally {
                showLoading(false);
            }
        },
        error: function(error) {
            console.error('Erro no Papa Parse:', error);
            document.getElementById('upload-status').textContent = 
                'Erro ao ler arquivo: ' + error.message;
            showLoading(false);
        }
    });
}

async function saveToFirebase(data, filename) {
    try {
        if (!window.firebase) {
            console.log('Firebase não configurado, salvando no localStorage');
            localStorage.setItem('maintenanceData', JSON.stringify(data));
            localStorage.setItem('maintenanceFilename', filename);
            return;
        }

        const { db, doc, setDoc } = window.firebase;
        
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
            const tipoNum = parseInt(tipo);
            if (!isNaN(tipoNum)) {
                tipoCounts[tipoNum] = (tipoCounts[tipoNum] || 0) + 1;
            }
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
        const preventivas = data.filter(row => parseInt(row['Tipo de Manutenção']) === 10);
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
            } else if (dataStr.includes('-')) {
                // Formato YYYY-MM-DD ou DD-MM-YYYY
                const parts = dataStr.split('-');
                if (parts.length === 3) {
                    if (parts[0].length === 4) {
                        // YYYY-MM-DD
                        dataManutencao = new Date(parts[0], parts[1] - 1, parts[2]);
                    } else {
                        // DD-MM-YYYY
                        dataManutencao = new Date(parts[2], parts[1] - 1, parts[0]);
                    }
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
            const valorMaterial = parseFloat(String(row['Valor Material'] || '0').replace(',', '.').replace(/[^\d.-]/g, '')) || 0;
            const valorMaoObra = parseFloat(String(row['Valor Mão de Obra'] || '0').replace(',', '.').replace(/[^\d.-]/g, '')) || 0;
            custoTotal += valorMaterial + valorMaoObra;
        });
        kpis.custoTotal = custoTotal;
    } catch (e) {
        console.log('Erro ao calcular custo total:', e);
        kpis.custoTotal = 0;
    }
    
    // Calcular disponibilidade (simulada baseada em corretivas)
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
            
            let dataManutencao = parseDate(dataStr);
            
            if (dataManutencao && !isNaN(dataManutencao.getTime())) {
                const month = dataManutencao.getMonth(); // 0-11
                
                // Custos
                const valorMaterial = parseFloat(String(row['Valor Material'] || '0').replace(',', '.').replace(/[^\d.-]/g, '')) || 0;
                const valorMaoObra = parseFloat(String(row['Valor Mão de Obra'] || '0').replace(',', '.').replace(/[^\d.-]/g, '')) || 0;
                costs[month] += valorMaterial + valorMaoObra;
                
                // Corretivas
                if (parseInt(row['Tipo de Manutenção']) === 7) {
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
    // Calcular MTTR real por trimestre baseado nos dados
    const quarterData = [[], [], [], []]; // Q1, Q2, Q3, Q4
    
    data.forEach(row => {
        const dataStr = row['Data Manutenção'];
        if (!dataStr) return;
        
        const date = parseDate(dataStr);
        if (date && !isNaN(date.getTime())) {
            const month = date.getMonth();
            const quarter = Math.floor(month / 3);
            
            // Simular tempo de reparo baseado no tipo de manutenção
            let repairTime = 4; // padrão
            const tipo = parseInt(row['Tipo de Manutenção']);
            if (tipo === 7) repairTime = 8; // Corretiva demora mais
            else if (tipo === 10) repairTime = 2; // Preventiva é mais rápida
            else if (tipo === 22) repairTime = 6; // Preditiva
            
            quarterData[quarter].push(repairTime);
        }
    });
    
    // Calcular média por trimestre
    const mttr = quarterData.map(quarter => {
        if (quarter.length === 0) return 4; // valor padrão
        return quarter.reduce((sum, time) => sum + time, 0) / quarter.length;
    });
    
    // Garantir que temos 4 trimestres
    while (mttr.length < 4) {
        mttr.push(4);
    }
    
    // MTBF mensal baseado na frequência de falhas
    const mtbf = Array(12).fill(0).map((_, i) => {
        const monthData = data.filter(row => {
            const date = parseDate(row['Data Manutenção']);
            return date && !isNaN(date.getTime()) && date.getMonth() === i;
        });
        
        // Mais ordens = menor MTBF
        const baseValue = 1000;
        const reduction = monthData.length * 20;
        return Math.max(100, baseValue - reduction);
    });
    
    return { mttr: mttr.slice(0, 3), mtbf }; // Retornar apenas 3 trimestres para MTTR
}

function calculateAdditionalChartsData(data) {
    const maintenanceTypeCounts = {};
    const criticalityCounts = {};
    const analystCounts = {};
    const equipmentCounts = {};

    data.forEach(row => {
        // Tipo de Manutenção
        const tipoNum = parseInt(row["Tipo de Manutenção"]);
        const tipoDesc = TIPO_MAPPING[tipoNum] || "Outros";
        maintenanceTypeCounts[tipoDesc] = (maintenanceTypeCounts[tipoDesc] || 0) + 1;

        // Criticidade
        const crit = row["Criticidade"];
        if (crit) {
            criticalityCounts[crit] = (criticalityCounts[crit] || 0) + 1;
        }

        // Analista
        const analyst = row["Nome do Analista"];
        if (analyst) {
            analystCounts[analyst] = (analystCounts[analyst] || 0) + 1;
        }

        // Equipamento
        const equipment = row["Nome Equipamento"] || row["Equipamento"];
        if (equipment) {
            equipmentCounts[equipment] = (equipmentCounts[equipment] || 0) + 1;
        }
    });

    // Top 5 Equipamentos
    const topEquipment = Object.entries(equipmentCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5);

    return {
        maintenanceType: maintenanceTypeCounts,
        criticality: criticalityCounts,
        analyst: analystCounts,
        topEquipment: Object.fromEntries(topEquipment)
    };
}

function parseDate(dateStr) {
    if (!dateStr) return null;
    
    // Tentar diferentes formatos
    if (dateStr.includes('/')) {
        const parts = dateStr.split('/');
        if (parts.length === 3) {
            // Assumir formato DD/MM/YYYY
            return new Date(parts[2], parts[1] - 1, parts[0]);
        }
    } else if (dateStr.includes('-')) {
        const parts = dateStr.split('-');
        if (parts.length === 3) {
            if (parts[0].length === 4) {
                // YYYY-MM-DD
                return new Date(parts[0], parts[1] - 1, parts[2]);
            } else {
                // DD-MM-YYYY
                return new Date(parts[2], parts[1] - 1, parts[0]);
            }
        }
    }
    
    // Tentar parsing direto
    return new Date(dateStr);
}

function updateKPIs(kpis) {
    if (!kpis) return;
    
    document.getElementById('kpi-corretivas').textContent = kpis.corretivas || 0;
    document.getElementById('kpi-preventivas').textContent = kpis.preventivas || 0;
    document.getElementById('kpi-preventivas-venc').textContent = kpis.preventivasVenc || 0;
    document.getElementById('kpi-preditivas').textContent = kpis.preditivas || 0;
    document.getElementById('kpi-melhorias').textContent = kpis.melhorias || 0;
    document.getElementById('kpi-equipamentos').textContent = kpis.equipamentos || 0;
    document.getElementById('kpi-os-total').textContent = kpis.osTotal || 0;
    document.getElementById('kpi-availability').textContent = `${(kpis.availability || 0).toFixed(1)}%`;
    document.getElementById('kpi-custo-total').textContent = `R$ ${(kpis.custoTotal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function createOrUpdateChart(chartId, config) {
    const ctx = document.getElementById(chartId);
    if (!ctx) {
        console.error(`Elemento canvas com id ${chartId} não encontrado.`);
        return;
    }
    
    if (charts[chartId]) {
        charts[chartId].destroy();
    }
    
    try {
        charts[chartId] = new Chart(ctx, config);
    } catch (error) {
        console.error(`Erro ao criar gráfico ${chartId}:`, error);
    }
}

function createAllCharts(data) {
    if (!data) return;

    // Configurações padrão dos gráficos
    const defaultOptions = {
        maintainAspectRatio: false,
        responsive: true,
        plugins: {
            legend: {
                labels: {
                    color: '#cbd5e1'
                }
            }
        },
        scales: {
            x: {
                ticks: {
                    color: '#cbd5e1'
                },
                grid: {
                    color: 'rgba(203, 213, 225, 0.1)'
                }
            },
            y: {
                ticks: {
                    color: '#cbd5e1'
                },
                grid: {
                    color: 'rgba(203, 213, 225, 0.1)'
                }
            }
        }
    };

    // Gráfico MTTR
    createOrUpdateChart('mttrChart', {
        type: 'bar',
        data: {
            labels: ['Q1', 'Q2', 'Q3'],
            datasets: [{
                label: 'MTTR (horas)',
                data: data.mttr,
                backgroundColor: accentColor,
                borderColor: accentColor,
                borderWidth: 1
            }]
        },
        options: defaultOptions
    });

    // Gráfico MTBF
    createOrUpdateChart('mtbfChart', {
        type: 'line',
        data: {
            labels: meses,
            datasets: [{
                label: 'MTBF (horas)',
                data: data.mtbf,
                backgroundColor: 'rgba(0, 246, 255, 0.2)',
                borderColor: accentColor,
                tension: 0.4,
                fill: true
            }]
        },
        options: defaultOptions
    });

    // Gráfico de Custos Mensais
    createOrUpdateChart('monthlyCostsChart', {
        type: 'bar',
        data: {
            labels: meses,
            datasets: [{
                label: 'Custos (R$)',
                data: data.monthly_costs,
                backgroundColor: '#10b981',
                borderColor: '#10b981',
                borderWidth: 1
            }]
        },
        options: {
            ...defaultOptions,
            scales: {
                ...defaultOptions.scales,
                y: {
                    ...defaultOptions.scales.y,
                    ticks: {
                        ...defaultOptions.scales.y.ticks,
                        callback: function(value) {
                            return 'R$ ' + value.toLocaleString('pt-BR');
                        }
                    }
                }
            }
        }
    });

    // Gráfico de Corretivas Mensais
    createOrUpdateChart('monthlyCorrectivesChart', {
        type: 'line',
        data: {
            labels: meses,
            datasets: [{
                label: 'O.S Corretivas',
                data: data.monthly_correctives,
                backgroundColor: 'rgba(239, 68, 68, 0.2)',
                borderColor: '#ef4444',
                tension: 0.4,
                fill: true
            }]
        },
        options: defaultOptions
    });

    // Gráfico de Status Mensal
    const statusColors = {
        'Não Iniciada': '#ef4444',
        'Requisitada': '#f59e0b',
        'Iniciada': '#10b981',
        'Liberada': '#3b82f6',
        'Suspensa': '#a855f7'
    };
    
    createOrUpdateChart('monthlyStatusChart', {
        type: 'line',
        data: {
            labels: meses,
            datasets: Object.keys(data.monthly_status).map(status => ({
                label: status,
                data: data.monthly_status[status],
                borderColor: statusColors[status],
                backgroundColor: statusColors[status] + '20',
                tension: 0.4,
                fill: false
            }))
        },
        options: defaultOptions
    });

    // Gráfico de Tipo de Manutenção
    const maintenanceTypeData = data.additionalData.maintenanceType;
    if (Object.keys(maintenanceTypeData).length > 0) {
        createOrUpdateChart('maintenanceTypeChart', {
            type: 'doughnut',
            data: {
                labels: Object.keys(maintenanceTypeData),
                datasets: [{
                    data: Object.values(maintenanceTypeData),
                    backgroundColor: ['#00f6ff', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#a855f7'],
                }]
            },
            options: {
                maintainAspectRatio: false,
                responsive: true,
                plugins: {
                    legend: {
                        labels: {
                            color: '#cbd5e1'
                        }
                    }
                }
            }
        });
    }

    // Gráfico de Criticidade
    const criticalityData = data.additionalData.criticality;
    if (Object.keys(criticalityData).length > 0) {
        createOrUpdateChart('criticalityChart', {
            type: 'bar',
            data: {
                labels: Object.keys(criticalityData),
                datasets: [{
                    label: 'Número de Ordens',
                    data: Object.values(criticalityData),
                    backgroundColor: accentColor,
                }]
            },
            options: defaultOptions
        });
    }

    // Gráfico Top 5 Equipamentos
    const topEquipmentData = data.additionalData.topEquipment;
    if (Object.keys(topEquipmentData).length > 0) {
        createOrUpdateChart('topEquipmentChart', {
            type: 'bar',
            data: {
                labels: Object.keys(topEquipmentData),
                datasets: [{
                    label: 'Número de Ordens',
                    data: Object.values(topEquipmentData),
                    backgroundColor: accentColor,
                }]
            },
            options: {
                ...defaultOptions,
                indexAxis: 'y'
            }
        });
    }

    // Gráfico por Analista
    const analystData = data.additionalData.analyst;
    if (Object.keys(analystData).length > 0) {
        createOrUpdateChart('analystChart', {
            type: 'doughnut',
            data: {
                labels: Object.keys(analystData),
                datasets: [{
                    data: Object.values(analystData),
                    backgroundColor: ['#00f6ff', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#a855f7'],
                }]
            },
            options: {
                maintainAspectRatio: false,
                responsive: true,
                plugins: {
                    legend: {
                        labels: {
                            color: '#cbd5e1'
                        }
                    }
                }
            }
        });
    }
}

function loadEquipmentAnalysis() {
    const contentDiv = document.getElementById('equipment-analysis-content');
    if (!contentDiv || !currentExcelData) {
        if (contentDiv) {
            contentDiv.innerHTML = '<p class="text-gray-400">Carregue um arquivo CSV para ver a análise de equipamentos.</p>';
        }
        return;
    }

    const equipmentCosts = {};
    currentExcelData.forEach(row => {
        const equipment = row["Nome Equipamento"] || row["Equipamento"];
        if (!equipment) return;

        if (!equipmentCosts[equipment]) {
            equipmentCosts[equipment] = {
                totalCost: 0,
                totalOS: 0,
                corrective: 0,
                preventive: 0
            };
        }

        const materialCost = parseFloat(String(row['Valor Material'] || '0').replace(',', '.').replace(/[^\d.-]/g, '')) || 0;
        const laborCost = parseFloat(String(row['Valor Mão de Obra'] || '0').replace(',', '.').replace(/[^\d.-]/g, '')) || 0;
        equipmentCosts[equipment].totalCost += materialCost + laborCost;
        equipmentCosts[equipment].totalOS++;

        const tipo = parseInt(row["Tipo de Manutenção"]);
        if (tipo === 7) {
            equipmentCosts[equipment].corrective++;
        } else if (tipo === 10) {
            equipmentCosts[equipment].preventive++;
        }
    });

    const sortedEquipment = Object.entries(equipmentCosts)
        .sort(([, a], [, b]) => b.totalCost - a.totalCost)
        .slice(0, 10);

    let tableHtml = `
        <h3 class="text-lg text-white font-semibold mb-4">Top 10 Equipamentos por Custo</h3>
        <div class="overflow-x-auto">
            <table class="min-w-full bg-kpi-dark text-white">
                <thead>
                    <tr class="bg-gray-700/50">
                        <th class="py-2 px-4 text-left">Equipamento</th>
                        <th class="py-2 px-4 text-left">Total O.S</th>
                        <th class="py-2 px-4 text-left">Corretivas</th>
                        <th class="py-2 px-4 text-left">Preventivas</th>
                        <th class="py-2 px-4 text-left">Custo Total</th>
                    </tr>
                </thead>
                <tbody>
    `;

    sortedEquipment.forEach(([name, data]) => {
        tableHtml += `
            <tr class="border-b border-gray-700">
                <td class="py-2 px-4">${name}</td>
                <td class="py-2 px-4">${data.totalOS}</td>
                <td class="py-2 px-4 text-danger">${data.corrective}</td>
                <td class="py-2 px-4 text-success">${data.preventive}</td>
                <td class="py-2 px-4">R$ ${data.totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            </tr>
        `;
    });

    tableHtml += `
                </tbody>
            </table>
        </div>
    `;

    contentDiv.innerHTML = tableHtml;
}

function loadPredictiveAnalysis() {
    const contentDiv = document.getElementById('predictive-analysis-content');
    if (!contentDiv || !currentExcelData) {
        if (contentDiv) {
            contentDiv.innerHTML = '<p class="text-gray-400">Carregue um arquivo CSV para ver a análise preditiva.</p>';
        }
        return;
    }

    const equipmentRisk = {};
    currentExcelData.forEach(row => {
        const equipment = row["Nome Equipamento"] || row["Equipamento"];
        if (!equipment) return;

        if (!equipmentRisk[equipment]) {
            equipmentRisk[equipment] = { total: 0, corrective: 0 };
        }
        equipmentRisk[equipment].total++;
        
        const tipo = parseInt(row["Tipo de Manutenção"]);
        if (tipo === 7) {
            equipmentRisk[equipment].corrective++;
        }
    });

    const highRiskEquipment = Object.entries(equipmentRisk)
        .map(([name, data]) => ({ 
            name, 
            score: data.total > 0 ? (data.corrective / data.total) * 100 : 0, 
            details: `${data.corrective} corretivas de ${data.total} total` 
        }))
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

    if (highRiskEquipment.length === 0) {
        contentDiv.innerHTML = '<p class="text-gray-400">Nenhum equipamento com risco de falha identificado (sem ordens corretivas).</p>';
        return;
    }

    let cardsHtml = '<h3 class="text-lg text-white font-semibold mb-4">Equipamentos com Maior Risco</h3><div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">';

    highRiskEquipment.forEach(item => {
        cardsHtml += `
            <div class="bg-kpi-dark rounded-lg p-4 border border-danger">
                <h4 class="font-bold text-white">${item.name}</h4>
                <p class="text-sm text-gray-400">Score de Risco:</p>
                <div class="w-full bg-gray-700 rounded-full h-2.5 my-2">
                    <div class="bg-danger h-2.5 rounded-full" style="width: ${Math.min(100, item.score)}%"></div>
                </div>
                <p class="text-right font-bold text-danger">${item.score.toFixed(1)}%</p>
                <p class="text-xs text-gray-500 mt-1">${item.details}</p>
            </div>
        `;
    });

    cardsHtml += '</div>';
    contentDiv.innerHTML = cardsHtml;
}

function exportReport() {
    if (!dashboardData) {
        alert('Não há dados para exportar. Carregue um arquivo primeiro.');
        return;
    }

    let report = 'RELATÓRIO DE MANUTENÇÃO\n';
    report += '=====================================\n\n';
    report += `Data do Relatório: ${new Date().toLocaleString('pt-BR')}\n\n`;

    report += '### KPIs PRINCIPAIS ###\n';
    report += `Corretivas: ${dashboardData.kpis.corretivas}\n`;
    report += `Preventivas: ${dashboardData.kpis.preventivas}\n`;
    report += `Preventivas Vencidas: ${dashboardData.kpis.preventivasVenc}\n`;
    report += `Preditivas: ${dashboardData.kpis.preditivas}\n`;
    report += `Melhorias: ${dashboardData.kpis.melhorias}\n`;
    report += `Total de Equipamentos: ${dashboardData.kpis.equipamentos}\n`;
    report += `Total de O.S: ${dashboardData.kpis.osTotal}\n`;
    report += `Disponibilidade: ${dashboardData.kpis.availability.toFixed(2)}%\n`;
    report += `Custo Total: R$ ${dashboardData.kpis.custoTotal.toLocaleString('pt-BR')}\n\n`;

    report += '### CUSTOS MENSAIS ###\n';
    meses.forEach((mes, i) => {
        report += `${mes}: R$ ${dashboardData.monthly_costs[i].toLocaleString('pt-BR')}\n`;
    });

    report += '\n### CORRETIVAS MENSAIS ###\n';
    meses.forEach((mes, i) => {
        report += `${mes}: ${dashboardData.monthly_correctives[i]} ordens\n`;
    });

    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio_manutencao_${new Date().toISOString().split('T')[0]}.txt`;
    link.click();
}

// Funções de edição e configurações (placeholders)
function loadEditForm() {
    const contentDiv = document.getElementById('edit-content');
    if (contentDiv) {
        contentDiv.innerHTML = '<p class="text-gray-400">Funcionalidade de edição em desenvolvimento.</p>';
    }
}

function loadSettingsForm() {
    const contentDiv = document.getElementById('settings-content');
    if (contentDiv) {
        contentDiv.innerHTML = '<p class="text-gray-400">Funcionalidade de configurações em desenvolvimento.</p>';
    }
}

function saveEditedData() {
    alert('Dados salvos (simulação).');
}

function saveSettings() {
    alert('Configurações salvas (simulação).');
}

