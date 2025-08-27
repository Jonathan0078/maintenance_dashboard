import React, { useState } from 'react';
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
          style={{ padding: '10px 20px', borderRadius: '4px', background: '#007bff', color: '#fff', border: 'none', cursor: 'pointer' }}
        >
          {loading ? 'Consulting AI...' : 'Ask AI'}
        </button>
        {error && <div style={{ color: 'red', marginTop: '10px' }}>{error}</div>}
      </section>

      <section style={{ border: '1px solid #eee', padding: '20px', borderRadius: '8px' }}>
        <h2 style={{ color: '#555' }}>AI Response</h2>
        <pre style={{ background: '#f8f8f8', padding: '10px', borderRadius: '4px', minHeight: '60px' }}>{aiResponse}</pre>
      </section>
    </div>
  );
}

export default App;