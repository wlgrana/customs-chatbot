// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
import './App.css';
import React from 'react';
import CustomsAgentChat from './CustomsAgentChat';
import ConnectionTest from './ConnectionTest';
import CustomsAgentTest from './CustomsAgentTest';
import './styles.css';

function App() {
  document.documentElement.lang = 'en';
  // Default to chat view only - navigation hidden per requirements
  const [view] = React.useState('chat'); // Fixed to 'chat' view
  
  return (
    <div className="app-container">
      {/* Navigation bar hidden per user request */}
      
      {view === 'chat' && <CustomsAgentChat />}
      {view === 'test' && <ConnectionTest />}
      {view === 'agent-test' && <CustomsAgentTest />}
    </div>
  );
}

export default App;
