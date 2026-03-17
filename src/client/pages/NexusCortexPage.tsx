import { useState } from "react";
import NexusCortex from "../components/NexusCortex";
import "./NexusCortexPage.css";

export default function NexusCortexPage() {
  const [hydraSteps, setHydraSteps] = useState<any[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const handleSkillSuggested = (skill: any) => {
    console.log('New skill:', skill);
    // Lógica para agregar el skill a la lista de skills
  };

  return (
    <div className="nexus-cortex-page">
      <div className="nexus-cortex-header">
        <h2>NEXUS CORTEX</h2>
        <p className="nexus-cortex-desc">Advanced AI monitoring and analysis system</p>
      </div>
      <div className="nexus-cortex-content">
        <NexusCortex
          steps={hydraSteps}
          isRunning={isRunning}
          onSkillSuggested={handleSkillSuggested}
        />
        <div className="nexus-cortex-main">
          <div className="nexus-info">
            <h3>System Status</h3>
            <p>Monitor real-time AI model performance, consensus analysis, and emergent capabilities.</p>
            <div className="status-indicators">
              <div className="status-item">
                <span className="status-dot active"></span>
                <span>Model Monitoring Active</span>
              </div>
              <div className="status-item">
                <span className="status-dot active"></span>
                <span>Consensus Analysis Online</span>
              </div>
              <div className="status-item">
                <span className="status-dot standby"></span>
                <span>Capability Suggester Ready</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}