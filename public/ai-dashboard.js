// Função para buscar dados do backend/IA (mock para exemplo)
async function fetchAIDashboardData() {
  // Busca dados do backend PythonAnywhere, que consulta Gemini AI
  const prompt = `Gere um JSON com os seguintes campos para um dashboard de manutenção:\n\ntotalRequisicoes, concluidas, percentConclusao, emAberto, programadas, canceladas, tempoMedio,\nrequisicoesRecebidas (labels: jan a jun, values: 6 valores),\nrequisicoesNatureza (labels: Mecânica, Elétrica, Predial, Oficina, values: 4 valores),\nrequisicoesTipo (labels: Corretiva, Preventiva, Preditiva, values: 3 valores),\nleadTime (labels: 0-5, 6-10, 11-20, 20-30, +30, values: 5 valores),\nrequisicoesConcluidas (labels: jan a jun, values: 6 valores),\nrequisicoesSetor (labels: Produção, Serviços, PCP, Expedição, Almoxarifado, Garantia, Compras, Manutenção, values: 8 valores).\nOs valores devem ser realistas para um setor industrial.`;
  const response = await fetch('https://jonathan9779.pythonanywhere.com/ai-dashboard-data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt })
  });
  if (!response.ok) throw new Error('Erro ao buscar dados da IA');
  return response.json();
}

// Função para atualizar os indicadores do dashboard
function updateDashboardMetrics(data) {
  document.getElementById('total-requisicoes').textContent = data.totalRequisicoes;
  document.getElementById('concluidas').textContent = data.concluidas;
  document.getElementById('percent-conclusao').textContent = data.percentConclusao + '%';
  document.getElementById('em-aberto').textContent = data.emAberto;
  document.getElementById('programadas').textContent = data.programadas;
  document.getElementById('canceladas').textContent = data.canceladas;
  document.getElementById('tempo-medio').textContent = data.tempoMedio + ' dias';
}

// Função para desenhar gráficos com Chart.js
function renderCharts(data) {
  // Requisições Recebidas
  new Chart(document.getElementById('chart-recebidas'), {
    type: 'bar',
    data: {
      labels: data.requisicoesRecebidas.labels,
      datasets: [{
        label: 'Recebidas',
        data: data.requisicoesRecebidas.values,
        backgroundColor: '#00bcd4',
      }]
    }
  });
  // Requisições por Natureza
  new Chart(document.getElementById('chart-natureza'), {
    type: 'bar',
    data: {
      labels: data.requisicoesNatureza.labels,
      datasets: [{
        label: 'Natureza',
        data: data.requisicoesNatureza.values,
        backgroundColor: '#263238',
      }]
    }
  });
  // Requisições por Tipo
  new Chart(document.getElementById('chart-tipo'), {
    type: 'bar',
    data: {
      labels: data.requisicoesTipo.labels,
      datasets: [{
        label: 'Tipo',
        data: data.requisicoesTipo.values,
        backgroundColor: '#e57373',
      }]
    }
  });
  // Lead Time
  new Chart(document.getElementById('chart-leadtime'), {
    type: 'bar',
    data: {
      labels: data.leadTime.labels,
      datasets: [{
        label: 'Lead Time',
        data: data.leadTime.values,
        backgroundColor: '#ffd600',
      }]
    }
  });
  // Requisições Concluídas
  new Chart(document.getElementById('chart-concluidas'), {
    type: 'bar',
    data: {
      labels: data.requisicoesConcluidas.labels,
      datasets: [{
        label: 'Concluídas',
        data: data.requisicoesConcluidas.values,
        backgroundColor: '#00bcd4',
      }]
    }
  });
  // Requisições por Setor
  new Chart(document.getElementById('chart-setor'), {
    type: 'bar',
    data: {
      labels: data.requisicoesSetor.labels,
      datasets: [{
        label: 'Setor',
        data: data.requisicoesSetor.values,
        backgroundColor: '#039be5',
      }]
    }
  });
}

// Inicialização automática ao carregar a página
window.addEventListener('DOMContentLoaded', async () => {
  try {
    const data = await fetchAIDashboardData();
    updateDashboardMetrics(data);
    renderCharts(data);
  } catch (e) {
    alert('Erro ao carregar dados do dashboard IA: ' + e.message);
  }
});
