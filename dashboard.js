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

// Função para imprimir gráficos
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

    // Adicionar event listeners para os filtros
    document.getElementById('filter-year').addEventListener('change', handleFilterChange);
    document.getElementById('filter-month').addEventListener('change', handleFilterChange);

    // Preencher anos disponíveis
    populateYearFilter();
    
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

    // Mostrar/esconder filtros do dashboard
    const dashboardFilters = document.getElementById('dashboard-filters');
    if (dashboardFilters) {
        if (viewName === 'dashboard') {
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

        // Atualizar filtro de anos
        populateYearFilter();
        
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

function populateYearFilter() {
    if (!currentExcelData || currentExcelData.length === 0) return;

    const yearSelect = document.getElementById('filter-year');
    if (!yearSelect) return;

    // Limpar opções existentes, mantendo a opção "Todos os Anos"
    yearSelect.innerHTML = '<option value="">Todos os Anos</option>';

    // Coletar anos únicos dos dados
    const years = new Set();
    currentExcelData.forEach(row => {
        if (row['Data Manutenção']) {
            const dataStr = row['Data Manutenção'];
            if (dataStr.includes('/')) {
                const [_, __, ano] = dataStr.split('/');
                if (ano) years.add(ano);
            }
        }
    });

    // Adicionar anos como opções
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

    // Filtrar dados
    filteredData = filterData();

    // Recarregar dashboard com dados filtrados
    loadDashboardData();
}

function filterData() {
    if (!currentExcelData) return [];
    
    return currentExcelData.filter(row => {
        if (!row['Data Manutenção']) return false;

        const dataStr = row['Data Manutenção'];
        if (!dataStr.includes('/')) return false;

        const [dia, mes, ano] = dataStr.split('/');
        
        // Aplicar filtro de ano
        if (selectedYear && ano !== selectedYear) return false;
        
        // Aplicar filtro de mês
        if (selectedMonth !== '') {
            const monthIndex = parseInt(mes) - 1;
            if (monthIndex !== parseInt(selectedMonth)) return false;
        }
        
        return true;
    });
}

async function loadDashboardData() {
    if (!currentExcelData) {
        console.log('Nenhum dado Excel disponível');
        return;
    }

    showLoading(true);
    try {
        // Usar dados filtrados se houver filtros ativos, caso contrário usar todos os dados
        const dataToUse = (selectedYear || selectedMonth !== '') ? filterData() : currentExcelData;
        
        const kpis = calculateKPIs(dataToUse);
        const monthlyData = calculateMonthlyData(dataToUse);
        const mttrMtbf = calculateMTTRMTBF(dataToUse);
        const additionalData = calculateAdditionalChartsData(dataToUse);
        
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
    
    const mediaGeral = mttrData.reduce((a, b) => a + b, 0) / mttrData.length;
    
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
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Tempo Médio de Reparo por Trimestre (MTTR)',
                    color: 'white',
                    font: { size: 16 }
                },
                legend: { 
                    labels: { color: 'white', padding: 20 },
                    position: 'bottom'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${context.parsed.y.toFixed(1)} horas`;
                        },
                        afterBody: function(context) {
                            return [`\nMédia Geral: ${mediaGeral.toFixed(1)} horas`];
                        }
                    }
                }
            },
            scales: {
                y: { 
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Horas',
                        color: 'white'
                    },
                    ticks: { 
                        color: 'white',
                        callback: function(value) {
                            return value.toFixed(1) + 'h';
                        }
                    },
                    grid: { color: 'rgba(255,255,255,0.1)' }
                },
                x: { 
                    title: {
                        display: true,
                        text: 'Trimestre',
                        color: 'white'
                    },
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
            plugins: { legend: { labels: { color: 'white' } } },
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
    
    const custoTotal = costsData.reduce((a, b) => a + b, 0);
    const mediaMensal = custoTotal / costsData.length;
    
    charts.costs = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: {
            labels: meses,
            datasets: [{
                label: 'Custos Mensais',
                data: costsData,
                backgroundColor: '#10b981',
                borderColor: '#10b981',
                borderWidth: 1
            }, {
                label: 'Média Mensal',
                data: Array(12).fill(mediaMensal),
                type: 'line',
                borderColor: '#f59e0b',
                borderWidth: 2,
                borderDash: [5, 5],
                fill: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: [
                        'Custos Mensais de Manutenção',
                        `Total: R$ ${custoTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`,
                        `Média Mensal: R$ ${mediaMensal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`
                    ],
                    color: 'white',
                    font: { size: 14 }
                },
                legend: { 
                    labels: { color: 'white', padding: 20 },
                    position: 'bottom'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const value = context.parsed.y;
                            return `${context.dataset.label}: R$ ${value.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
                        },
                        afterBody: function(tooltipItems) {
                            const dataIndex = tooltipItems[0].dataIndex;
                            const percentual = (costsData[dataIndex] / custoTotal * 100).toFixed(1);
                            return [`\nRepresenta ${percentual}% do custo total`];
                        }
                    }
                }
            },
            scales: {
                y: { 
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Valor (R$)',
                        color: 'white'
                    },
                    ticks: { 
                        color: 'white',
                        callback: function(value) {
                            return 'R$ ' + value.toLocaleString('pt-BR');
                        }
                    },
                    grid: { color: 'rgba(255,255,255,0.1)' }
                },
                x: { 
                    title: {
                        display: true,
                        text: 'Mês',
                        color: 'white'
                    },
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
    
    const mediaCorretivas = correctivesData.reduce((a, b) => a + b, 0) / correctivesData.length;
    const totalCorretivas = correctivesData.reduce((a, b) => a + b, 0);
    
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
            }, {
                label: 'Média Mensal',
                data: Array(12).fill(mediaCorretivas),
                borderColor: '#f59e0b',
                borderWidth: 2,
                borderDash: [5, 5],
                fill: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: ['Manutenções Corretivas por Mês', `Total: ${totalCorretivas} | Média: ${mediaCorretivas.toFixed(1)}`],
                    color: 'white',
                    font: { size: 14 }
                },
                legend: { 
                    labels: { color: 'white', padding: 20 },
                    position: 'bottom'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${context.parsed.y}`;
                        },
                        afterBody: function(tooltipItems) {
                            const dataIndex = tooltipItems[0].dataIndex;
                            const percentual = (correctivesData[dataIndex] / totalCorretivas * 100).toFixed(1);
                            return [`\nRepresenta ${percentual}% do total`];
                        }
                    }
                }
            },
            scales: {
                y: { 
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Quantidade de O.S',
                        color: 'white'
                    },
                    ticks: { 
                        color: 'white',
                        callback: function(value) {
                            return value.toFixed(0);
                        }
                    },
                    grid: { color: 'rgba(255,255,255,0.1)' }
                },
                x: { 
                    title: {
                        display: true,
                        text: 'Mês',
                        color: 'white'
                    },
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
    const total = values.reduce((a, b) => a + b, 0);

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
                hoverOffset: 4,
                borderColor: '#262f4e', // Add border to separate slices
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { 
                legend: { 
                    labels: { color: "white" },
                    position: 'right' 
                },
                title: {
                    display: true,
                    text: `Ordens por Tipo de Manutenção (Total: ${total})`,
                    color: 'white',
                    font: { size: 16 }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.raw || 0;
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${label}: ${value} (${percentage}%)`;
                        }
                    }
                },
                datalabels: {
                    formatter: (value, ctx) => {
                        const percentage = ((value / total) * 100).toFixed(1);
                        return `${percentage}%`;
                    },
                    color: '#fff',
                    font: {
                        weight: 'bold'
                    }
                }
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
            plugins: { legend: { labels: { color: "white" } } },
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
            plugins: { legend: { labels: { color: "white" } } },
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
            plugins: { legend: { labels: { color: "white" } } }
        }
    });
}

function loadEquipmentAnalysis() {
    if (!currentExcelData) return;
    
    try {
        // Análise por equipamento
        const equipmentStats = {};
        
        currentExcelData.forEach(row => {
            const equipmentName = row['Nome Equipamento'];
            if (!equipmentName) return;
            
            if (!equipmentStats[equipmentName]) {
                equipmentStats[equipmentName] = {
                    name: equipmentName,
                    code: row['Equipamento'] || 'N/A',
                    tag: row['Tag'] || row['Descrição do Tag'] || 'N/A',
                    total_orders: 0,
                    corrective: 0,
                    preventive: 0,
                    cost: 0
                };
            }
            
            equipmentStats[equipmentName].total_orders++;
            
            if (row['Tipo de Manutenção'] === 7) {
                equipmentStats[equipmentName].corrective++;
            } else if (row['Tipo de Manutenção'] === 10) {
                equipmentStats[equipmentName].preventive++;
            }
            
            const valorMaterial = parseFloat(String(row['Valor Material'] || '0').replace(',', '.').replace(/"/g, '')) || 0;
            const valorMaoObra = parseFloat(String(row['Valor Mão de Obra'] || '0').replace(',', '.').replace(/"/g, '')) || 0;
            equipmentStats[equipmentName].cost += valorMaterial + valorMaoObra;
        });
        
        // Converter para array e ordenar por custo
        const equipmentArray = Object.values(equipmentStats)
            .sort((a, b) => b.cost - a.cost);
        
        const content = document.getElementById('equipment-analysis-content');
        if (content) {
            content.innerHTML = `
                <h3 class="text-white font-semibold mb-4">Análise de Equipamentos</h3>
                <div class="overflow-x-auto">
                    <table class="w-full text-white">
                        <thead>
                            <tr class="border-b border-gray-600">
                                <th class="text-left p-2">Equipamento</th>
                                <th class="text-left p-2">Código</th>
                                <th class="text-left p-2">Tag</th>
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
                                    <td class="p-2 text-sm">${eq.code}</td>
                                    <td class="p-2 text-sm">${eq.tag}</td>
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

// Placeholder removido pois está duplicado abaixo

function loadEditForm() {
    if (!currentExcelData || !currentExcelData.length) {
        alert('Nenhum dado disponível para edição. Por favor, faça o upload de um arquivo primeiro.');
        showView('dashboard');
        return;
    }

    console.log('Dados para edição:', currentExcelData); // Debug

    // Atualizar os cabeçalhos da tabela primeiro
    const headers = document.querySelector('#edit-table thead tr');
    headers.innerHTML = `
        <th class="px-4 py-2">Data Manutenção</th>
        <th class="px-4 py-2">Equipamento</th>
        <th class="px-4 py-2">Tipo de Manutenção</th>
        <th class="px-4 py-2">Descrição</th>
        <th class="px-4 py-2">Horas Reportadas</th>
        <th class="px-4 py-2">Ações</th>
    `;

    const tableBody = document.getElementById('edit-table-body');
    tableBody.innerHTML = '';

    currentExcelData.forEach((row, index) => {
        const tr = document.createElement('tr');
        tr.className = index % 2 === 0 ? 'bg-kpi-main/50' : 'bg-kpi-main/30';
        tr.setAttribute('data-index', index);

        // Tratamento da data
        let dataValue = '';
        if (row['Data Manutenção']) {
            // Tentar converter a data para o formato correto
            const dataStr = row['Data Manutenção'];
            if (dataStr.includes('/')) {
                const [dia, mes, ano] = dataStr.split('/');
                dataValue = `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
            } else {
                const date = new Date(dataStr);
                if (!isNaN(date.getTime())) {
                    dataValue = date.toISOString().split('T')[0];
                }
            }
        }
        
        tr.innerHTML = `
            <td class="px-4 py-2">
                <input type="date" class="bg-transparent border border-gray-600 rounded px-2 py-1 w-full text-white"
                       value="${dataValue}" data-field="Data Manutenção">
            </td>
            <td class="px-4 py-2">
                <input type="text" class="bg-transparent border border-gray-600 rounded px-2 py-1 w-full text-white"
                       value="${row['Equipamento'] || ''}" data-field="Equipamento">
            </td>
            <td class="px-4 py-2">
                <select class="bg-transparent border border-gray-600 rounded px-2 py-1 w-full text-white" data-field="Tipo de Manutenção">
                    ${Object.entries(TIPO_MAPPING).map(([value, label]) => 
                        `<option value="${value}" ${row['Tipo de Manutenção'] == value ? 'selected' : ''}>${label}</option>`
                    ).join('')}
                </select>
            </td>
            <td class="px-4 py-2">
                <input type="text" class="bg-transparent border border-gray-600 rounded px-2 py-1 w-full text-white"
                       value="${row['Descrição'] || ''}" data-field="Descrição">
            </td>
            <td class="px-4 py-2">
                <input type="number" class="bg-transparent border border-gray-600 rounded px-2 py-1 w-full text-white"
                       value="${row['Duração'] || '0'}" data-field="Duração" step="0.1" min="0">
            </td>
            <td class="px-4 py-2">
                <button class="text-danger hover:text-red-300" onclick="deleteRow(${index})">
                    <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                </button>
            </td>
        `;
        tableBody.appendChild(tr);
    });
}

function deleteRow(index) {
    if (confirm('Tem certeza que deseja excluir este registro?')) {
        currentExcelData.splice(index, 1);
        loadEditForm(); // Recarrega a tabela
    }
}

function saveEditedData() {
    const rows = document.getElementById('edit-table-body').getElementsByTagName('tr');
    const updatedData = [];

    for (let row of rows) {
        // Converter a data para o formato correto
        const dataValue = row.querySelector('[data-field="Data Manutenção"]').value;
        const [ano, mes, dia] = dataValue.split('-');
        const dataFormatada = `${dia}/${mes}/${ano}`;
        
        const rowData = {
            'Data Manutenção': dataFormatada,
            'Equipamento': row.querySelector('[data-field="Equipamento"]').value,
            'Tipo de Manutenção': parseInt(row.querySelector('[data-field="Tipo de Manutenção"]').value),
            'Descrição da Ordem': row.querySelector('[data-field="Descrição"]').value,
            'Horas Reportadas': parseFloat(row.querySelector('[data-field="Horas"]').value)
        };
        updatedData.push(rowData);
    }

    currentExcelData = updatedData;
    
    // Atualiza os gráficos e análises
    loadDashboardData();

    alert('Dados atualizados com sucesso!');
    showView('dashboard');
}

function loadSettingsForm() {
    // Implementação básica para configurações
    console.log('Carregando formulário de configurações');
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
        a.download = 
`relatorio_manutencao_${new Date().toISOString().split('T')[0]}.txt
`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
    } catch (error) {
        console.error('Erro ao exportar relatório:', error);
        alert('Erro ao exportar relatório: ' + error.message);
    }
}
