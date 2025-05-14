# Customs Chatbot Build Guide

This guide explains the technical architecture, file structure, and end-to-end flow of the First Brands Group US Customs Chatbot. It is intended for developers and maintainers.

---

## 1. High-Level Architecture

- **Frontend:** React.js (Vite) SPA for user interaction
- **Backend:** Python Flask API (single endpoint)
- **External Service:** Azure ML Prompt Flow REST API (handles customs Q&A)

```
[User] ⇄ [Frontend (React)] ⇄ [Backend (Flask)] ⇄ [Azure ML Prompt Flow API]
```

---

## 2. Main File Structure & Responsibilities

### Frontend (`src/frontend/src/`)
- `App.jsx` – Main app container, loads chat UI
- `main.jsx` – React entry point
- `CustomsAgentChat.jsx` – Core chat UI, handles user input, message state, and API calls
- `ConnectionTest.jsx`/`CustomsAgentTest.jsx` – Utilities for testing API connectivity
- `styles.css`, `App.css` – UI styling
- `cross-rulings-styles.css` – Specific styling for CROSS rulings display in markdown format

### Backend
- `api/customs/ask.js` – Serverless function exposing `/api/customs/ask` endpoint for Vercel deployment
- `src/backend/src/server.py` – Flask app for local development
- `src/backend/src/router/customs_router.py` – Legacy router for local development
- `src/backend/src/utils.py`, other `router/*.py` – Utilities and legacy routing
- `src/backend/src/scraper.py` – Fetches U.S. Customs CROSS rulings via the official JSON API
- `prompt_flow_update.md` – Contains the updated prompt instructions for Azure Prompt Flow

---

## 3. Overall Process Flow

Here's a step-by-step overview of how a user query is processed:

1.  **User Input (Frontend):** The user types a message into the chat interface (`CustomsAgentChat.jsx`).
2.  **API Request (Frontend):** React captures the message and sends a POST request to the serverless function endpoint (`/api/customs/ask`).
3.  **Request Reception (Backend):** The serverless function (`api/customs/ask.js`) receives the request.
4.  **Classification Check (Backend):** The serverless function analyzes the message to determine if it's a classification question.
    *   **If Classification Question:**
        *   The function extracts the search term from the message.
        *   If a term is found, the function queries the CROSS API directly.
        *   The API returns relevant ruling data (number, date, subject, tariffs).
        *   The function formats this data as a markdown table directly in the question.
    *   **If Not Classification Question:** The CROSS data retrieval step is skipped.
5.  **Azure Prompt Flow Payload (Backend):** The serverless function prepares a JSON payload containing the user question (with CROSS rulings included in the question itself) and any additional contexts. Credentials are loaded from environment variables.
6.  **Azure Prompt Flow Call (Backend):** An HTTPS POST request is made to the Azure Prompt Flow endpoint with the payload and authentication headers.
7.  **AI Processing (Azure):** The Azure Prompt Flow executes its logic using the provided question (which now includes the CROSS rulings table).
8.  **Response Reception (Backend):** The serverless function receives the JSON response from Azure.
9.  **Result Extraction (Backend):** The answer text is extracted from the Azure response.
10. **API Response (Backend):** The serverless function sends the extracted answer and CROSS rulings data back to the frontend in a JSON response.
11. **Display Result (Frontend):** React receives the response and displays the chatbot's answer in the chat interface, with CROSS rulings formatted as a markdown table.

---

## 4. Key Functions & Files

### Frontend
- **CustomsAgentChat.jsx**
  - `sendMessage()` – Handles input, calls backend, updates UI
  - Uses `axios.post('/api/customs/ask', { message })`
  - Renders markdown content including headings and tables
  - No longer displays CROSS rulings as a separate message
- **cross-rulings-styles.css**
  - Provides styling for markdown tables and headings
- **vite.config.js**
  - Sets up proxy for `/api` routes

### Backend
- **server.py**
  - `ask_customs()` – Flask route handler for `/api/customs/ask`
- **api/customs/ask.js**
  - Serverless function that handles requests
  - Queries CROSS API directly
  - Formats CROSS rulings as a markdown table in the question
  - Sends request to Azure ML, returns result
- **prompt_flow_update.md**
  - Contains updated instructions for Azure Prompt Flow
  - Specifies formatting for headings and CROSS rulings
- **scraper.py**
  - `search_cross_rulings(term, page_size)` – Queries the official U.S. Customs CROSS JSON API for rulings related to the search term.

---

## 5. Environment & Security
- Backend API key is stored in backend, never exposed to frontend
- All Azure ML calls are made server-side to avoid CORS and secret exposure
- Frontend never calls Azure ML directly

---

## 6. Troubleshooting
- 404 on `/api/customs/ask`: Backend not running or proxy misconfigured
- CORS error: Frontend tried to call Azure ML directly instead of backend
- API key error: Ensure backend `.env` is set up with the correct key

---

## 7. Extending the App
- To add new routes/logic, extend `server.py` and add new routers in `router/`
- For UI changes, edit `CustomsAgentChat.jsx` and related CSS

---

## 8. CROSS Ruling Integration

### Dependencies

The backend relies on several Python packages. Key dependencies include:

*   **Flask**: For the web server framework.
*   **requests**: For making HTTP calls to Azure Prompt Flow and the CROSS JSON API.
*   **python-dotenv**: For loading environment variables from the `.env` file.

Ensure all dependencies are installed using:
```bash
pip install -r src/backend/src/requirements.txt
```

### Configuration

The backend requires configuration for the Azure Prompt Flow endpoint and API key.

**Security Best Practice:** These credentials should NOT be hardcoded directly into the Python files. Instead, they are managed using a `.env` file located at `src/backend/src/.env`.

**`.env` File:**
Create this file (`src/backend/src/.env`) and add the following lines, replacing the placeholders with your actual credentials:

```dotenv
# src/backend/src/.env
AZURE_PROMPT_FLOW_ENDPOINT="YOUR_AZURE_PROMPT_FLOW_ENDPOINT_URL_HERE"
AZURE_PROMPT_FLOW_API_KEY="YOUR_AZURE_PROMPT_FLOW_API_KEY_HERE"
```

This file is included in `.gitignore` to prevent accidental commitment of secrets.
The `customs_router.py` module uses the `python-dotenv` library to load these variables automatically when the server starts.

### Backend Logic and Query Flow

#### CROSS Ruling Integration (for HTS Classification Questions)

To enhance responses for HTS classification queries, the serverless function now includes a step to query the official U.S. Customs CROSS JSON API:

1.  **Question Detection:** When a message is received by the serverless function (`api/customs/ask.js`), it checks if the message contains keywords related to HTS classification.
2.  **Search Term Extraction:** If detected as a classification question, the function extracts the search term from the message.
3.  **API Query:** If a search term is found, the function queries the CROSS API directly using axios.
4.  **Data Processing:** The function processes the API response to extract ruling numbers, dates, subjects, tariff codes, and other relevant details.
5.  **Markdown Formatting:** The function formats the CROSS rulings as a markdown table directly in the question sent to Azure Prompt Flow. The table follows this format:
   ```
   | DATE | RULING CATEGORY & TARIFF NO | RULING REFERENCE | RELATED |
   |------|---------------------------|-----------------|---------|  
   | 02/19/2014 | [N249681](https://rulings.cbp.gov/ruling/N249681)<br>Classification<br>8413.30.9030 | The tariff classification of fuel pumps from Germany. | |
   ```
6.  **Prompt Flow Instructions:** The Azure Prompt Flow is instructed to use the exact CROSS rulings provided in the question and format them in the same way in its response.
7.  **Frontend Display:** The frontend now renders the CROSS rulings as part of the main AI response using markdown, with proper styling for tables and headings.
8.  **Response Structure:** The AI response is now formatted with clear section headings (H2) for Product Analysis, HTS Classification Logic, CROSS Rulings Analysis, etc.

This integration allows the AI model in Azure Prompt Flow to consider relevant official rulings when generating answers to classification questions, improving accuracy and detail.

---

For further details, consult the main `README.md` or contact the project maintainers.
