// Vercel Serverless Function for /api/customs/ask
const axios = require('axios');

// Azure Prompt Flow endpoint and API key
const endpoint = process.env.AZURE_PROMPT_FLOW_ENDPOINT || "https://us-customs-rules-vnvgf.eastus2.inference.ml.azure.com/score";
const apiKey = process.env.AZURE_PROMPT_FLOW_API_KEY || "CEaudbB30Gj5ugzLgFNVPHuqchxZS1OKeGc9zKhdnBlq2SyeZvhQJQQJ99BDAAAAAAAAAAAAINFRAZML3GBK";

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle OPTIONS request for CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const message = req.body.message;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Call the Azure Prompt Flow endpoint
    const response = await axios.post(
      endpoint,
      { question: message },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        }
      }
    );

    // Log response for debugging (these logs will appear in Vercel logs)
    console.log("STATUS CODE:", response.status);
    
    if (response.status === 200) {
      const result = response.data;
      console.log("PARSED JSON:", result);

      const outputText = result.output || result.answer || "[No output or answer field in response]";

      return res.status(200).json({
        kind: "customs_agent_result",
        result: outputText,
        history: [],
        error: null
      });
    } else {
      return res.status(response.status).json({
        kind: "customs_agent_result",
        result: null,
        history: [],
        error: `Error ${response.status}: ${response.statusText}`
      });
    }
  } catch (error) {
    console.error("Error calling customs API:", error);
    return res.status(500).json({
      kind: "customs_agent_result",
      result: null,
      history: [],
      error: error.message || "An unknown error occurred"
    });
  }
};
