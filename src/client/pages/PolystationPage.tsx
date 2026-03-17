import { useState } from 'react';
import './PolystationPage.css';

type Result = { model: string; response: string; time: number };

export default function PolystationPage() {
  const [prompt, setPrompt] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);

  const query = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    try {
      const r = await fetch('/api/polystation/query', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ prompt })
      });
      const d = await r.json();
      setResults(d.results || []);
    } catch(e) { console.error(e); }
    setLoading(false);
  };

  return (
    <div className="poly-page">
      <h2>Polystation - Multi-Model AI</h2>
      <div className="poly-input">
        <textarea value={prompt} onChange={e => setPrompt(e.target.value)}
          placeholder="Enter your prompt..." rows={4} />
        <button onClick={query} disabled={loading}>
          {loading ? 'Querying...' : 'Query All Models'}
        </button>
      </div>
      <div className="poly-results">
        {results.map((r, i) => (
          <div key={i} className="poly-card">
            <h3>{r.model.split('/').pop()}</h3>
            <span className="poly-time">{r.time}ms</span>
            <pre>{r.response}</pre>
          </div>
        ))}
      </div>
    </div>
  );
}
