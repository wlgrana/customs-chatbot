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
  const [connectionDetails, setConnectionDetails] = useState({
    connectionString: import.meta.env.VITE_US_CUSTOMS_AGENT_CONN_STR || "",
    assistantId: import.meta.env.VITE_US_CUSTOMS_AGENT_ID || "",
    threadId: import.meta.env.VITE_US_CUSTOMS_AGENT_THREAD_ID || "",
    apiKey: import.meta.env.VITE_US_CUSTOMS_AGENT_API_KEY || ""
  });

  // Extract connection details
  const [endpoint, workspace, deployment] = connectionDetails.connectionString.split(";");

  const handleTest = async () => {
    setLoading(true);
    setError("");
    setResponse("");

    try {
      // Log the connection details for debugging
      console.log("Endpoint:", endpoint);
      console.log("Assistant ID:", connectionDetails.assistantId);
      console.log("Thread ID:", connectionDetails.threadId);

      // First create a message in the thread
      const messageResponse = await axios.post(
        `https://${endpoint}/openai/threads/${connectionDetails.threadId}/messages?api-version=2023-03-15-preview`,
        {
          role: "user",
          content: input || "Hello, can you tell me about automotive parts import regulations?"
        },
        {
          headers: {
            "api-key": connectionDetails.apiKey,
            "Content-Type": "application/json"
          }
        }
      );
      
      console.log("Message created:", messageResponse.data);
      
      // Then run the assistant on the thread
      const runResponse = await axios.post(
        `https://${endpoint}/openai/threads/${connectionDetails.threadId}/runs?api-version=2023-03-15-preview`,
        {
          assistant_id: connectionDetails.assistantId
        },
        {
          headers: {
            "api-key": connectionDetails.apiKey,
            "Content-Type": "application/json"
          }
        }
      );
      
      console.log("Run created:", runResponse.data);
      const runId = runResponse.data.id;
      
      // Poll for run completion
      let runStatus = "queued";
      while (runStatus === "queued" || runStatus === "in_progress") {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        
        const runStatusResponse = await axios.get(
          `https://${endpoint}/openai/threads/${connectionDetails.threadId}/runs/${runId}?api-version=2023-03-15-preview`,
          {
            headers: {
              "api-key": connectionDetails.apiKey
            }
          }
        );
        
        runStatus = runStatusResponse.data.status;
        console.log("Run status:", runStatus);
        
        if (runStatus === "completed") {
          // Retrieve messages after run completion
          const messagesResponse = await axios.get(
            `https://${endpoint}/openai/threads/${connectionDetails.threadId}/messages?api-version=2023-03-15-preview`,
            {
              headers: {
                "api-key": connectionDetails.apiKey
              }
            }
          );
          
          console.log("Messages:", messagesResponse.data);
          
          // Get the latest assistant message
          const assistantMessages = messagesResponse.data.data.filter(
            msg => msg.role === "assistant"
          );
          
          if (assistantMessages.length > 0) {
            const latestMessage = assistantMessages[0].content[0].text.value;
            setResponse(latestMessage);
          } else {
            setError("No assistant response found");
          }
          break;
        } else if (runStatus === "failed") {
          setError("Run failed");
          break;
        }
      }
    } catch (err) {
      console.error("Error connecting to US Customs Agent:", err);
      setError(`Error: ${err.message}`);
      if (err.response) {
        console.error("Response data:", err.response.data);
        console.error("Response status:", err.response.status);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="customs-chat-ui test-container">
      <div className="chat-header">
        <h1>US Customs Agent Connection Test</h1>
      </div>
      
      <div className="connection-details">
        <h2>Connection Details</h2>
        <div className="detail-item">
          <label>Connection String:</label>
          <input 
            type="text" 
            value={connectionDetails.connectionString} 
            onChange={(e) => setConnectionDetails({...connectionDetails, connectionString: e.target.value})} 
            placeholder="Connection String" 
          />
        </div>
        
        <div className="detail-item">
          <label>Assistant ID:</label>
          <input 
            type="text" 
            value={connectionDetails.assistantId} 
            onChange={(e) => setConnectionDetails({...connectionDetails, assistantId: e.target.value})} 
            placeholder="Assistant ID" 
          />
        </div>
        
        <div className="detail-item">
          <label>Thread ID:</label>
          <input 
            type="text" 
            value={connectionDetails.threadId} 
            onChange={(e) => setConnectionDetails({...connectionDetails, threadId: e.target.value})} 
            placeholder="Thread ID" 
          />
        </div>
        
        <div className="detail-item">
          <label>API Key:</label>
          <input 
            type="password" 
            value={connectionDetails.apiKey} 
            onChange={(e) => setConnectionDetails({...connectionDetails, apiKey: e.target.value})} 
            placeholder="API Key" 
          />
        </div>
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
