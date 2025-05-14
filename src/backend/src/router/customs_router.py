import requests
import os
import logging
import re
from dotenv import load_dotenv

try:
    from ..scraper import search_cross_rulings
    logging.info("Successfully imported search_cross_rulings from parent directory.")
except ImportError as e1:
    logging.warning(f"Relative import failed: {e1}. Trying direct import assuming same directory or PYTHONPATH.")
    try:
        from scraper import search_cross_rulings
        logging.warning("Imported scraper using direct import (check PYTHONPATH or execution context).")
    except ImportError as e2:
        logging.error(f"Could not import search_cross_rulings function from scraper.py: {e2}")
        def search_cross_rulings(term: str, collection: str = "ALL", page_size: int = 10, page: int = 1, sort_by: str = "RELEVANCE") -> list:
            logging.error("CRITICAL: Using dummy search_cross_rulings due to import failure.")
            return []

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

dotenv_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
if os.path.exists(dotenv_path):
    load_dotenv(dotenv_path=dotenv_path)
    logger.info(f"Loaded environment variables from: {dotenv_path}")
else:
    dotenv_path_fallback = os.path.join(os.path.dirname(__file__), '.env')
    if os.path.exists(dotenv_path_fallback):
        load_dotenv(dotenv_path=dotenv_path_fallback)
        logger.warning(f"Loaded environment variables from fallback path: {dotenv_path_fallback}")
    else:
        logger.warning(f".env file not found. Environment variables should be set externally.")

AZURE_ENDPOINT = os.getenv("AZURE_PROMPT_FLOW_ENDPOINT")
AZURE_API_KEY = os.getenv("AZURE_PROMPT_FLOW_API_KEY")
REQUEST_TIMEOUT = 60

if not AZURE_ENDPOINT:
    logger.critical("CRITICAL: AZURE_PROMPT_FLOW_ENDPOINT environment variable not set.")
if not AZURE_API_KEY:
    logger.critical("CRITICAL: AZURE_PROMPT_FLOW_API_KEY environment variable not set.")

HEADERS = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {AZURE_API_KEY}" if AZURE_API_KEY else ""
}

CLASSIFICATION_KEYWORDS = [
    "hts", "classification", "classify", "tariff code", "customs code",
    "heading", "subheading", "htsus", "harmonized code"
]
CLASSIFICATION_REGEX = re.compile(r'\b(' + '|'.join(CLASSIFICATION_KEYWORDS) + r')\b', re.IGNORECASE)
ITEM_EXTRACTION_PATTERNS = [
    re.compile(r'(?:classification of|classify|hts for|tariff code for|code for)\s+(?:the\s+|a\s+|an\s+)?(.+?)(?:\?|$|\s+under|\s+in\b)', re.IGNORECASE),
    re.compile(r'what is the\s+(?:hts|classification|tariff code|code)\s+(?:of|for)\s+(?:the\s+|a\s+|an\s+)?(.+?)(\?|$)', re.IGNORECASE),
    re.compile(r'\b(' + '|'.join(CLASSIFICATION_KEYWORDS) + r')\s+(?:of|for)?\s*(?:the\s+|a\s+|an\s+)?([\w\s\-]+?)(\?|$)', re.IGNORECASE)
]

def is_classification_question(message: str) -> bool:
    if not message: return False
    return bool(CLASSIFICATION_REGEX.search(message))

def extract_search_term(message: str) -> str | None:
    if not message: return None
    for pattern in ITEM_EXTRACTION_PATTERNS:
        match = pattern.search(message)
        if match:
            for i in range(len(match.groups()), 0, -1):
                term = match.group(i)
                if term and term.strip():
                    term = term.strip('.,;:!?()"\'')
                    if term.lower() not in CLASSIFICATION_KEYWORDS:
                        logger.info(f"Extracted search term: '{term}' using pattern: {pattern.pattern}")
                        return term.strip()
    logger.warning(f"No search term extracted from: '{message[:100]}...'")
    return None

def format_cross_rulings_for_context(rulings: list[dict], max_to_format: int = 3) -> str:
    if not rulings:
        return "No specific CROSS rulings found."
    
    formatted_list = ["Relevant U.S. Customs CROSS Rulings:"]
    for i, ruling in enumerate(rulings[:max_to_format]):
        parts = [f"  Ruling {i+1}:"]
        if ruling.get('rulingNumber'):
            parts.append(f"    Number: {ruling.get('rulingNumber')}")
        if ruling.get('rulingDate'):
            parts.append(f"    Date: {ruling.get('rulingDate')}")
        # 'subject' often serves as a short description or abstract
        if ruling.get('subject'):
            parts.append(f"    Subject: {ruling.get('subject')}")
        # 'tariffs' is expected to be a list of strings
        tariffs_list = ruling.get('tariffs', [])
        if isinstance(tariffs_list, list) and tariffs_list:
            parts.append(f"    Tariffs: {', '.join(tariffs_list)}")
        if ruling.get('url'):
             parts.append(f"    URL: {ruling.get('url')}")
        formatted_list.append("\n".join(parts))
    
    return "\n".join(formatted_list) if len(formatted_list) > 1 else "No specific CROSS rulings found or able to be formatted."

def customs_router(message: str, language: str = None, id: str = None) -> dict:
    logger.info(f"Entering customs_router with message: '{message[:100]}...' Language: {language}, ID: {id}")
    
    if not AZURE_ENDPOINT or not AZURE_API_KEY or not HEADERS.get("Authorization"):
        error_msg = "Backend Misconfiguration: Azure endpoint or API key missing."
        logger.critical(error_msg)
        return {"kind": "error", "result": None, "history": [], "error": error_msg}

    ai_contexts = ""

    if is_classification_question(message):
        logger.info(f"Message identified as classification question: '{message[:100]}...'")
        search_term = extract_search_term(message)
        if search_term:
            logger.info(f"Extracted search term: '{search_term}' for API call.")
            try:
                rulings_from_api = search_cross_rulings(search_term, page_size=3)
                if rulings_from_api:
                    logger.info(f"Successfully retrieved {len(rulings_from_api)} rulings from API for '{search_term}'.")
                    formatted = format_cross_rulings_for_context(rulings_from_api, max_to_format=3)
                    # Return the actual top 3 rulings directly, bypassing Azure ML
                    return {
                        "kind": "cross_rulings_result",
                        "result": formatted,
                        "cross_rulings": rulings_from_api,
                        "history": [],
                        "error": None
                    }
                else:
                    logger.info(f"No rulings returned from API for '{search_term}'.")
                    return {
                        "kind": "cross_rulings_result",
                        "result": f"No specific U.S. Customs CROSS rulings were found for '{search_term}'.",
                        "cross_rulings": [],
                        "history": [],
                        "error": None
                    }
            except requests.exceptions.HTTPError as e_http:
                logger.error(f"CROSS API HTTP error for search term '{search_term}': {e_http}")
                return {
                    "kind": "cross_rulings_result",
                    "result": f"Could not retrieve CROSS rulings for '{search_term}' due to an API error: {getattr(e_http.response, 'status_code', 'N/A')}.",
                    "cross_rulings": [],
                    "history": [],
                    "error": str(e_http)
                }
            except requests.exceptions.RequestException as e_req:
                logger.error(f"CROSS API request error for search term '{search_term}': {e_req}")
                return {
                    "kind": "cross_rulings_result",
                    "result": f"Could not retrieve CROSS rulings for '{search_term}' due to a network error.",
                    "cross_rulings": [],
                    "history": [],
                    "error": str(e_req)
                }
            except ValueError as e_val:
                logger.error(f"CROSS API data error for search term '{search_term}': {e_val}")
                return {
                    "kind": "cross_rulings_result",
                    "result": f"Could not process data from CROSS rulings for '{search_term}'.",
                    "cross_rulings": [],
                    "history": [],
                    "error": str(e_val)
                }
            except Exception as e_scrp:
                logger.error(f"Unexpected error during scraping for '{search_term}': {e_scrp}", exc_info=True)
                return {
                    "kind": "cross_rulings_result",
                    "result": f"An unexpected error occurred while trying to get CROSS rulings for '{search_term}'.",
                    "cross_rulings": [],
                    "history": [],
                    "error": str(e_scrp)
                }
        else:
            logger.info("No search term extracted from classification question. AI will rely on general knowledge.")
            ai_contexts = "Note: A specific item for CROSS ruling search was not identified in the query."
    else:
        logger.info("Message not identified as a classification question. No CROSS ruling search will be performed.")
        ai_contexts = ""

    logger.info(f"Preparing to call Azure ML. Context provided to AI: '{ai_contexts[:200]}...' if any.")
    
    payload = {
        "question": message, # Original user question
        "contexts": ai_contexts, # Formatted rulings or error message
        # "chat_history": [] # if your PF uses chat history
    }
    logger.debug(f"Sending payload to Azure ML. Keys: {list(payload.keys())}")

    try:
        response = requests.post(AZURE_ENDPOINT, headers=HEADERS, json=payload, timeout=REQUEST_TIMEOUT)
        logger.info(f"Azure ML Response Status Code: {response.status_code}")
        response.raise_for_status()
        ai_response_data = response.json()
        logger.debug(f"Azure ML Parsed JSON Response Keys: {list(ai_response_data.keys())}")
        
        output_text = ai_response_data.get("output") or ai_response_data.get("answer") or "[Agent response not found in expected field]"
        return {
            "kind": "customs_agent_text_result",
            "result": output_text,
            "history": [],
            "error": None
        }
    except requests.exceptions.Timeout:
        error_message = f"Request to Azure ML timed out after {REQUEST_TIMEOUT} seconds."
        logger.error(error_message)
        return {"kind": "error", "result": None, "history": [], "error": error_message}
    except requests.exceptions.HTTPError as e_http:
        error_detail = response.text[:500] if response else "No response object"
        status_code = response.status_code if response else "N/A"
        error_message = f"Azure ML API Error {status_code}: {error_detail}"
        logger.error(f"{error_message} - Request URL: {AZURE_ENDPOINT}")
        return {"kind": "error", "result": None, "history": [], "error": error_message}
    except Exception as e:
        error_message = f"An unexpected error occurred during AI call: {e}"
        logger.exception(error_message)
        return {"kind": "error", "result": None, "history": [], "error": "An internal server error occurred."}
