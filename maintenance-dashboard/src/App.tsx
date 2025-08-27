import React, { useState, useEffect } from 'react';
// Mock API para servir dados do dashboard IA (apenas em dev)
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  const originalFetch = window.fetch;
  window.fetch = function(input: RequestInfo, init?: RequestInit) {
    if (typeof input === 'string' && input.includes('/ai-dashboard-data')) {
      const mockData = {
        totalRequisicoes: 85,
        concluidas: 46,
        percentConclusao: 54,
        emAberto: 26,
        programadas: 11,
        canceladas: 26,
        tempoMedio: 34,
        requisicoesRecebidas: { labels: ['jan','fev','mar','abr','mai','jun'], values: [16,4,14,15,16,20] },
        requisicoesNatureza: { labels: ['Mecânica','Elétrica','Predial','Oficina'], values: [43,22,10,10] },
        requisicoesTipo: { labels: ['Corretiva','Preventiva','Preditiva'], values: [59,13,13] },
        leadTime: { labels: ['0-5','6-10','11-20','20-30','+30'], values: [7,43,5,4,26] },
        requisicoesConcluidas: { labels: ['jan','fev','mar','abr','mai','jun'], values: [5,5,9,10,6,12] },
        requisicoesSetor: { labels: ['Produção','Serviços','PCP','Expedição','Almoxarifado','Garantia','Compras','Manutenção'], values: [12,11,11,11,11,9,9,9] }
      };
      return Promise.resolve(new Response(JSON.stringify(mockData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }));
    }
    return originalFetch(input, init);
  };
}

// Exemplo de integração real com a IA (Hugging Face)
// Você pode criar uma função para gerar um prompt e chamar queryHuggingFace
// Exemplo:
// async function getDashboardDataFromAI() {
//   const prompt = `Gere um JSON com os seguintes campos para um dashboard de manutenção:
//   totalRequisicoes, concluidas, percentConclusao, emAberto, programadas, canceladas, tempoMedio,
//   requisicoesRecebidas (labels: jan a jun, values: 6 valores),
//   requisicoesNatureza (labels: Mecânica, Elétrica, Predial, Oficina, values: 4 valores),
//   requisicoesTipo (labels: Corretiva, Preventiva, Preditiva, values: 3 valores),
//   leadTime (labels: 0-5, 6-10, 11-20, 20-30, +30, values: 5 valores),
//   requisicoesConcluidas (labels: jan a jun, values: 6 valores),
//   requisicoesSetor (labels: Produção, Serviços, PCP, Expedição, Almoxarifado, Garantia, Compras, Manutenção, values: 8 valores).
//   Os valores devem ser realistas para um setor industrial.`;
//   const response = await queryHuggingFace(prompt);
//   // Parseie o JSON retornado pela IA e use no dashboard
//   return response;
// }
import { queryHuggingFace } from './services/huggingFaceService';

function App() {
  const [inputText, setInputText] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleQuery = async () => {
    setLoading(true);
    setError(null);
    setAiResponse('');
    try {
      const response = await queryHuggingFace(inputText);
      setAiResponse(JSON.stringify(response, null, 2));
    } catch (err: any) {
      console.error("Error querying Hugging Face:", err);
      setError(err.message || "An unknown error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="App" style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <header className="App-header" style={{ marginBottom: '20px' }}>
        <h1 style={{ color: '#333' }}>Maintenance Dashboard</h1>
        <p style={{ color: '#666' }}>AI Assistant for Maintenance Insights</p>
      </header>

      <section style={{ marginBottom: '30px', border: '1px solid #eee', padding: '20px', borderRadius: '8px' }}>
        <h2 style={{ color: '#555' }}>Ask the AI Assistant</h2>
        <textarea
          style={{ width: '100%', minHeight: '80px', padding: '10px', marginBottom: '10px', borderRadius: '4px', border: '1px solid #ccc' }}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Ask about maintenance data, e.g., 'Is the machine running efficiently?'"
        />
        <button
          onClick={handleQuery}
          disabled={loading || !inputText.trim()}
          style={{
            padding: '10px 20px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: loading || !inputText.trim() ? 'not-allowed' : 'pointer',
            opacity: loading || !inputText.trim() ? 0.6 : 1,
          }}
        >
          {loading ? 'Thinking...' : 'Ask AI'}
        </button>
      </section>

      <section style={{ border: '1px solid #eee', padding: '20px', borderRadius: '8px', backgroundColor: '#f9f9f9' }}>
        <h2 style={{ color: '#555' }}>AI Response</h2>
        {error && <p style={{ color: 'red' }}>Error: {error}</p>}
        {aiResponse ? (
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', backgroundColor: '#e9e9e9', padding: '10px', borderRadius: '4px' }}>
            {aiResponse}
          </pre>
        ) : (
          !loading && <p style={{ color: '#888' }}>No response yet. Ask a question!</p>
        )}
      </section>
    </div>
  );
}

export default App;
