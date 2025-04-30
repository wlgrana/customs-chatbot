import React, { useState } from "react";
import axios from "axios";
import DOMPurify from "dompurify";
import { marked } from "marked";
import "./styles.css";

function CustomsAgentTest() {
  const [input, setInput] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleTest = async () => {
    setLoading(true);
    setError("");
    setResponse("");

    try {
      // Call the new backend endpoint for the Prompt Flow API
      const res = await axios.post("/api/customs/ask", {
        message: input || "Hello, can you tell me about automotive parts import regulations?"
      });
      setResponse(res.data.result);
    } catch (err) {
      setError("Error: " + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="customs-chat-ui test-container">
      <div className="chat-header">
        <h1>US Customs Agent Connection Test</h1>
      </div>
      
      <div className="test-input">
        <h2>Test Message</h2>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Enter a test message (optional)"
        />
        <div className="predefined-tests">
          <h3>Test Document Knowledge</h3>
          <p>Click on any test question to verify if the AI is using document data:</p>
          <div className="test-buttons">
            <button 
              onClick={() => setInput("What are the specific HTS codes for brake components from First Brands Group?")}
              className="test-question-btn"
            >
              Test HTS Codes Knowledge
            </button>
            <button 
              onClick={() => setInput("What documentation is required for importing FRAM oil filters?")}
              className="test-question-btn"
            >
              Test Documentation Requirements
            </button>
            <button 
              onClick={() => setInput("What are the country of origin requirements for Raybestos brake parts?")}
              className="test-question-btn"
            >
              Test Origin Requirements
            </button>
            <button 
              onClick={() => setInput("How do recent US-Mexico-Canada Agreement changes affect automotive parts duties?")}
              className="test-question-btn"
            >
              Test Trade Agreement Knowledge
            </button>
            <button 
              onClick={() => setInput("What did the Secretary of Commerce find regarding automobile parts imports under Section 232 of the Trade Expansion Act?")}
              className="test-question-btn special-test"
            >
              Test Section 232 Document Knowledge
            </button>
          </div>
        </div>
      </div>
      
      <button 
        onClick={handleTest} 
        disabled={loading} 
        className="test-button"
      >
        {loading ? "Testing..." : "Test Connection"}
      </button>
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
      
      {response && (
        <div className="response-container">
          <h2>Response:</h2>
          <div className="response-content" dangerouslySetInnerHTML={{ 
            __html: DOMPurify.sanitize(marked.parse(response)) 
          }} />
        </div>
      )}
    </div>
  );
}

export default CustomsAgentTest;
