import React, { useState } from "react";
import axios from "axios";
import { marked } from "marked";
import DOMPurify from "dompurify";
import "./styles.css";
// SECURITY: Always sanitize markdown output before using dangerouslySetInnerHTML!

function CopyIcon({ text }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <span className="copy-icon" onClick={handleCopy} title={copied ? 'Copied!' : 'Copy to clipboard'}>
      <svg height="18" width="18" viewBox="0 0 24 24" fill={copied ? '#388e3c' : '#888'}>
        <rect x="9" y="9" width="13" height="13" rx="2" fill="none" stroke={copied ? '#388e3c' : '#888'} strokeWidth="2"/>
        <rect x="3" y="3" width="13" height="13" rx="2" fill="none" stroke={copied ? '#388e3c' : '#888'} strokeWidth="2"/>
      </svg>
      {copied && <span className="copied-text">Copied!</span>}
    </span>
  );
}

// WARNING: Never hardcode secrets or API keys in source files!
// See .env.local for configuration.
const endpoint = import.meta.env.VITE_OPENAI_ENDPOINT;
const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
const apiVersion = import.meta.env.VITE_OPENAI_API_VERSION;

// Function to format CROSS rulings for display in a format similar to the CBP website
function formatCrossRulings(rulings) {
  if (!rulings || rulings.length === 0) {
    return "No specific CROSS rulings found.";
  }
  
  // Create a more detailed HTML table instead of markdown
  let formattedHtml = `
  <div class="cross-rulings-container">
    <table class="cross-rulings-table">
      <thead>
        <tr>
          <th>DATE</th>
          <th>
            RULING<br/>
            CATEGORY<br/>
            TARIFF NO
          </th>
          <th>RULING REFERENCE</th>
          <th>RELATED</th>
        </tr>
      </thead>
      <tbody>
  `;
  
  // Add each ruling as a row
  rulings.forEach(ruling => {
    const rulingNumber = ruling.rulingNumber || "N/A";
    
    // Format date as MM/DD/YYYY
    let formattedDate = "N/A";
    if (ruling.rulingDate) {
      const date = new Date(ruling.rulingDate);
      formattedDate = `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}/${date.getFullYear()}`;
    }
    
    // Format HTS codes with links
    let tariffLinks = "";
    if (ruling.tariffs && ruling.tariffs.length > 0) {
      tariffLinks = ruling.tariffs.map(tariff => {
        // Remove any colons that might be in the tariff code
        const cleanTariff = tariff.replace(/^:/, '');
        return `<a href="https://hts.usitc.gov/?query=${cleanTariff}" target="_blank" class="tariff-link">${cleanTariff}</a>`;
      }).join('<br/>');
    }
    
    // Extract subject
    const subject = ruling.subject || "N/A";
    
    formattedHtml += `
      <tr>
        <td>${formattedDate}</td>
        <td>
          <a href="https://rulings.cbp.gov/ruling/${rulingNumber}" target="_blank" class="ruling-link">${rulingNumber}</a><br/>
          ${ruling.categories || "Classification"}<br/>
          ${tariffLinks}
        </td>
        <td>${subject}</td>
        <td></td>
      </tr>
    `;
  });
  
  formattedHtml += `
      </tbody>
    </table>
  </div>
  `;
  
  return formattedHtml;
}

function CustomsAgentChat() {
  const [showSources, setShowSources] = useState(true);

  // Set up messages with only the visible welcome message
  const [messages, setMessages] = useState([
    { 
      role: "assistant", 
      content: "Welcome to First Brands Group Customs Agent! I can help with questions about automotive parts import/export regulations, HTS codes, customs documentation, and more. How can I assist you today?",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [abortController, setAbortController] = useState(null);
  const chatWindowRef = React.useRef(null);

  // Function to scroll to bottom of chat window
  const scrollToBottom = () => {
    if (chatWindowRef.current) {
      chatWindowRef.current.scrollTop = chatWindowRef.current.scrollHeight;
    }
  };

  // Effect to scroll to bottom when messages change
  React.useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim()) return;
    const now = new Date();
    const timestamp = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // If source attribution is enabled, append request for sources
    let userContent = input;
    if (showSources) {
      userContent = `${input}\n\nPlease include the specific documents or sections from the US Customs Rules collection that your answer is based on. If using general knowledge, clearly state this.`;
    }
    
    const userMsg = { role: "user", content: userContent, timestamp, displayContent: input };
    setMessages((msgs) => [...msgs, userMsg]);
    setLoading(true);
    const controller = new AbortController();
    setAbortController(controller);
    try {
      const response = await axios.post(
  "/api/customs/ask",
  {
    message: input
  },
  {
    signal: controller.signal
  }
);
      const backendResponse = response.data;
      const replyTimestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      if (backendResponse.kind === "customs_agent_screenshot_result" && backendResponse.image_url) {
        setMessages((msgs) => [...msgs, {
          role: "assistant",
          kind: backendResponse.kind,
          content: backendResponse.message || "Please see the screenshot below.",
          imageUrl: backendResponse.image_url,
          searchUrlUsed: backendResponse.search_url_used,
          timestamp: replyTimestamp
        }]);
      } else if (backendResponse.result) { // Handles existing text results or new text_result kind
        // If we have CROSS rulings, display them first
        if (backendResponse.cross_rulings && backendResponse.cross_rulings.length > 0) {
          // Format the CROSS rulings into a readable format
          const formattedRulings = formatCrossRulings(backendResponse.cross_rulings);
          
          // Add the CROSS rulings as a separate message
          setMessages((msgs) => [...msgs, {
            role: "assistant",
            kind: "cross_rulings_info",
            content: "I found the following U.S. Customs CROSS rulings that may be relevant:",
            crossRulings: backendResponse.cross_rulings,
            formattedRulings: formattedRulings,
            timestamp: replyTimestamp
          }]);
          
          // Small delay before showing AI response
          setTimeout(() => {
            setMessages((msgs) => [...msgs, {
              role: "assistant",
              kind: backendResponse.kind || "customs_agent_text_result",
              content: backendResponse.result,
              raw: backendResponse.result,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }]);
          }, 500);
        } else {
          // No CROSS rulings, just show the AI response
          setMessages((msgs) => [...msgs, {
            role: "assistant",
            kind: backendResponse.kind || "customs_agent_text_result",
            content: backendResponse.result,
            raw: backendResponse.result,
            timestamp: replyTimestamp
          }]);
        }
      } else if (backendResponse.error) {
        setMessages((msgs) => [...msgs, {
          role: "assistant",
          kind: "error",
          content: `Error: ${backendResponse.error}`,
          raw: `Error: ${backendResponse.error}`,
          timestamp: replyTimestamp
        }]);
      } else {
        setMessages((msgs) => [...msgs, {
          role: "assistant",
          kind: "unknown_response",
          content: "No recognized response received from the agent.",
          raw: "No recognized response received from the agent.",
          timestamp: replyTimestamp
        }]);
      }
    } catch (err) {
      if (axios.isCancel(err)) {
        console.log('Request canceled:', err.message);
        // Optionally, add a message to UI indicating cancellation
        // setMessages((msgs) => [...msgs, { role: "assistant", content: "Request stopped by user." }]);
      } else {
        setMessages((msgs) => [...msgs, { role: "assistant", content: "Sorry, there was an error contacting the US Customs Agent." }]);
      }
    } finally {
      setLoading(false);
      setInput("");
      setAbortController(null);
    }
  };

  const stopRequest = () => {
    if (abortController) {
      abortController.abort();
      setLoading(false);
      setAbortController(null);
    }
  };

  return (
    <div className="customs-chat-ui">
      <div className="chat-header">
        <img src="/fbg-logo.png" alt="FBG Logo" className="header-logo" />
        <div className="header-text">
          <h1>First Brands Group Customs Agent</h1>
          <p>Ask about automotive parts import/export regulations, HTS codes, and more.</p>
        </div>
        {/* <div className="chat-settings">
          <label className="source-toggle">
            <input
              type="checkbox"
              checked={showSources}
              onChange={() => setShowSources(!showSources)}
            />
            <span>Show Sources</span>
          </label>
        </div> */}
      </div>
      <div className="chat-window" ref={chatWindowRef}>
        {messages
          .filter(msg => msg.role !== "system") /* Hide system messages */
          .map((msg, idx) => {
          const isUser = msg.role === "user";
          const isAgent = msg.role === "assistant";
          return (
            <div key={idx} className={`message ${isUser ? 'my-message' : 'agent-message'}`}>
              <div className="message-content">
                {/* Avatar */}
                <div className={`avatar ${isUser ? 'user-avatar' : 'agent-avatar'}`}>
                  {isUser ? (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                      <path d="M20 9V7c0-1.1-.9-2-2-2h-3c0-1.66-1.34-3-3-3S9 3.34 9 5H6c-1.1 0-2 .9-2 2v2c-1.66 0-3 1.34-3 3s1.34 3 3 3v4c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-4c1.66 0 3-1.34 3-3s-1.34-3-3-3zm-2 10H6V7h12v12zm-9-6c-.83 0-1.5-.67-1.5-1.5S8.17 10 9 10s1.5.67 1.5 1.5S9.83 13 9 13zm7.5-1.5c0 .83-.67 1.5-1.5 1.5s-1.5-.67-1.5-1.5.67-1.5 1.5-1.5 1.5.67 1.5 1.5zM8 15h8v2H8v-2z"/>
                    </svg>
                  )}
                </div>
                {/* Bubble */}
                <div className={`bubble-container ${isUser ? 'user-bubble-container' : 'agent-bubble-container'}`}>
                  <div className={`bubble-inner ${isUser ? 'user-bubble-inner' : 'agent-bubble-inner'}`}>
                    <div className={`bubble ${isUser ? 'user-bubble' : 'agent-bubble'}`}>
                      {isAgent ? (
                        msg.kind === "customs_agent_screenshot_result" && msg.imageUrl ? (
                          <>
                            <span dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(marked.parse(msg.content || "")) }} />
                            <img 
                              src={msg.imageUrl} 
                              alt="CROSS Search Result Screenshot" 
                              style={{ maxWidth: '100%', maxHeight: '400px', marginTop: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
                            />
                            {msg.searchUrlUsed && (
                              <p style={{fontSize: '0.8em', color: '#777', marginTop: '5px', wordBreak: 'break-all'}}>
                                Source URL: <a href={msg.searchUrlUsed} target="_blank" rel="noopener noreferrer">{msg.searchUrlUsed}</a>
                              </p>
                            )}
                          </>
                        ) : msg.kind === "cross_rulings_info" && msg.formattedRulings ? (
                          <>
                            <div className="cross-rulings-header" style={{ marginBottom: '10px', fontWeight: 'bold', color: '#2c3e50' }}>
                              <span dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(marked.parse(msg.content || "")) }} />
                            </div>
                            <div className="cross-rulings-table" style={{ backgroundColor: '#f8f9fa', padding: '10px', borderRadius: '4px', border: '1px solid #e9ecef' }}>
                              <span dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(marked.parse(msg.formattedRulings || "")) }} />
                            </div>
                            <p style={{fontSize: '0.8em', color: '#777', marginTop: '5px'}}>
                              Source: <a href="https://rulings.cbp.gov/" target="_blank" rel="noopener noreferrer">U.S. Customs and Border Protection CROSS</a>
                            </p>
                          </>
                        ) : (
                          <span dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(marked.parse(msg.content || "")) }} />
                        )
                      ) : (
                        <span>{msg.displayContent || msg.content}</span>
                      )}
                    </div>
                    {isUser && (
                      <div className="user-metadata">
                        <span className="timestamp">{msg.timestamp}</span>
                        {msg.content && <CopyIcon text={msg.content} />}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {isAgent && (
                <div className="agent-metadata">
                  <span className="timestamp">{msg.timestamp}</span>
                  {msg.content && <CopyIcon text={msg.content} />}
                </div>
              )}
            </div>
          );
        })}
        {loading && <div className="typing-indicator">Agent is thinking<span className="ellipsis"><span>.</span><span>.</span><span>.</span></span></div>}
      </div>
      <div className="input-area">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !loading && sendMessage()}
          disabled={loading}
          className="chat-input"
          placeholder="Type your automotive parts customs question..."
        />
        {loading ? (
          <button onClick={stopRequest} className="stop-button">
            Stop
          </button>
        ) : (
          <button onClick={sendMessage} disabled={!input.trim()} className="send-button">
            Send
          </button>
        )}
      </div>
    </div>
  );
}

export default CustomsAgentChat;