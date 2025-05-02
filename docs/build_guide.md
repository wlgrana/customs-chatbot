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

### Backend (`src/backend/src/`)
- `server.py` – Flask app exposing `/api/customs/ask` endpoint
- `router/customs_router.py` – Forwards user questions to Azure ML Prompt Flow API
- `utils.py`, other `router/*.py` – Utilities and legacy/alternate routing (not used in default flow)
- `scraper.py` – New module for scraping U.S. Customs CROSS rulings

---

## 3. Overall Process Flow

Here's a step-by-step overview of how a user query is processed:

1.  **User Input (Frontend):** The user types a message into the chatbot interface (`frontend/index.html`).
2.  **API Request (Frontend):** JavaScript (`frontend/scripts.js`) captures the message and sends a POST request to the backend API endpoint (`/api/customs/ask`).
3.  **Request Reception (Backend):** The Flask application (`backend/src/server.py`) receives the request at the `/api/customs/ask` route.
4.  **Routing (Backend):** The request handler calls the `customs_router` function in `backend/src/router/customs_router.py`.
5.  **Classification Check (Backend):** The `customs_router` analyzes the message using `is_classification_question()`.
    *   **If Classification Question:**
        *   The `extract_search_term()` function attempts to pull out the item name.
        *   If a term is found, the `get_cross_rulings()` function in `backend/src/scraper.py` is called.
        *   `scraper.py` fetches data from the CBP CROSS website, parses it, and returns relevant ruling summaries.
        *   `format_cross_rulings()` prepares this data as text context.
    *   **If Not Classification Question:** The CROSS scraping step is skipped.
6.  **Azure Prompt Flow Payload (Backend):** The `customs_router` prepares a JSON payload containing the original user `question` and any scraped `contexts` (from CROSS rulings, if applicable). Credentials (`AZURE_PROMPT_FLOW_ENDPOINT`, `AZURE_PROMPT_FLOW_API_KEY`) are loaded from the `.env` file.
7.  **Azure Prompt Flow Call (Backend):** An HTTPS POST request is made to the configured Azure Prompt Flow endpoint with the payload and authentication headers.
8.  **AI Processing (Azure):** The Azure Prompt Flow executes its defined logic (likely involving a Large Language Model) using the provided question and context.
9.  **Response Reception (Backend):** The `customs_router` receives the JSON response from Azure.
10. **Result Extraction (Backend):** The relevant answer text is extracted from the Azure response (e.g., from the "output" or "answer" field).
11. **API Response (Backend):** The Flask server sends the extracted answer back to the frontend in a JSON response.
12. **Display Result (Frontend):** JavaScript receives the response and displays the chatbot's answer in the chat interface.

---

## 4. Key Functions & Files

### Frontend
- **CustomsAgentChat.jsx**
  - `sendMessage()` – Handles input, calls backend, updates UI
  - Uses `axios.post('/api/customs/ask', { message })`
- **vite.config.js**
  - Sets up proxy for `/api` routes

### Backend
- **server.py**
  - `ask_customs()` – Flask route handler for `/api/customs/ask`
- **router/customs_router.py**
  - `customs_router(message)` – Sends request to Azure ML, returns result
  - `is_classification_question()`, `extract_search_term()`, `format_cross_rulings()` – New functions for CROSS ruling integration
- **scraper.py**
  - `get_cross_rulings(search_term, max_rulings)` – Scrapes U.S. Customs CROSS rulings

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
*   **requests**: For making HTTP calls to Azure Prompt Flow and the CROSS rulings website.
*   **python-dotenv**: For loading environment variables from the `.env` file.
*   **beautifulsoup4**: For parsing HTML content scraped from the CROSS rulings website.

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

To enhance responses for HTS classification queries, the backend now includes a step to scrape relevant U.S. Customs CROSS rulings:

1.  **Question Detection:** When a message is received by `customs_router` in `src/backend/src/router/customs_router.py`, the `is_classification_question()` function checks if it contains keywords related to HTS classification (e.g., "hts", "classify", "tariff code").
2.  **Search Term Extraction:** If detected as a classification question, the `extract_search_term()` function attempts to identify the specific item mentioned (e.g., "led lamp").
3.  **Web Scraping:** If a search term is found, the `customs_router` calls the `get_cross_rulings()` function located in the new `src/backend/src/scraper.py` module.
4.  **`scraper.py`:** This module contains the `get_cross_rulings(search_term, max_rulings)` function. It constructs a search URL for the official CBP CROSS database, sends an HTTP GET request, and parses the resulting HTML using `requests` and `BeautifulSoup` to extract ruling numbers, dates, URLs, and text snippets for the top matching rulings (defaulting to 3).
5.  **Context Formatting:** Back in `customs_router.py`, the `format_cross_rulings()` function takes the list of dictionaries returned by the scraper and formats it into a clean text block.
6.  **Payload Enhancement:** This formatted text block containing CROSS ruling summaries is added to the `contexts` field of the JSON payload sent to the Azure Prompt Flow endpoint.
7.  **Azure Prompt Flow Call:** The request is then sent to Azure Prompt Flow as usual, but now with the added context from the CROSS rulings.
8.  **Response Handling:** The response from Azure Prompt Flow is processed and returned to the frontend.

This integration allows the AI model in Azure Prompt Flow to consider relevant official rulings when generating answers to classification questions, improving accuracy and detail.

---

For further details, consult the main `README.md` or contact the project maintainers.
