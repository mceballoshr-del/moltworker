import React, { useState, useEffect } from 'react';
import './NexusCortex.css';

interface NexusCortexProps {
  steps: any[];
  isRunning: boolean;
  onSkillSuggested: (skill: any) => void;
}

const NexusCortex: React.FC<NexusCortexProps> = ({ steps, isRunning, onSkillSuggested }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [modelLoad, setModelLoad] = useState<Record<string, number>>({});
  const [divergence, setDivergence] = useState(0);
  const [toolChain, setToolChain] = useState<any[]>([]);
  const [emergentCapability, setEmergentCapability] = useState<any>(null);

  useEffect(() => {
    const modelLoadMonitor: Record<string, number> = {};
    steps.forEach((step) => {
      if (step.type === 'model') {
        const modelName = step.model;
        if (!modelLoadMonitor[modelName]) {
          modelLoadMonitor[modelName] = 0;
        }
        modelLoadMonitor[modelName]++;
      }
    });
    setModelLoad(modelLoadMonitor);
  }, [steps]);

  useEffect(() => {
    const consensusDivergenceMeter = async () => {
      const responses = steps.filter((step) => step.type === 'result').map((step) => step.content);
      const divergenceResponse = await fetch('/api/nexus/divergence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responses }),
      });
      const divergenceData = await divergenceResponse.json() as { divergence: number };
      setDivergence(divergenceData.divergence);
    };
    consensusDivergenceMeter();
  }, [steps]);

  useEffect(() => {
    const toolChainVisualizer: any[] = [];
    steps.forEach((step) => {
      if (step.type === 'tool') {
        toolChainVisualizer.push(step);
      }
    });
    setToolChain(toolChainVisualizer);
  }, [steps]);

  useEffect(() => {
    const emergentCapabilitySuggester = async () => {
      const lastSynthesis = steps.find((step) => step.type === 'synthesis');
      if (lastSynthesis) {
        const suggestionResponse = await fetch('/api/nexus/suggest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ synthesis: lastSynthesis.content }),
        });
        const suggestionData = await suggestionResponse.json() as any;
        setEmergentCapability(suggestionData);
      }
    };
    emergentCapabilitySuggester();
  }, [steps]);

  const handleCollapse = () => {
    setCollapsed(!collapsed);
  };

  return (
    <div className={`nexus-cortex ${collapsed ? 'collapsed' : ''}`}>
      <header onClick={handleCollapse}>
        <span>🧠 NEXUS CORTEX</span>
      </header>
      <div className="nexus-cortex-content">
        <div className="module">
          <h2>Model Load Monitor</h2>
          <ul>
            {Object.keys(modelLoad).map((modelName) => (
              <li key={modelName}>
                <span>{modelName}</span>
                <span>{modelLoad[modelName]}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="module">
          <h2>Consensus Divergence Meter</h2>
          <svg width="100" height="100">
            <circle cx="50" cy="50" r="40" fill="none" stroke="#00ff88" strokeWidth="10" />
            <text x="50" y="50" textAnchor="middle" fill="#00ff88">
              {divergence}
            </text>
          </svg>
        </div>
        <div className="module">
          <h2>Tool Chain Visualizer</h2>
          <ul>
            {toolChain.map((tool, index) => (
              <li key={index}>
                <span>{tool.content}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="module">
          <h2>Emergent Capability Suggester</h2>
          {emergentCapability && (
            <div>
              <span>{emergentCapability.skill_name}</span>
              <button onClick={() => onSkillSuggested(emergentCapability)}>+ Add to Skills</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NexusCortex;