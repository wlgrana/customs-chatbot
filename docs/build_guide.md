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

---

## 3. End-to-End Query Flow

### 1. User enters a question in the chat UI (CustomsAgentChat.jsx)
- State is updated with the user's message
- `sendMessage()` function is called
- Uses Axios to POST `{ message: <user_input> }` to `/api/customs/ask`

### 2. Frontend (Vite) Proxy
- Vite dev server proxies `/api` requests to `http://localhost:5000` (Flask backend)
- Configured in `vite.config.js` under `server.proxy`

### 3. Backend API (Flask, server.py)
- `/api/customs/ask` route receives POST
- Calls `customs_router(message)` from `router/customs_router.py`

### 4. Backend Router (customs_router.py)
- Builds a JSON payload `{ "question": <user_input> }`
- Adds API key to Authorization header
- Forwards request to Azure ML endpoint (`https://us-customs-rules-vnvgf.eastus2.inference.ml.azure.com/score`)
- Parses response, returns `{ "result": ..., "error": ... }` to frontend

### 5. Frontend Receives Response
- Updates chat state with agent's reply
- Displays response in chat UI

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

For further details, consult the main `README.md` or contact the project maintainers.
