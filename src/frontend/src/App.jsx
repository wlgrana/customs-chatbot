// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
import './App.css';
import React from 'react';
import CustomsAgentChat from './CustomsAgentChat';
import ConnectionTest from './ConnectionTest';
import './styles.css';

function App() {
  document.documentElement.lang = 'en';
  const [showTest, setShowTest] = React.useState(false);
  return (
    <div>
      {/* Connection test button hidden as requested */}
      {showTest && <ConnectionTest />}
      <CustomsAgentChat />
    </div>
  );
}

export default App;
