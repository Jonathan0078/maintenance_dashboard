// Função global para copiar texto
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        alert('Copiado para a área de transferência!');
    }, (err) => {
        alert('Erro ao copiar: ', err);
    });
}
// Tornar a função acessível globalmente para o onclick
window.copyToClipboard = copyToClipboard;

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, onSnapshot, collection, getDocs, setDoc, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- DADOS DE TESTE (MOCK) ---
let mockData = {
    "2025": {
        kpis: {
            preventivas: 150, preventivasVencer: 15, preditivas: 45, melhorias: 22,
            equipamentos: 310, osCadastradas: 512, disponibilidade: 96.5,
            custo_mensal: [5100, 4800, 5500, 5200, 6000, 5800, 6200, 5900, 6500, 6300, 7000, 6800],
            corretivas_mensal: [5, 4, 6, 5, 7, 6, 8, 7, 9, 8, 10, 9]
        },
        charts: {
            mttr: [4.5, 4.2, 4.8],
            mtbf: [720, 750, 700, 730, 680, 690, 650, 670, 620, 640, 600, 610]
        },
        targets: { mttr: 5, mtbf: 600, disponibilidade: 95 }
    }
};

const firebaseConfig = {
    apiKey: "AIzaSyDShfzoFgVXEgNzWkbwi99xCpcMdrP9Wis",
    authDomain: "dashboard-manutencao-31cc1.firebaseapp.com",
    projectId: "dashboard-manutencao-31cc1",
    storageBucket: "dashboard-manutencao-31cc1.firebasestorage.app",
    messagingSenderId: "2579677725",
    appId: "1:2579677725:web:0a25ff2e34df14debabcf4"
};

let app, auth, db;
let isTestMode = false;
let dbUnsubscribe = null;
let clockInterval = null;
let headerInterval = null;
let currentYearData = {};
let currentUserData = {};
let isDataLoaded = false;
const charts = {};

const loginScreen = document.getElementById('login-screen');
const dashboardContainer = document.getElementById('dashboard-container');
const loadingOverlay = document.getElementById('loading-overlay');
const authError = document.getElementById('auth-error');

const showModal = (modalId) => document.getElementById(modalId)?.classList.remove('hidden');
const closeModal = (modalId) => document.getElementById(modalId)?.classList.add('hidden');

function enterTestMode() {
    isTestMode = true;
    loginScreen.classList.add('hidden');
    dashboardContainer.classList.remove('hidden');
    document.getElementById('test-mode-banner').classList.remove('hidden');
    
    currentUserData = { name: 'Usuário Teste' };
    startHeaderUpdates();
    setupDashboardEventListeners();
    initializeDashboard().then(() => {
        if (!localStorage.getItem('tourCompleted')) {
            startTour();
        }
    });
}

function initializeFirebase() {
     app = initializeApp(firebaseConfig);
     auth = getAuth(app);
     db = getFirestore(app);
     
     onAuthStateChanged(auth, user => {
        if (isTestMode) return;
        if (user) {
            loginScreen.classList.add('hidden');
            dashboardContainer.classList.remove('hidden');
            if (clockInterval) clearInterval(clockInterval);
            loadUserData(user).then(() => {
                setupDashboardEventListeners();
                initializeDashboard().then(() => {
                    if (!localStorage.getItem('tourCompleted')) {
                        startTour();
                    }
                });
            });
        } else {
            dashboardContainer.classList.add('hidden');
            loginScreen.classList.remove('hidden');
            if (dbUnsubscribe) dbUnsubscribe();
            if (headerInterval) clearInterval(headerInterval);
            startClockAndGreeting();
            setButtonsState(false);
        }
    });
}

async function loadUserData(user) {
    if (isTestMode) return;
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);
    currentUserData = userSnap.exists() ? userSnap.data() : { name: user.email };
    startHeaderUpdates();
}

function startHeaderUpdates() {
    const updateHeader = () => {
        const now = new Date();
        const hour = now.getHours();
        let greeting = '';
        if (hour >= 5 && hour < 12) greeting = 'Bom Dia';
        else if (hour >= 12 && hour < 18) greeting = 'Boa Tarde';
        else greeting = 'Boa Noite';
        
        document.getElementById('header-greeting').textContent = `${greeting}, ${currentUserData.name || ''}!`;
        document.getElementById('header-datetime').textContent = now.toLocaleString('pt-BR', { dateStyle: 'full', timeStyle: 'short' });
    };
    
    if (headerInterval) clearInterval(headerInterval);
    updateHeader();
    headerInterval = setInterval(updateHeader, 10000);
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    authError.textContent = '';
    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        authError.textContent = 'E-mail ou senha incorretos.';
    }
}

async function initializeDashboard() {
    loadingOverlay.classList.remove('hidden');
    const yearSelector = document.getElementById('year-select');
    
    if (isTestMode) {
        const years = Object.keys(mockData).sort((a, b) => b - a);
        if (years.length === 0) {
             showNoDataMessage(true);
             setButtonsState(false);
        } else {
            showNoDataMessage(false);
            yearSelector.innerHTML = years.map(year => `<option value="${year}">${year}</option>`).join('');
            listenToYearData(years[0]);
        }
        loadingOverlay.classList.add('hidden');
        return;
    }

    try {
        const querySnapshot = await getDocs(collection(db, "maintenance_data"));
        const years = querySnapshot.docs.map(doc => doc.id);

        if (years.length === 0) {
            showNoDataMessage(true); setButtonsState(false);
        } else {
            showNoDataMessage(false);
            years.sort((a, b) => b - a);
            yearSelector.innerHTML = years.map(year => `<option value="${year}">${year}</option>`).join('');
            listenToYearData(years[0]);
        }
    } catch (error) {
        console.error("Erro ao buscar dados iniciais:", error);
        showNoDataMessage(true);
    } finally {
        loadingOverlay.classList.add('hidden');
    }
}

function listenToYearData(year) {
    if (!year) return;
    loadingOverlay.classList.remove('hidden');
    setButtonsState(false);

    if(isTestMode) {
        currentYearData = mockData[year];
        updateDashboardUI(currentYearData);
        setButtonsState(true);
        loadingOverlay.classList.add('hidden');
        return;
    }
    
    if (dbUnsubscribe) dbUnsubscribe();
    const docRef = doc(db, "maintenance_data", year);
    dbUnsubscribe = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
            currentYearData = docSnap.data();
            updateDashboardUI(currentYearData);
            setButtonsState(true);
        } else {
            setButtonsState(false);
        }
        loadingOverlay.classList.add('hidden');
    }, (error) => {
        console.error("Erro ao escutar dados:", error);
        loadingOverlay.classList.add('hidden');
    });
}

function updateDashboardUI(data) {
    if (!data || !data.kpis) return;
    
    const kpis = data.kpis;
    const custoMensal = kpis.custo_mensal || Array(12).fill(0);
    const corretivasMensal = kpis.corretivas_mensal || Array(12).fill(0);
    const totalCost = custoMensal.reduce((a, b) => a + b, 0);
    const totalCorrectives = corretivasMensal.reduce((a, b) => a + b, 0);

    document.getElementById('kpi-corretivas').textContent = totalCorrectives;
    document.getElementById('kpi-custo-total').textContent = `R$ ${totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    document.getElementById('kpi-preventivas').textContent = kpis.preventivas;
    document.getElementById('kpi-preventivas-vencer').textContent = kpis.preventivasVencer;
    document.getElementById('kpi-preditivas').textContent = kpis.preditivas;
    document.getElementById('kpi-melhorias').textContent = kpis.melhorias;
    document.getElementById('kpi-equipamentos').textContent = kpis.equipamentos;
    document.getElementById('kpi-os-cadastradas').textContent = kpis.osCadastradas;

    const targets = data.targets || {};
    document.getElementById('mttr-target').textContent = `Target: ${targets.mttr || 0}`;
    document.getElementById('mtbf-target').textContent = `Target: ${targets.mtbf || 0}`;
    document.getElementById('disponibilidade-target').textContent = `Target: ${targets.disponibilidade || 0}%`;

    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

    updateChart('mttrChart', ['Trim. 1', 'Trim. 2', 'Trim. 3'], data.charts.mttr, 'MTTR', 'bar', {}, targets.mttr, 'lower');
    updateChart('mtbfChart', months, data.charts.mtbf, 'MTBF', 'line', {}, targets.mtbf, 'higher');
    const availabilityValue = kpis.disponibilidade || 0;
    updateChart('availabilityChart', ['Disponibilidade', 'Restante'], [availabilityValue, 100 - availabilityValue], 'Disponibilidade', 'doughnut', {}, targets.disponibilidade, 'higher');
    updateChart('monthlyCostsChart', months, custoMensal, 'Custo (R$)', 'line');
    updateChart('monthlyCorrectivesChart', months, corretivasMensal, 'Nº de O.S Corretivas', 'bar');

    lucide.createIcons();
}

const setButtonsState = (enabled) => {
     const btnEdit = document.getElementById('btn-edit');
     const btnSettings = document.getElementById('btn-settings');
     isDataLoaded = enabled;
     [btnEdit, btnSettings].forEach(btn => {
         if (btn) {
             btn.disabled = !enabled;
             enabled ? btn.classList.remove('btn-disabled') : btn.classList.add('btn-disabled');
         }
     });
};

const showNoDataMessage = (show) => {
    document.getElementById('kpi-grids-container').style.display = show ? 'none' : 'block';
    document.getElementById('no-data-message').style.display = show ? 'block' : 'none';
};

function startClockAndGreeting() {
    const update = () => {
        const now = new Date();
        const hour = now.getHours();
        const greetingEl = document.getElementById('login-greeting');
        const clockEl = document.getElementById('login-clock');
        if (greetingEl) {
            if (hour >= 5 && hour < 12) greetingEl.textContent = 'Bom Dia';
            else if (hour >= 12 && hour < 18) greetingEl.textContent = 'Boa Tarde';
            else greetingEl.textContent = 'Boa Noite';
        }
        if (clockEl) clockEl.textContent = now.toLocaleTimeString('pt-BR');
    };
    update();
    if (clockInterval) clearInterval(clockInterval);
    clockInterval = setInterval(update, 1000);
}

let listenersAttached = false;
function setupDashboardEventListeners() {
    if (listenersAttached) return;
    
    document.getElementById('btn-logout').addEventListener('click', () => {
        if(isTestMode) { window.location.reload(); } else { signOut(auth); }
    });
    document.getElementById('btn-settings').addEventListener('click', () => isDataLoaded && showSettingsModal());
    document.getElementById('btn-db').addEventListener('click', showDatabaseModal);
    document.getElementById('btn-refresh').addEventListener('click', () => { if(isDataLoaded) listenToYearData(document.getElementById('year-select').value); });
    document.getElementById('btn-help').addEventListener('click', () => showModal('helpModal'));
    document.getElementById('btn-start-tour').addEventListener('click', startTour);
    document.getElementById('btn-edit').addEventListener('click', () => isDataLoaded && showEditModal());
    document.getElementById('btn-add-year').addEventListener('click', () => showModal('addYearModal'));
    document.getElementById('btn-add-first-year').addEventListener('click', () => showModal('addYearModal'));
    document.getElementById('year-select').addEventListener('change', (e) => listenToYearData(e.target.value));
    document.getElementById('btn-compare-years').addEventListener('click', showCompareModal);
    document.getElementById('btn-generate-comparison').addEventListener('click', generateComparisonChart);
    document.getElementById('btn-export-pdf').addEventListener('click', exportToPDF);
    document.getElementById('btn-export-xlsx').addEventListener('click', exportToXLSX);
    
    document.querySelectorAll('.btn-close-modal').forEach(btn => { btn.addEventListener('click', () => closeModal(btn.dataset.modalId)); });
    
    document.getElementById('add-year-form').addEventListener('submit', (e) => saveYearData(e, true));
    document.getElementById('edit-form').addEventListener('submit', (e) => saveYearData(e, false));
    document.getElementById('settings-form').addEventListener('submit', saveSettings);
    
    listenersAttached = true;
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('btn-show-test-info').addEventListener('click', () => {
        document.getElementById('test-credentials').classList.toggle('hidden');
        lucide.createIcons();
    });
    document.getElementById('btn-test-mode').addEventListener('click', enterTestMode);
    setupDarkMode();
    initializeFirebase();
});

// --- LÓGICA DO MODO ESCURO ---
function setupDarkMode() {
    const toggleBtn = document.getElementById('btn-toggle-dark-mode');
    if (!toggleBtn) return;

    const sunIcon = `<i data-lucide="sun" class="w-6 h-6"></i>`;
    const moonIcon = `<i data-lucide="moon" class="w-6 h-6"></i>`;

    const applyTheme = (isDark) => {
        document.documentElement.classList.toggle('dark', isDark);
        toggleBtn.innerHTML = isDark ? sunIcon : moonIcon;
        lucide.createIcons();
        
        if (isDataLoaded) {
            updateDashboardUI(currentYearData);
        }
    };

    toggleBtn.addEventListener('click', () => {
        const isDark = !document.documentElement.classList.contains('dark');
        localStorage.setItem('darkMode', isDark);
        applyTheme(isDark);
    });

    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const savedMode = localStorage.getItem('darkMode');
    
    applyTheme(savedMode === 'true' || (savedMode === null && prefersDark));
}


// --- LÓGICA DO TOUR ---

const tourSteps = [
    { element: '#header-info', title: 'Boas-vindas!', description: 'Aqui você vê uma saudação, seu nome, a data e a hora atual.' , position: 'bottom' },
    { element: '#header-buttons', title: 'Ações Principais', description: 'Use estes botões para Adicionar um novo ano ou Sair da sua conta.' , position: 'bottom-left' },
    { element: '#sidebar-main-actions', title: 'Menu de Navegação', description: 'Aqui você pode alterar Configurações, Editar o ano atual, Comparar dados, ver a Base de Dados ou Atualizar as informações.' , position: 'right' },
    { element: '#year-selector-container', title: 'Seletor de Ano', description: 'Escolha o ano que deseja visualizar no painel.' , position: 'left' },
    { element: '#kpi-grids-container .card:first-child', title: 'Cartões de KPI', description: 'Estes cartões mostram os principais indicadores de manutenção (KPIs) de forma rápida e visual.' , position: 'bottom' },
    { element: '#charts-row-1', title: 'Gráficos de Performance', description: 'Acompanhe visualmente o MTTR, MTBF e a Disponibilidade para analisar a eficiência da sua equipe.' , position: 'top' },
    { element: '#export-buttons-container', title: 'Exportar Relatórios', description: 'Clique aqui para salvar a visualização atual como PDF ou para exportar os dados brutos para uma planilha Excel (XLSX).' , position: 'top' },
];

let currentStepIndex = 0;
let highlightedElement = null;

function showStep(index) {
    if (highlightedElement) highlightedElement.classList.remove('tour-highlight');
    if (index >= tourSteps.length) { endTour(); return; }

    const step = tourSteps[index];
    const targetElement = document.querySelector(step.element);
    
    if (!targetElement || targetElement.offsetParent === null) { showStep(index + 1); return; }
    
    targetElement.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    highlightedElement = targetElement;
    highlightedElement.classList.add('tour-highlight');
    
    const tooltip = document.getElementById('tour-tooltip');
    document.getElementById('tour-title').textContent = step.title;
    document.getElementById('tour-description').textContent = step.description;

    const targetRect = targetElement.getBoundingClientRect();
    
    let top, left;
    switch(step.position) {
        case 'bottom': top = targetRect.bottom + 15; left = targetRect.left + (targetRect.width / 2) - (tooltip.offsetWidth / 2); break;
        case 'bottom-left': top = targetRect.bottom + 15; left = targetRect.right - tooltip.offsetWidth; break;
        case 'top': top = targetRect.top - tooltip.offsetHeight - 15; left = targetRect.left + (targetRect.width / 2) - (tooltip.offsetWidth / 2); break;
        case 'left': top = targetRect.top + (targetRect.height / 2) - (tooltip.offsetHeight / 2); left = targetRect.left - tooltip.offsetWidth - 15; break;
        case 'right': default: top = targetRect.top + (targetRect.height / 2) - (tooltip.offsetHeight / 2); left = targetRect.right + 15;
    }
    
    if (left < 10) left = 10;
    if ((left + tooltip.offsetWidth) > window.innerWidth) left = window.innerWidth - tooltip.offsetWidth - 10;
    if (top < 10) top = 10;
    if ((top + tooltip.offsetHeight) > window.innerHeight) top = window.innerHeight - tooltip.offsetHeight - 10;

    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;

    document.getElementById('tour-prev').style.display = index === 0 ? 'none' : 'inline-block';
    document.getElementById('tour-next').textContent = index === tourSteps.length - 1 ? 'Finalizar' : 'Próximo';
}

function startTour() {
    currentStepIndex = 0;
    document.getElementById('tour-tooltip-container').classList.remove('hidden');
    showStep(currentStepIndex);
}

function endTour() {
    if (highlightedElement) {
        highlightedElement.classList.remove('tour-highlight');
        highlightedElement = null;
    }
    document.getElementById('tour-tooltip-container').classList.add('hidden');
    localStorage.setItem('tourCompleted', 'true');
}

document.getElementById('tour-next').addEventListener('click', () => { currentStepIndex++; showStep(currentStepIndex); });
document.getElementById('tour-prev').addEventListener('click', () => { if (currentStepIndex > 0) { currentStepIndex--; showStep(currentStepIndex); } });
document.getElementById('tour-skip').addEventListener('click', endTour);

// --- FUNÇÕES DE EXPORTAÇÃO ---

async function exportToPDF() {
    const btn = document.getElementById('btn-export-pdf');
    const originalContent = btn.innerHTML;
    btn.innerHTML = `<div class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>`;
    btn.disabled = true;

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
    });

    const chartCards = Array.from(document.querySelectorAll('#kpi-grids-container .card')).filter(card => card.querySelector('canvas'));

    try {
        for (let i = 0; i < chartCards.length; i++) {
            const card = chartCards[i];
            
            const buttons = card.querySelectorAll('button');
            buttons.forEach(b => b.style.display = 'none');
            
            const canvas = await html2canvas(card, {
                scale: 3,
                useCORS: true,
                backgroundColor: '#ffffff'
            });
            
            buttons.forEach(b => b.style.display = '');

            const imgData = canvas.toDataURL('image/png');
            
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const canvasWidth = canvas.width;
            const canvasHeight = canvas.height;
            const ratio = canvasWidth / canvasHeight;
            
            const margin = 15;
            let imgWidth = pdfWidth - (margin * 2);
            let imgHeight = imgWidth / ratio;

            if (imgHeight > pdfHeight - (margin * 2)) {
                imgHeight = pdfHeight - (margin * 2);
                imgWidth = imgHeight * ratio;
            }
            
            const x = (pdfWidth - imgWidth) / 2;
            const y = (pdfHeight - imgHeight) / 2;

            if (i > 0) {
                pdf.addPage();
            }
            
            pdf.addImage(imgData, 'PNG', x, y, imgWidth, imgHeight);
        }
        
        if (chartCards.length > 0) {
            const year = document.getElementById('year-select').value;
            pdf.save(`dashboard-manutencao-graficos-${year}.pdf`);
        } else {
            alert("Nenhum gráfico encontrado para exportar.");
        }

    } catch (error) {
        console.error("Erro ao gerar PDF:", error);
        alert("Ocorreu um erro ao gerar o PDF dos gráficos.");
    } finally {
        btn.innerHTML = originalContent;
        btn.disabled = false;
        lucide.createIcons();
    }
}

function exportToXLSX() {
    const btn = document.getElementById('btn-export-xlsx');
    const originalContent = btn.innerHTML;
    btn.innerHTML = `<div class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>`;
    btn.disabled = true;

    try {
        const year = document.getElementById('year-select').value;
        const kpis = currentYearData.kpis;
        const charts = currentYearData.charts;
        const targets = currentYearData.targets;
        const totalCorrectives = (kpis.corretivas_mensal || []).reduce((a, b) => a + b, 0);
        const totalCost = (kpis.custo_mensal || []).reduce((a, b) => a + b, 0);

        const summaryData = [
            { Indicador: 'Corretivas (Total Ano)', Valor: totalCorrectives },
            { Indicador: 'Preventivas', Valor: kpis.preventivas },
            { Indicador: 'Preventivas a Vencer', Valor: kpis.preventivasVencer },
            { Indicador: 'Preditivas', Valor: kpis.preditivas },
            { Indicador: 'Melhorias', Valor: kpis.melhorias },
            { Indicador: 'Equipamentos Instalados', Valor: kpis.equipamentos },
            { Indicador: 'O.S Cadastradas', Valor: kpis.osCadastradas },
            { Indicador: 'Custo Total (R$)', Valor: totalCost.toFixed(2) },
            { Indicador: 'Disponibilidade Média (%)', Valor: kpis.disponibilidade },
            { Indicador: 'Meta Disponibilidade (%)', Valor: targets.disponibilidade },
            { Indicador: 'Meta MTTR', Valor: targets.mttr },
            { Indicador: 'Meta MTBF', Valor: targets.mtbf },
        ];
        const wsSummary = XLSX.utils.json_to_sheet(summaryData);

        const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        const monthlyData = months.map((month, i) => ({
            Mês: month,
            'Custo Mensal (R$)': kpis.custo_mensal[i] || 0,
            'O.S Corretivas': kpis.corretivas_mensal[i] || 0,
            'MTBF Mensal': charts.mtbf[i] || 0
        }));
        const wsMonthly = XLSX.utils.json_to_sheet(monthlyData);
        
        const mttrData = [
            { Trimestre: 'Trim. 1', MTTR: charts.mttr[0] || 0 },
            { Trimestre: 'Trim. 2', MTTR: charts.mttr[1] || 0 },
            { Trimestre: 'Trim. 3', MTTR: charts.mttr[2] || 0 }
        ];
        const wsMttr = XLSX.utils.json_to_sheet(mttrData);

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumo KPIs');
        XLSX.utils.book_append_sheet(wb, wsMonthly, 'Dados Mensais');
        XLSX.utils.book_append_sheet(wb, wsMttr, 'Dados MTTR');
        
        XLSX.writeFile(wb, `dados-manutencao-${year}.xlsx`);

    } catch(e) {
        console.error("Erro ao gerar XLSX:", e);
        alert("Ocorreu um erro ao gerar o arquivo Excel.");
    } finally {
        btn.innerHTML = originalContent;
        btn.disabled = false;
        lucide.createIcons();
    }
}

// --- Funções de salvamento de dados ---

async function saveYearData(e, isNew) {
    e.preventDefault();
    
    const formPrefix = isNew ? 'add' : 'edit';
    const year = isNew 
        ? document.getElementById('add-year-input').value
        : document.getElementById('year-select').value;

    if (!year && isNew) { // Apenas requer o ano para novas entradas
        alert("O ano é obrigatório.");
        return;
    }

    const getMonthlyValues = (selector) => Array.from(document.querySelectorAll(selector)).map(input => parseFloat(input.value) || 0);

    const dataToSave = {
        kpis: {
            preventivas: parseInt(document.getElementById(`${formPrefix}-preventivas`).value, 10),
            preventivasVencer: parseInt(document.getElementById(`${formPrefix}-preventivas-vencer`).value, 10),
            preditivas: parseInt(document.getElementById(`${formPrefix}-preditivas`).value, 10),
            melhorias: parseInt(document.getElementById(`${formPrefix}-melhorias`).value, 10),
            equipamentos: parseInt(document.getElementById(`${formPrefix}-equipamentos`).value, 10),
            osCadastradas: parseInt(document.getElementById(`${formPrefix}-os-cadastradas`).value, 10),
            disponibilidade: parseFloat(document.getElementById(`${formPrefix}-disponibilidade`).value),
            custo_mensal: getMonthlyValues(`.${formPrefix}-custo-mensal`),
            corretivas_mensal: getMonthlyValues(`.${formPrefix}-corretivas-mensal`)
        },
        charts: {
            mttr: document.getElementById(`${formPrefix}-chart-mttr`).value.split(',').map(s => Number(s.trim())),
            mtbf: document.getElementById(`${formPrefix}-chart-mtbf`).value.split(',').map(s => Number(s.trim()))
        }
    };

    if (isNew) {
        // Apenas anos novos recebem um objeto de metas padrão
        dataToSave.targets = { mttr: 0, mtbf: 0, disponibilidade: 95 };
    }

    if (isTestMode) {
        if (isNew) {
            mockData[year] = dataToSave;
            alert(`(Modo Teste) Ano ${year} adicionado. A informação será perdida ao recarregar.`);
        } else {
            mockData[year].kpis = dataToSave.kpis;
            mockData[year].charts = dataToSave.charts;
            alert('(Modo Teste) Dados atualizados com sucesso!');
        }
        closeModal(isNew ? 'addYearModal' : 'editDataModal');
        if (isNew) {
            initializeDashboard();
        } else {
            listenToYearData(year);
        }
        return;
    }

    try {
        const docRef = doc(db, "maintenance_data", year);
        if (isNew) {
            await setDoc(docRef, dataToSave);
            alert(`Ano ${year} adicionado com sucesso!`);
        } else {
            await updateDoc(docRef, { kpis: dataToSave.kpis, charts: dataToSave.charts });
            alert('Dados atualizados com sucesso!');
        }
        closeModal(isNew ? 'addYearModal' : 'editDataModal');
        if (isNew) {
            initializeDashboard();
        }
    } catch (error) {
        alert(`Erro ao salvar: ${error.message}`);
    }
}

async function saveSettings(e) {
    e.preventDefault();
    const year = document.getElementById('year-select').value;
    const userName = document.getElementById('settings-user-name').value;
    
    const updatedTargets = {
        mttr: parseFloat(document.getElementById('settings-mttr-target').value),
        mtbf: parseFloat(document.getElementById('settings-mtbf-target').value),
        disponibilidade: parseFloat(document.getElementById('settings-disponibilidade-target').value)
    };

    if (isTestMode) {
        mockData[year].targets = updatedTargets;
        currentUserData.name = userName;
        startHeaderUpdates();
        alert('(Modo Teste) Configurações salvas com sucesso!');
        closeModal('settingsModal');
        listenToYearData(year);
        return;
    }
    
    try {
        await updateDoc(doc(db, "maintenance_data", year), { targets: updatedTargets });
        const userRef = doc(db, "users", auth.currentUser.uid);
        await setDoc(userRef, { name: userName }, { merge: true });
        
        currentUserData.name = userName;
        startHeaderUpdates();
        
        alert('Configurações salvas com sucesso!');
        closeModal('settingsModal');
    } catch (error) {
        alert(`Erro ao salvar as configurações: ${error.message}`);
    }
}

async function showDatabaseModal() {
    showModal('dbModal');
    const container = document.getElementById('db-table-container');
    container.innerHTML = '<div class="loader mx-auto"></div>';
    let tableHTML = `<table class="db-table"><thead><tr><th>Ano</th><th>Corretivas</th><th>Custo Total</th></tr></thead><tbody>`;
    
    if (isTestMode) {
        Object.keys(mockData).forEach(year => {
            const kpis = mockData[year].kpis;
            const totalCost = (kpis.custo_mensal || [0]).reduce((a,b)=>a+b,0);
            const totalCorrectives = (kpis.corretivas_mensal || [0]).reduce((a,b)=>a+b,0);
            tableHTML += `<tr><td>${year}</td><td>${totalCorrectives}</td><td>R$ ${totalCost.toLocaleString('pt-BR')}</td></tr>`;
        });
        tableHTML += `</tbody></table>`;
        container.innerHTML = tableHTML;
        return;
    }

    try {
        const querySnapshot = await getDocs(collection(db, "maintenance_data"));
        querySnapshot.forEach(doc => {
            const kpis = doc.data().kpis;
            const totalCost = (kpis.custo_mensal || [0]).reduce((a,b)=>a+b,0);
            const totalCorrectives = (kpis.corretivas_mensal || [0]).reduce((a,b)=>a+b,0);
            tableHTML += `<tr><td>${doc.id}</td><td>${totalCorrectives}</td><td>R$ ${totalCost.toLocaleString('pt-BR')}</td></tr>`;
        });
        tableHTML += `</tbody></table>`;
        container.innerHTML = tableHTML;
    } catch (error) {
        container.innerHTML = `<p class="text-red-500">Erro ao carregar dados: ${error.message}</p>`;
    }
}

async function showCompareModal() {
    showModal('compareYearsModal');
    const container = document.getElementById('compare-years-selection');
    container.innerHTML = '<div class="loader mx-auto"></div>';
    let years = [];

    if (isTestMode) {
        years = Object.keys(mockData).sort((a, b) => b - a);
        container.innerHTML = years.map(year => `<div class="flex items-center"><input id="year-${year}" type="checkbox" value="${year}" class="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"><label for="year-${year}" class="ml-2 block text-sm text-gray-900 dark:text-gray-200">${year}</label></div>`).join('');
        return;
    }

    try {
        const querySnapshot = await getDocs(collection(db, "maintenance_data"));
        years = querySnapshot.docs.map(doc => doc.id).sort((a, b) => b - a);
        container.innerHTML = years.map(year => `<div class="flex items-center"><input id="year-${year}" type="checkbox" value="${year}" class="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"><label for="year-${year}" class="ml-2 block text-sm text-gray-900 dark:text-gray-200">${year}</label></div>`).join('');
    } catch (error) {
        container.innerHTML = '<p class="text-red-500">Erro ao carregar anos.</p>';
    }
}

async function generateComparisonChart() {
    const selectedYears = Array.from(document.querySelectorAll('#compare-years-selection input:checked')).map(el => el.value);
    if (selectedYears.length < 2) { alert("Selecione pelo menos dois anos."); return; }

    const chartData = { labels: ['Custo Total (R$)', 'Nº Corretivas', 'Disponibilidade (%)'], datasets: [] };
    const colors = ['rgba(75, 192, 192, 0.7)', 'rgba(153, 102, 255, 0.7)', 'rgba(255, 159, 64, 0.7)', 'rgba(255, 99, 132, 0.7)'];
    
    if (isTestMode) {
        selectedYears.forEach((year, index) => {
            const data = mockData[year];
            if(data) {
               const kpis = data.kpis;
               const totalCost = (kpis.custo_mensal || [0]).reduce((a, b) => a + b, 0);
               const totalCorrectives = (kpis.corretivas_mensal || [0]).reduce((a, b) => a + b, 0);
               chartData.datasets.push({ label: year, data: [totalCost, totalCorrectives, kpis.disponibilidade], backgroundColor: colors[index % colors.length] });
            }
        });
        updateChart('comparisonChart', chartData.labels, null, null, 'bar', {}, null, null, chartData);
        return;
    }

    const docs = await Promise.all(selectedYears.map(year => getDoc(doc(db, "maintenance_data", year))));
    docs.forEach((docSnap, index) => {
        if (docSnap.exists()) {
            const kpis = docSnap.data().kpis;
            const totalCost = (kpis.custo_mensal || [0]).reduce((a, b) => a + b, 0);
            const totalCorrectives = (kpis.corretivas_mensal || [0]).reduce((a, b) => a + b, 0);
            chartData.datasets.push({ label: docSnap.id, data: [totalCost, totalCorrectives, kpis.disponibilidade], backgroundColor: colors[index % colors.length] });
        }
    });
    updateChart('comparisonChart', chartData.labels, null, null, 'bar', {}, null, null, chartData);
}

function showEditModal() {
    showModal('editDataModal');
    const year = document.getElementById('year-select').value;
    document.getElementById('edit-year-title').textContent = year;
    const kpis = (currentYearData && currentYearData.kpis) ? currentYearData.kpis : {};
    const charts = (currentYearData && currentYearData.charts) ? currentYearData.charts : { mttr: Array(3).fill(0), mtbf: Array(12).fill(0) };

    document.getElementById('edit-preventivas').value = kpis.preventivas ?? 0;
    document.getElementById('edit-preventivas-vencer').value = kpis.preventivasVencer ?? 0;
    document.getElementById('edit-preditivas').value = kpis.preditivas ?? 0;
    document.getElementById('edit-melhorias').value = kpis.melhorias ?? 0;
    document.getElementById('edit-equipamentos').value = kpis.equipamentos ?? 0;
    document.getElementById('edit-os-cadastradas').value = kpis.osCadastradas ?? 0;
    document.getElementById('edit-disponibilidade').value = kpis.disponibilidade ?? 0;

    const createMonthlyInputs = (containerId, values, prefix, type = "number", step = "1") => {
        const container = document.getElementById(containerId);
        container.innerHTML = '';
        const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        let currentValues = Array.isArray(values) && values.length === 12 ? values : Array(12).fill(0);
        currentValues = currentValues.map(v => (typeof v === 'number' && !isNaN(v)) ? v : 0);
        if (!currentValues.length || currentValues.every(v => v === 0)) {
            container.innerHTML = '<span style="color: #888; font-size: 0.9em;">Preencha os valores mensais de O.S Corretivas</span>';
        }
        currentValues.forEach((value, index) => {
            container.innerHTML += `<input type="${type}" step="${step}" placeholder="${months[index]}" class="form-input form-input-small dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 ${prefix}-mensal" value="${value}" required>`;
        });
        container.style.minHeight = '48px';
    };
    createMonthlyInputs('edit-custos-mensais-container', kpis.custo_mensal, 'edit-custo', 'number', '0.01');
    createMonthlyInputs('edit-corretivas-mensais-container', kpis.corretivas_mensal, 'edit-corretivas');

    document.getElementById('edit-chart-mttr').value = Array.isArray(charts.mttr) ? charts.mttr.join(', ') : '0, 0, 0';
    document.getElementById('edit-chart-mtbf').value = Array.isArray(charts.mtbf) ? charts.mtbf.join(', ') : '0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0';
}

function showSettingsModal() {
    showModal('settingsModal');
    const year = document.getElementById('year-select').value;
    document.getElementById('settings-year-title').textContent = year;
    document.getElementById('settings-user-name').value = currentUserData.name || '';
    
    const targets = currentYearData.targets || {};
    document.getElementById('settings-mttr-target').value = targets.mttr || 0;
    document.getElementById('settings-mtbf-target').value = targets.mtbf || 0;
    document.getElementById('settings-disponibilidade-target').value = targets.disponibilidade || 95;
}

const centerTextPlugin = {
    id: 'centerText',
    afterDraw: (chart) => {
        if (chart.canvas.id !== 'availabilityChart') return;
        const ctx = chart.ctx;
        const { width, height } = chart;
        const value = chart.data.datasets[0].data[0];
        const text = value.toFixed(1) + '%';
        
        ctx.restore();
        const fontSize = (height / 120).toFixed(2);
        const isDarkMode = document.documentElement.classList.contains('dark');
        ctx.font = `bold ${fontSize}em Inter, sans-serif`;
        ctx.fillStyle = isDarkMode ? '#e5e7eb' : '#1f2937';
        ctx.textBaseline = 'middle';
        
        const textX = Math.round((width - ctx.measureText(text).width) / 2);
        const textY = height / 2 + (height / 8);
        
        ctx.fillText(text, textX, textY);
        ctx.save();
    }
};
Chart.register(centerTextPlugin);

function updateChart(chartId, labels, data, label, type = 'bar', scaleOptions = {}, target = null, targetType = null, fullData = null) {
    const ctx = document.getElementById(chartId)?.getContext('2d');
    if (!ctx) return;
    if (charts[chartId]) { charts[chartId].destroy(); }

    const isDarkMode = document.documentElement.classList.contains('dark');
    const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
    const textColor = isDarkMode ? '#e5e7eb' : '#6b7280';
    const pointColor = isDarkMode ? '#a78bfa' : '#4bc0c0';
    const barColor = isDarkMode ? '#818cf8' : '#4bc0c0';
    const barFailColor = isDarkMode ? '#fca5a5' : '#ff9f40';

    let chartConfig;

    if (chartId === 'availabilityChart') {
        const value = data[0];
        let color = barFailColor;
        if ((targetType === 'higher' && value >= target) || (targetType === 'lower' && value <= target)) {
            color = barColor;
        }
        
        chartConfig = {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{ data: data, backgroundColor: [color, isDarkMode ? '#374151' : '#e5e7eb'], borderWidth: 0, cutout: '70%' }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                circumference: 180, rotation: -90,
                plugins: { legend: { display: false }, tooltip: { enabled: false } }
            }
        };
    } else {
        chartConfig = {
            type: type,
            data: fullData ? fullData : {
                labels: labels,
                datasets: [{
                    label: label, data: data,
                    backgroundColor: (context) => {
                        if (!target || !targetType || type==='line') return type === 'line' ? 'transparent' : barColor;
                        const value = context.raw;
                        if ((targetType === 'higher' && value >= target) || (targetType === 'lower' && value <= target)) return barColor;
                        return barFailColor;
                    },
                    borderColor: pointColor,
                    borderWidth: 2,
                    pointBackgroundColor: pointColor,
                    tension: 0.1,
                    fill: type === 'line' ? false : true,
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: { 
                    y: { 
                        beginAtZero: true, 
                        ...scaleOptions,
                        grid: { color: gridColor },
                        ticks: { color: textColor }
                    },
                    x: {
                        grid: { color: gridColor },
                        ticks: { color: textColor }
                    }
                },
                plugins: {
                    annotation: { annotations: {} },
                    legend: { 
                        display: !!fullData,
                        labels: { color: textColor }
                    }
                }
            }
        };
        
        if (target && targetType && !fullData && type !== 'doughnut') {
            chartConfig.options.plugins.annotation.annotations.targetLine = {
                type: 'line', yMin: target, yMax: target,
                borderColor: isDarkMode ? '#f87171' : '#ff6384',
                borderWidth: 2, borderDash: [6, 6],
                label: { content: `Meta`, enabled: true, position: 'end', yAdjust: -10, backgroundColor: isDarkMode ? 'rgba(248, 113, 113, 0.7)' : 'rgba(255, 99, 132, 0.7)'}
            };
        }
    }

    charts[chartId] = new Chart(ctx, chartConfig);
}