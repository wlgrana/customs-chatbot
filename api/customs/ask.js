// Vercel Serverless Function for /api/customs/ask
const axios = require('axios');

// Azure Prompt Flow endpoint and API key
const endpoint = process.env.AZURE_PROMPT_FLOW_ENDPOINT || "https://us-customs-rules-vnvgf.eastus2.inference.ml.azure.com/score";
const apiKey = process.env.AZURE_PROMPT_FLOW_API_KEY || "CEaudbB30Gj5ugzLgFNVPHuqchxZS1OKeGc9zKhdnBlq2SyeZvhQJQQJ99BDAAAAAAAAAAAAINFRAZML3GBK";

// CROSS API URL
const CROSS_API_URL = "https://rulings.cbp.gov/api/search";

// Classification keywords to detect classification questions
const CLASSIFICATION_KEYWORDS = [
  "hts", "classification", "classify", "tariff code", "customs code",
  "heading", "subheading", "htsus", "harmonized code"
];

// Debug info
console.log("Using endpoint:", endpoint);

// Function to check if a message is a classification question
function isClassificationQuestion(message) {
  if (!message) return false;
  const regex = new RegExp('\\b(' + CLASSIFICATION_KEYWORDS.join('|') + ')\\b', 'i');
  return regex.test(message);
}

// Function to extract search term from message
function extractSearchTerm(message) {
  if (!message) return null;
  
  // Patterns to extract item names from classification questions
  const patterns = [
    /(?:classification of|classify|hts for|tariff code for|code for)\s+(?:the\s+|a\s+|an\s+)?(.+?)(?:\?|$|\s+under|\s+in\b)/i,
    /what is the\s+(?:hts|classification|tariff code|code)\s+(?:of|for)\s+(?:the\s+|a\s+|an\s+)?(.+?)(\?|$)/i,
    new RegExp('\\b(' + CLASSIFICATION_KEYWORDS.join('|') + ')\\s+(?:of|for)?\\s*(?:the\\s+|a\\s+|an\\s+)?([\\w\\s\\-]+?)(\\?|$)', 'i')
  ];
  
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match) {
      for (let i = match.length - 1; i > 0; i--) {
        const term = match[i];
        if (term && term.trim()) {
          const cleanedTerm = term.trim().replace(/[.,;:!?()"']/g, '');
          if (!CLASSIFICATION_KEYWORDS.some(keyword => cleanedTerm.toLowerCase() === keyword)) {
            console.log(`Extracted search term: '${cleanedTerm}' using pattern: ${pattern}`);
            return cleanedTerm.trim();
          }
        }
      }
    }
  }
  
  console.log(`No search term extracted from: '${message.substring(0, 100)}...'`);
  return null;
}

// Function to search CROSS rulings
async function searchCrossRulings(term, pageSize = 3) {
  console.log(`Searching CROSS rulings for: '${term}' (max ${pageSize} results)...`);
  
  const params = {
    term: term,
    collection: "ALL",
    pageSize: pageSize,
    page: 1,
    sortBy: "RELEVANCE"
  };
  
  const headers = {
    "Accept": "application/json"
  };
  
  try {
    console.log(`Querying CROSS API: ${CROSS_API_URL} with params:`, params);
    const response = await axios.get(CROSS_API_URL, { params, headers, timeout: 30000 });
    const data = response.data;
    const items = data.rulings || [];
    console.log(`Retrieved ${items.length} items for term '${term}'.`);
    return items;
  } catch (error) {
    console.error(`Error searching CROSS rulings: ${error.message}`);
    throw error;
  }
}

// Function to format CROSS rulings for context
function formatCrossRulingsForContext(rulings, maxToFormat = 3) {
  if (!rulings || rulings.length === 0) {
    return "No specific CROSS rulings found.";
  }
  
  // Format as a markdown table specifically for the Prompt Flow to recognize and use directly
  let formattedText = "CROSS_RULINGS_DATA_START\n";
  formattedText += "| Ruling # | Date | HTS | Country | URL |\n";
  formattedText += "|---------|------|-----|---------|-----|\n";
  
  for (let i = 0; i < Math.min(rulings.length, maxToFormat); i++) {
    const ruling = rulings[i];
    const rulingNumber = ruling.rulingNumber || "N/A";
    
    // Format date as MM/DD/YYYY
    let formattedDate = "N/A";
    if (ruling.rulingDate) {
      const date = new Date(ruling.rulingDate);
      formattedDate = `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}/${date.getFullYear()}`;
    }
    
    // Format HTS codes
    const hts = ruling.tariffs && ruling.tariffs.length > 0 ? ruling.tariffs.join(', ') : "N/A";
    
    // Extract country from subject if possible
    let country = "N/A";
    if (ruling.subject) {
      const countryMatch = ruling.subject.match(/from\s+([\w\s]+)(?:\.|$)/i);
      if (countryMatch && countryMatch[1]) {
        country = countryMatch[1].trim();
      }
    }
    
    // Create URL column with the ruling number as the value
    const url = rulingNumber;
    
    formattedText += `| ${rulingNumber} | ${formattedDate} | ${hts} | ${country} | ${url} |\n`;
  }
  
  formattedText += "CROSS_RULINGS_DATA_END";
  
  return formattedText;
}

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
    console.log("Request body:", req.body);
    
    const message = req.body?.message;
    
    console.log("Extracted message:", message);

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    let aiContexts = "";
    let crossRulings = [];

    // Check if it's a classification question and fetch CROSS rulings if it is
    if (isClassificationQuestion(message)) {
      console.log("Message identified as classification question:", message.substring(0, 100));
      const searchTerm = extractSearchTerm(message);
      
      if (searchTerm) {
        console.log(`Extracted search term: '${searchTerm}' for API call.`);
        try {
          crossRulings = await searchCrossRulings(searchTerm, 3);
          
          if (crossRulings && crossRulings.length > 0) {
            console.log(`Successfully retrieved ${crossRulings.length} rulings from API for '${searchTerm}'.`);
            aiContexts = formatCrossRulingsForContext(crossRulings, 3);
            console.log("Formatted CROSS rulings for context:", aiContexts);
          } else {
            console.log(`No rulings returned from API for '${searchTerm}'.`);
            aiContexts = `No specific U.S. Customs CROSS rulings were found for '${searchTerm}'.`;
          }
        } catch (error) {
          console.error(`Error fetching CROSS rulings: ${error.message}`);
          aiContexts = `Error retrieving CROSS rulings for '${searchTerm}': ${error.message}`;
        }
      } else {
        console.log("No search term extracted from classification question. AI will rely on general knowledge.");
        aiContexts = "Note: A specific item for CROSS ruling search was not identified in the query.";
      }
    } else {
      console.log("Message not identified as a classification question. No CROSS ruling search will be performed.");
    }

    // Prepare payload for Azure Prompt Flow with CROSS rulings context
    const payload = {
      question: message,
      contexts: aiContexts
    };

    console.log("Sending payload to Azure ML:", payload);

    // Call the Azure Prompt Flow endpoint with the enhanced context
    const response = await axios.post(
      endpoint,
      payload,
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
        cross_rulings: crossRulings,
        history: [],
        error: null
      });
    } else {
      return res.status(response.status).json({
        kind: "customs_agent_result",
        result: null,
        cross_rulings: [],
        history: [],
        error: `Error ${response.status}: ${response.statusText}`
      });
    }
  } catch (error) {
    console.error("Error processing request:", error);
    console.error("Error details:", {
      message: error.message,
      stack: error.stack,
      response: error.response ? {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      } : 'No response data'
    });
    
    return res.status(500).json({
      kind: "customs_agent_result",
      result: null,
      cross_rulings: [],
      history: [],
      error: error.message || "An unknown error occurred"
    });
  }
};
