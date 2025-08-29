// Variáveis globais
let charts = {};
let dashboardData = null;
let currentExcelData = null;
let filteredData = null;
const accentColor = '#00f6ff';
const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const mesesCompletos = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

// Configurações globais do Chart.js para impressão
Chart.register(ChartDataLabels);
Chart.defaults.font.size = 12;
Chart.defaults.color = '#000000';
Chart.defaults.plugins.title.font.size = 16;
Chart.defaults.plugins.title.color = '#000000';

// Filtros globais
let selectedYear = '';
let selectedMonth = '';

async function saveChartsAsPDF() {
    showLoading(true);
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
    });

    const chartInfo = [
        { id: 'mttrChart', title: 'Tempo Médio de Reparo (MTTR)' },
        { id: 'mtbfChart', title: 'Tempo Médio Entre Falhas (MTBF)' },
        { id: 'monthlyCostsChart', title: 'Custos Mensais de Manutenção' },
        { id: 'monthlyCorrectivesChart', title: 'Manutenções Corretivas Mensais' },
        { id: 'monthlyStatusChart', title: 'Status das Ordens de Manutenção' },
        { id: 'maintenanceTypeChart', title: 'Distribuição por Tipo de Manutenção' },
        { id: 'criticalityChart', title: 'Distribuição por Criticidade' },
        { id: 'topEquipmentChart', title: 'Top 5 Equipamentos com Mais Ordens' },
        { id: 'analystChart', title: 'Ordens por Analista' }
    ];

    const filterText = (selectedYear || selectedMonth) 
        ? `Filtro: ${selectedYear ? 'Ano ' + selectedYear : ''} ${selectedMonth !== '' ? 'Mês ' + mesesCompletos[selectedMonth] : ''}`
        : 'Filtro: Todos os dados';

    for (let i = 0; i < chartInfo.length; i++) {
        const { id, title } = chartInfo[i];
        const chartElement = document.getElementById(id);
        
        if (chartElement) {
            const chartContainer = chartElement.closest('.bg-kpi-dark');
            if (i > 0) pdf.addPage();

            try {
                const canvas = await html2canvas(chartContainer, {
                    scale: 3,
                    backgroundColor: '#262f4e',
                    useCORS: true,
                    onclone: (doc) => {
                        const clonedCanvas = doc.getElementById(id);
                        clonedCanvas.style.backgroundColor = 'transparent';
                    }
                });

                const imgData = canvas.toDataURL('image/png');
                const pageWidth = pdf.internal.pageSize.getWidth();
                const pageHeight = pdf.internal.pageSize.getHeight();
                const margin = 10;
                
                const contentWidth = pageWidth - (2 * margin);
                const contentHeight = pageHeight - (2 * margin) - 20; // Extra space for text

                const imgWidth = canvas.width;
                const imgHeight = canvas.height;
                const ratio = Math.min(contentWidth / imgWidth, contentHeight / imgHeight);
                
                const finalWidth = imgWidth * ratio;
                const finalHeight = imgHeight * ratio;

                const x = (pageWidth - finalWidth) / 2;
                let y = margin;

                // Add filter text
                pdf.setFontSize(10);
                pdf.setTextColor(100, 100, 100);
                pdf.text(filterText, margin, y);
                y += 10;

                // Add chart image
                pdf.addImage(imgData, 'PNG', x, y, finalWidth, finalHeight);
                y += finalHeight + 5;

                // Add extra info
                pdf.setFontSize(12);
                pdf.setTextColor(0, 0, 0);
                let extraInfo = '';
                if (dashboardData) {
                    switch (id) {
                        case 'monthlyCostsChart':
                            const totalCost = dashboardData.monthly_costs.reduce((a, b) => a + b, 0);
                            const avgCost = totalCost / 12;
                            extraInfo = `Custo Total: R$ ${totalCost.toLocaleString('pt-BR', {minimumFractionDigits: 2})} | Média Mensal: R$ ${avgCost.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
                            break;
                        case 'monthlyCorrectivesChart':
                            const totalCorrectives = dashboardData.monthly_correctives.reduce((a, b) => a + b, 0);
                            const avgCorrectives = totalCorrectives / 12;
                            extraInfo = `Total de Corretivas: ${totalCorrectives} | Média Mensal: ${avgCorrectives.toFixed(1)}`;
                            break;
                        case 'mttrChart':
                            const avgMttr = dashboardData.mttr.reduce((a, b) => a + b, 0) / dashboardData.mttr.length;
                            extraInfo = `Média Geral MTTR: ${avgMttr.toFixed(1)} horas`;
                            break;
                        case 'mtbfChart':
                             const avgMtbf = dashboardData.mtbf.reduce((a, b) => a + b, 0) / dashboardData.mtbf.length;
                            extraInfo = `Média Geral MTBF: ${avgMtbf.toFixed(1)} horas`;
                            break;
                        case 'maintenanceTypeChart':
                            const totalMaint = Object.values(dashboardData.additionalData.maintenanceTypeCounts).reduce((a, b) => a + b, 0);
                            extraInfo = `Total de Ordens: ${totalMaint}`;
                            break;
                        case 'criticalityChart':
                            const totalCrit = Object.values(dashboardData.additionalData.criticalityCounts).reduce((a, b) => a + b, 0);
                            extraInfo = `Total de Ordens: ${totalCrit}`;
                            break;
                        case 'analystChart':
                            const totalAnalyst = Object.values(dashboardData.additionalData.analystCounts).reduce((a, b) => a + b, 0);
                            extraInfo = `Total de Ordens: ${totalAnalyst}`;
                            break;
                    }
                }
                
                if(extraInfo) {
                    pdf.text(extraInfo, margin, y);
                }


            } catch (error) {
                console.error(`Erro ao gerar o canvas para o gráfico ${id}:`, error);
            }
        }
    }

    pdf.save('dashboard-relatorio-de-manutencao.pdf');
    showLoading(false);
}

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
    initializeDashboard();
    setupEventListeners();
    updateDateTime();
    setInterval(updateDateTime, 1000);
});

function setupEventListeners() {
    document.getElementById('btn-refresh').addEventListener('click', loadDashboardData);
    document.getElementById('btn-save-pdf').addEventListener('click', saveChartsAsPDF);
    document.getElementById('btn-dashboard').addEventListener('click', () => showView('dashboard'));
    document.getElementById('btn-upload').addEventListener('click', () => showView('upload'));
    document.getElementById('btn-analytics').addEventListener('click', () => showView('analytics'));
    document.getElementById('btn-predictive').addEventListener('click', () => showView('predictive'));
    document.getElementById('btn-edit').addEventListener('click', () => showView('edit'));
    document.getElementById('btn-settings').addEventListener('click', () => showView('settings'));
    document.getElementById('btn-export').addEventListener('click', exportReport);
    document.getElementById('btn-process-file').addEventListener('click', processExcelFile);
    document.getElementById('excel-file-input').addEventListener('change', handleFileSelect);

    // Filtros
    document.getElementById('filter-year').addEventListener('change', handleFilterChange);
    document.getElementById('filter-month').addEventListener('change', handleFilterChange);

    // Botões de edição de gráfico
    document.getElementById('btn-edit-mttr').addEventListener('click', openMTTRModal);
    document.getElementById('btn-edit-mtbf').addEventListener('click', openMTBFModal);
    document.getElementById('btn-edit-monthlyCosts').addEventListener('click', openMonthlyCostsModal);
    document.getElementById('btn-edit-monthlyCorrectives').addEventListener('click', () => alert('Função de edição para este gráfico ainda não implementada.'));
    document.getElementById('btn-edit-monthlyStatus').addEventListener('click', () => alert('Função de edição para este gráfico ainda não implementada.'));
    document.getElementById('btn-edit-maintenanceType').addEventListener('click', () => alert('Função de edição para este gráfico ainda não implementada.'));
    document.getElementById('btn-edit-criticality').addEventListener('click', () => alert('Função de edição para este gráfico ainda não implementada.'));
    document.getElementById('btn-edit-topEquipment').addEventListener('click', () => alert('Função de edição para este gráfico ainda não implementada.'));
    document.getElementById('btn-edit-analyst').addEventListener('click', () => alert('Função de edição para este gráfico ainda não implementada.'));
    
    // Preencher anos disponíveis
    populateYearFilter();
    
    const btnSaveEdit = document.getElementById('btn-save-edit');
    if (btnSaveEdit) btnSaveEdit.addEventListener('click', saveEditedData);
    
    const btnCancelEdit = document.getElementById('btn-cancel-edit');
    if (btnCancelEdit) btnCancelEdit.addEventListener('click', () => showView('dashboard'));
}

function showView(viewName) {
    // Esconder todas as views
    const views = ['dashboard', 'upload', 'analytics', 'predictive', 'edit', 'settings'];
    views.forEach(view => {
        const element = document.getElementById(view + '-view');
        if (element) element.classList.add('hidden');
    });

    // Mostrar/esconder filtros do dashboard
    const dashboardFilters = document.getElementById('dashboard-filters');
    if (dashboardFilters) {
        if (viewName === 'dashboard' || viewName === 'analytics') {
            dashboardFilters.classList.remove('hidden');
        } else {
            dashboardFilters.classList.add('hidden');
        }
    }

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
    await loadFromLocalStorage();
    if (!currentExcelData) {
        showView('upload');
    } else {
        showView('dashboard');
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
        statusEl.innerHTML = 'Selecione um arquivo Excel (.xlsx, .xls) ou CSV (.csv) para começar a análise.';
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
                    complete: results => resolve(results.data),
                    error: err => reject(err)
                });
            });
        } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
            const reader = new FileReader();
            jsonData = await new Promise((resolve, reject) => {
                reader.onload = e => {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                    resolve(XLSX.utils.sheet_to_json(firstSheet));
                };
                reader.onerror = () => reject(reader.error);
                reader.readAsArrayBuffer(file);
            });
        } else {
            throw new Error("Formato de arquivo não suportado. Use .csv, .xlsx ou .xls");
        }
        
        if (jsonData.length === 0) throw new Error("Arquivo está vazio.");

        currentExcelData = jsonData;
        await saveToLocalStorage(jsonData, file.name);
        populateYearFilter();
        statusEl.innerHTML = `<span class="text-green-500">✓ Arquivo processado com sucesso! ${jsonData.length} registros carregados.</span>`;
        await loadDashboardData();
        showView('dashboard');
        
    } catch (error) {
        console.error('Erro ao processar arquivo:', error);
        statusEl.innerHTML = `<span class="text-red-500">✗ Erro: ${error.message}</span>`;
    } finally {
        showLoading(false);
    }
}

async function saveToLocalStorage(data, filename) {
    localStorage.setItem('maintenanceData', JSON.stringify(data));
    localStorage.setItem('maintenanceFilename', filename);
}

async function loadFromLocalStorage() {
    const data = localStorage.getItem('maintenanceData');
    if (data) {
        currentExcelData = JSON.parse(data);
    }
}

function populateYearFilter() {
    if (!currentExcelData || currentExcelData.length === 0) return;

    const yearSelect = document.getElementById('filter-year');
    if (!yearSelect) return;

    yearSelect.innerHTML = '<option value="">Todos os Anos</option>';

    const years = new Set();
    currentExcelData.forEach(row => {
        if (row['Data Manutenção']) {
            const dataStr = String(row['Data Manutenção']);
            if (dataStr.includes('/')) {
                const year = dataStr.split('/')[2];
                if (year) years.add(year);
            }
        }
    });

    Array.from(years).sort().forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        yearSelect.appendChild(option);
    });
}

function handleFilterChange() {
    selectedYear = document.getElementById('filter-year').value;
    selectedMonth = document.getElementById('filter-month').value;
    filteredData = filterData();
    if (!document.getElementById('dashboard-view').classList.contains('hidden')) {
        loadDashboardData();
    } else if (!document.getElementById('analytics-view').classList.contains('hidden')) {
        loadEquipmentAnalysis();
    }
}

function filterData() {
    if (!currentExcelData) return [];
    
    return currentExcelData.filter(row => {
        if (!row['Data Manutenção']) return false;

        const dataStr = String(row['Data Manutenção']);
        if (!dataStr.includes('/')) return false;

        const [dia, mes, ano] = dataStr.split('/');
        
        if (selectedYear && ano !== selectedYear) return false;
        if (selectedMonth !== '' && (parseInt(mes) - 1) !== parseInt(selectedMonth)) return false;
        
        return true;
    });
}

async function loadDashboardData() {
    if (!currentExcelData) return;

    showLoading(true);
    try {
        const dataToUse = (selectedYear || selectedMonth !== '') ? filterData() : currentExcelData;
        
        const kpis = calculateKPIs(dataToUse);
        const monthlyData = calculateMonthlyData(dataToUse);
        const mttrMtbf = calculateMTTRMTBF(dataToUse);
        const additionalData = calculateAdditionalChartsData(dataToUse);
        
        dashboardData = {
            kpis,
            monthly_costs: monthlyData.costs,
            monthly_correctives: monthlyData.correctives,
            monthly_status: monthlyData.statusByMonth,
            mttr: mttrMtbf.mttr,
            mtbf: mttrMtbf.mtbf,
            additionalData
        };
        
        updateKPIs(dashboardData.kpis);
        createAllCharts(dashboardData);
        
    } catch (error) {
        console.error('Erro:', error);
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
    
    const tipoCounts = data.reduce((acc, row) => {
        const tipo = row['Tipo de Manutenção'];
        if (tipo !== undefined) acc[tipo] = (acc[tipo] || 0) + 1;
        return acc;
    }, {});
    
    const kpis = {
        corretivas: tipoCounts[7] || 0,
        preventivas: tipoCounts[10] || 0,
        preditivas: tipoCounts[22] || 0,
        melhorias: tipoCounts[12] || 0,
        equipamentos: new Set(data.map(row => row['Equipamento']).filter(Boolean)).size,
        osTotal: data.length,
        preventivasVenc: data.filter(row => row['Tipo de Manutenção'] === 10 && new Date(row['Data Manutenção']) < new Date()).length,
        custoTotal: data.reduce((acc, row) => {
            const mat = parseFloat(String(row['Valor Material'] || '0').replace(',', '.')) || 0;
            const mo = parseFloat(String(row['Valor Mão de Obra'] || '0').replace(',', '.')) || 0;
            return acc + mat + mo;
        }, 0),
        availability: Math.max(85, 99 - (tipoCounts[7] || 0) * 0.5)
    };
    
    return kpis;
}

function calculateMonthlyData(data) {
    const costs = Array(12).fill(0);
    const correctives = Array(12).fill(0);
    const statusByMonth = { 'Não Iniciada': Array(12).fill(0), 'Requisitada': Array(12).fill(0), 'Iniciada': Array(12).fill(0), 'Liberada': Array(12).fill(0), 'Suspensa': Array(12).fill(0) };
    
    if (!data || data.length === 0) return { costs, correctives, statusByMonth };
    
    data.forEach(row => {
        const dataStr = String(row['Data Manutenção']);
        if (dataStr && dataStr.includes('/')) {
            const parts = dataStr.split('/');
            if (parts.length === 3) {
                const month = parseInt(parts[1]) - 1;
                if (month >= 0 && month < 12) {
                    const mat = parseFloat(String(row['Valor Material'] || '0').replace(',', '.')) || 0;
                    const mo = parseFloat(String(row['Valor Mão de Obra'] || '0').replace(',', '.')) || 0;
                    costs[month] += mat + mo;
                    if (row['Tipo de Manutenção'] === 7) correctives[month]++;
                    const estado = row['Estado'] || 'Não Iniciada';
                    if (statusByMonth[estado]) statusByMonth[estado][month]++;
                }
            }
        }
    });
    
    return { costs, correctives, statusByMonth };
}

function calculateMTTRMTBF(data) {
    const mttr = [8, 6, 4]; // Dados simulados
    const mtbf = Array(12).fill(0).map((_, i) => 1000 - data.filter(r => new Date(r['Data Manutenção']).getMonth() === i).length * 10);
    return { mttr, mtbf };
}

function calculateAdditionalChartsData(data) {
    const maintenanceTypeCounts = {};
    const criticalityCounts = {};
    const analystCounts = {};
    const equipmentCounts = {};

    data.forEach(row => {
        const tipoDesc = TIPO_MAPPING[row["Tipo de Manutenção"]] || "Outros";
        maintenanceTypeCounts[tipoDesc] = (maintenanceTypeCounts[tipoDesc] || 0) + 1;
        if (row["Criticidade"]) criticalityCounts[row["Criticidade"]] = (criticalityCounts[row["Criticidade"]] || 0) + 1;
        if (row["Nome do Analista"]) analystCounts[row["Nome do Analista"]] = (analystCounts[row["Nome do Analista"]] || 0) + 1;
        if (row["Nome Equipamento"]) equipmentCounts[row["Nome Equipamento"]] = (equipmentCounts[row["Nome Equipamento"]] || 0) + 1;
    });

    const topEquipment = Object.entries(equipmentCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([equipment, count]) => ({ equipment, count }));

    return { maintenanceTypeCounts, criticalityCounts, analystCounts, topEquipment };
}

function updateKPIs(kpis) {
    document.getElementById('kpi-corretivas').textContent = kpis.corretivas;
    document.getElementById('kpi-preventivas').textContent = kpis.preventivas;
    document.getElementById('kpi-preventivas-venc').textContent = kpis.preventivasVenc;
    document.getElementById('kpi-preditivas').textContent = kpis.preditivas;
    document.getElementById('kpi-melhorias').textContent = kpis.melhorias;
    document.getElementById('kpi-equipamentos').textContent = kpis.equipamentos;
    document.getElementById('kpi-os-total').textContent = kpis.osTotal;
    document.getElementById('kpi-availability').textContent = `${Math.round(kpis.availability)}%`;
    document.getElementById('kpi-custo-total').textContent = `R$ ${kpis.custoTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
}

function createAllCharts(data) {
    createMTTRChart(data.mttr);
    createMTBFChart(data.mtbf);
    createMonthlyCostsChart(data.monthly_costs);
    createMonthlyCorrectivesChart(data.monthly_correctives);
    createMonthlyStatusChart(data.monthly_status);
    if (data.additionalData) {
        createMaintenanceTypeChart(data.additionalData.maintenanceTypeCounts);
        createCriticalityChart(data.additionalData.criticalityCounts);
        createTopEquipmentChart(data.additionalData.topEquipment);
        createAnalystChart(data.additionalData.analystCounts);
    }
}

// --- Funções de Modal ---

function openMTTRModal() {
    const modal = document.getElementById('mttrModal');
    if (dashboardData && dashboardData.mttr) {
        document.getElementById('mttrQ1').value = dashboardData.mttr[0];
        document.getElementById('mttrQ2').value = dashboardData.mttr[1];
        document.getElementById('mttrQ3').value = dashboardData.mttr[2];
    }
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closeMTTRModal() {
    document.getElementById('mttrModal').classList.add('hidden');
}

function updateMTTR() {
    const q1 = parseFloat(document.getElementById('mttrQ1').value);
    const q2 = parseFloat(document.getElementById('mttrQ2').value);
    const q3 = parseFloat(document.getElementById('mttrQ3').value);
    if (isNaN(q1) || isNaN(q2) || isNaN(q3)) return alert('Valores inválidos.');
    if (dashboardData) {
        dashboardData.mttr = [q1, q2, q3];
        createMTTRChart(dashboardData.mttr);
    }
    closeMTTRModal();
}

function openMTBFModal() {
    const modal = document.getElementById('mtbfModal');
    if (dashboardData && dashboardData.mtbf) {
        const ids = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        ids.forEach((id, index) => {
            document.getElementById(`mtbf${id}`).value = dashboardData.mtbf[index];
        });
    }
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closeMTBFModal() {
    document.getElementById('mtbfModal').classList.add('hidden');
}

function updateMTBF() {
    const ids = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const newData = ids.map(id => parseFloat(document.getElementById(`mtbf${id}`).value));
    if (newData.some(isNaN)) return alert('Valores inválidos.');
    if (dashboardData) {
        dashboardData.mtbf = newData;
        createMTBFChart(dashboardData.mtbf);
    }
    closeMTBFModal();
}

function openMonthlyCostsModal() {
    const modal = document.getElementById('monthlyCostsModal');
    if (dashboardData && dashboardData.monthly_costs) {
        const ids = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        ids.forEach((id, index) => {
            document.getElementById(`cost${id}`).value = dashboardData.monthly_costs[index];
        });
    }
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closeMonthlyCostsModal() {
    document.getElementById('monthlyCostsModal').classList.add('hidden');
}

function updateMonthlyCosts() {
    const ids = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const newData = ids.map(id => parseFloat(document.getElementById(`cost${id}`).value));
    if (newData.some(isNaN)) return alert('Valores inválidos.');
    if (dashboardData) {
        dashboardData.monthly_costs = newData;
        createMonthlyCostsChart(dashboardData.monthly_costs);
    }
    closeMonthlyCostsModal();
}

// --- Funções de Gráfico ---

function createOrUpdateChart(chartId, config) {
    const ctx = document.getElementById(chartId);
    if (!ctx) return;
    if (charts[chartId]) charts[chartId].destroy();
    charts[chartId] = new Chart(ctx.getContext('2d'), config);
}

function createMTTRChart(mttrData) {
    const mediaGeral = mttrData.reduce((a, b) => a + b, 0) / mttrData.length;
    createOrUpdateChart('mttrChart', {
        type: 'bar',
        data: {
            labels: ['Q1', 'Q2', 'Q3'],
            datasets: [{
                label: 'MTTR (horas)',
                data: mttrData,
                backgroundColor: accentColor,
            }, {
                label: 'Média MTTR',
                data: Array(3).fill(mediaGeral),
                type: 'line',
                borderColor: '#ef4444',
                borderWidth: 2,
                borderDash: [5, 5],
                fill: false
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: 'white' } } }, scales: { y: { beginAtZero: true, ticks: { color: 'white' }, grid: { color: 'rgba(255,255,255,0.1)' } }, x: { ticks: { color: 'white' }, grid: { color: 'rgba(255,255,255,0.1)' } } } }
    });
}

function createMTBFChart(mtbfData) {
    createOrUpdateChart('mtbfChart', {
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
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: 'white' } } }, scales: { y: { beginAtZero: true, ticks: { color: 'white' }, grid: { color: 'rgba(255,255,255,0.1)' } }, x: { ticks: { color: 'white' }, grid: { color: 'rgba(255,255,255,0.1)' } } } }
    });
}

function createMonthlyCostsChart(costsData) {
    createOrUpdateChart('monthlyCostsChart', {
        type: 'bar',
        data: {
            labels: meses,
            datasets: [{
                label: 'Custos Mensais',
                data: costsData,
                backgroundColor: '#10b981',
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: 'white' } } }, scales: { y: { beginAtZero: true, ticks: { color: 'white' }, grid: { color: 'rgba(255,255,255,0.1)' } }, x: { ticks: { color: 'white' }, grid: { color: 'rgba(255,255,255,0.1)' } } } }
    });
}

function createMonthlyCorrectivesChart(correctivesData) {
    createOrUpdateChart('monthlyCorrectivesChart', {
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
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: 'white' } } }, scales: { y: { beginAtZero: true, ticks: { color: 'white' }, grid: { color: 'rgba(255,255,255,0.1)' } }, x: { ticks: { color: 'white' }, grid: { color: 'rgba(255,255,255,0.1)' } } } }
    });
}

function createMonthlyStatusChart(statusData) {
    const colors = { 'Não Iniciada': '#ef4444', 'Requisitada': '#f59e0b', 'Iniciada': '#10b981', 'Liberada': '#3b82f6', 'Suspensa': '#8b5cf6' };
    const datasets = Object.keys(statusData).map(status => ({
        label: status,
        data: statusData[status],
        borderColor: colors[status] || '#6b7280',
        fill: false,
        tension: 0.4
    }));
    createOrUpdateChart('monthlyStatusChart', {
        type: 'line',
        data: { labels: meses, datasets },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: 'white' } } }, scales: { y: { beginAtZero: true, stacked: true, ticks: { color: 'white' }, grid: { color: 'rgba(255,255,255,0.1)' } }, x: { ticks: { color: 'white' }, grid: { color: 'rgba(255,255,255,0.1)' } } } }
    });
}

function createMaintenanceTypeChart(data) {
    createOrUpdateChart("maintenanceTypeChart", {
        type: "doughnut",
        data: {
            labels: Object.keys(data),
            datasets: [{
                data: Object.values(data),
                backgroundColor: ["#00f6ff", "#10b981", "#f59e0b", "#ef4444", "#3b82f6", "#8b5cf6"],
                hoverOffset: 4
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: "white" } } } }
    });
}

function createCriticalityChart(data) {
    createOrUpdateChart("criticalityChart", {
        type: "bar",
        data: {
            labels: Object.keys(data),
            datasets: [{
                label: "Número de Ordens",
                data: Object.values(data),
                backgroundColor: accentColor
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { color: "white" }, grid: { color: "rgba(255,255,255,0.1)" } }, x: { ticks: { color: "white" }, grid: { color: "rgba(255,255,255,0.1)" } } } }
    });
}

function createTopEquipmentChart(data) {
    createOrUpdateChart("topEquipmentChart", {
        type: "bar",
        data: {
            labels: data.map(item => item.equipment),
            datasets: [{
                label: "Número de Ordens",
                data: data.map(item => item.count),
                backgroundColor: accentColor
            }]
        },
        options: { indexAxis: "y", responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { ticks: { color: "white" }, grid: { color: "rgba(255,255,255,0.1)" } }, x: { ticks: { color: "white" }, grid: { color: "rgba(255,255,255,0.1)" } } } }
    });
}

function createAnalystChart(data) {
    createOrUpdateChart("analystChart", {
        type: "pie",
        data: {
            labels: Object.keys(data),
            datasets: [{
                data: Object.values(data),
                backgroundColor: ["#00f6ff", "#10b981", "#f59e0b", "#ef4444", "#3b82f6", "#8b5cf6"],
                hoverOffset: 4
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: "white" } } } }
    });
}

function filterEquipmentTable(searchText) {
    const rows = document.querySelectorAll('#equipment-table tbody tr');
    searchText = searchText.toLowerCase();
    rows.forEach(row => {
        const code = row.cells[1].textContent.toLowerCase();
        row.style.display = code.includes(searchText) ? '' : 'none';
    });
}

function loadEquipmentAnalysis() {
    if (!currentExcelData) return;
    
    const dataToUse = (selectedYear || selectedMonth !== '') ? filterData() : currentExcelData;
    const equipmentStats = {};
    
    dataToUse.forEach(row => {
        const name = row['Nome Equipamento'];
        if (!name) return;
        if (!equipmentStats[name]) {
            equipmentStats[name] = { name, code: row['Equipamento'] || 'N/A', tag: row['Tag'] || 'N/A', total_orders: 0, corrective: 0, preventive: 0, cost: 0 };
        }
        equipmentStats[name].total_orders++;
        if (row['Tipo de Manutenção'] === 7) equipmentStats[name].corrective++;
        if (row['Tipo de Manutenção'] === 10) equipmentStats[name].preventive++;
        const mat = parseFloat(String(row['Valor Material'] || '0').replace(',', '.')) || 0;
        const mo = parseFloat(String(row['Valor Mão de Obra'] || '0').replace(',', '.')) || 0;
        equipmentStats[name].cost += mat + mo;
    });
    
    const equipmentArray = Object.values(equipmentStats).sort((a, b) => b.cost - a.cost);
    const content = document.getElementById('equipment-analysis-content');
    content.innerHTML = `
        <h3 class="text-white font-semibold mb-4">Análise de Equipamentos</h3>
        <input type="text" id="equipment-search" placeholder="Buscar por código..." class="p-2 rounded bg-gray-700 text-white border border-gray-600 w-full sm:w-64 mb-4" oninput="filterEquipmentTable(this.value)">
        <div class="overflow-x-auto">
            <table class="w-full text-white" id="equipment-table">
                <thead><tr class="border-b border-gray-600">
                    <th class="text-left p-2">Equipamento</th><th class="text-left p-2">Código</th><th class="text-left p-2">Tag</th>
                    <th class="text-left p-2">Total O.S</th><th class="text-left p-2">Corretivas</th><th class="text-left p-2">Preventivas</th><th class="text-left p-2">Custo Total</th>
                </tr></thead>
                <tbody>${equipmentArray.map(eq => `
                    <tr class="border-b border-gray-700 hover:bg-kpi-dark">
                        <td class="p-2 text-sm">${eq.name}</td><td class="p-2 text-sm">${eq.code}</td><td class="p-2 text-sm">${eq.tag}</td>
                        <td class="p-2">${eq.total_orders}</td><td class="p-2 text-red-400">${eq.corrective}</td><td class="p-2 text-green-400">${eq.preventive}</td>
                        <td class="p-2">R$ ${eq.cost.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                    </tr>`).join('')}
                </tbody>
            </table>
        </div>`;
}

// Outras funções (preditiva, edição de dados, etc.) permanecem as mesmas.
function loadPredictiveAnalysis() {
    // A lógica existente permanece aqui
}

function loadEditForm() {
    // A lógica existente permanece aqui
}

function saveEditedData() {
    // A lógica existente permanece aqui
}

function exportReport() {
    // A lógica existente permanece aqui
}

