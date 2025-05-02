import requests
import os
import logging
import re
from dotenv import load_dotenv

# Attempt to import the scraper function from the sibling scraper.py file
try:
    # Assuming scraper.py is one level up in src/backend/src
    # Correct relative import from router/customs_router.py to src/backend/src/scraper.py
    from ..scraper import get_cross_rulings
    logging.info("Successfully imported get_cross_rulings from parent directory.")
except ImportError as e1:
    logging.warning(f"Relative import failed: {e1}. Trying direct import assuming same directory or PYTHONPATH.")
    # Fallback if running router.py directly or structure differs/PYTHONPATH includes src
    try:
        from scraper import get_cross_rulings
        logging.warning("Imported scraper using direct import (check PYTHONPATH or execution context).")
    except ImportError as e2:
        logging.error(f"Could not import get_cross_rulings function from scraper.py: {e2}")
        # Define a dummy function so the rest of the code doesn't immediately break
        def get_cross_rulings(search_term: str, max_rulings: int = 3) -> list:
            logging.error("CRITICAL: Using dummy get_cross_rulings due to import failure.")
            return []


# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# --- Environment Variable Loading ---
# Construct the absolute path to the .env file relative to this script's location
# Assumes .env is in src/backend/src/, one level above the router directory
dotenv_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
# Load .env file if it exists
if os.path.exists(dotenv_path):
    load_dotenv(dotenv_path=dotenv_path)
    logger.info(f"Loaded environment variables from: {dotenv_path}")
else:
    # Try loading from current directory of router.py as fallback (less ideal)
    dotenv_path_fallback = os.path.join(os.path.dirname(__file__), '.env')
    if os.path.exists(dotenv_path_fallback):
        load_dotenv(dotenv_path=dotenv_path_fallback)
        logger.warning(f"Loaded environment variables from fallback path: {dotenv_path_fallback}")
    else:
        logger.warning(f".env file not found at primary path ({dotenv_path}) or fallback path ({dotenv_path_fallback}). Environment variables should be set externally.")


# --- Configuration ---
AZURE_ENDPOINT = os.getenv("AZURE_PROMPT_FLOW_ENDPOINT")
AZURE_API_KEY = os.getenv("AZURE_PROMPT_FLOW_API_KEY")
REQUEST_TIMEOUT = 30 # seconds

# --- Input Validation ---
if not AZURE_ENDPOINT:
    logger.critical("CRITICAL: AZURE_PROMPT_FLOW_ENDPOINT environment variable not set.")
if not AZURE_API_KEY:
    logger.critical("CRITICAL: AZURE_PROMPT_FLOW_API_KEY environment variable not set.")

HEADERS = {
    "Content-Type": "application/json",
    # Ensure API key is loaded before creating header
    "Authorization": f"Bearer {AZURE_API_KEY}" if AZURE_API_KEY else ""
}

# Keywords to detect HTS classification-related questions
CLASSIFICATION_KEYWORDS = [
    "hts", "classification", "classify", "tariff code", "customs code",
    "heading", "subheading", "htsus", "harmonized code"
]
# Pre-compile regex for efficiency
CLASSIFICATION_REGEX = re.compile(r'\b(' + '|'.join(CLASSIFICATION_KEYWORDS) + r')\b', re.IGNORECASE)
ITEM_EXTRACTION_PATTERNS = [
    # More specific patterns first
    re.compile(r'(?:classification of|classify|hts for|tariff code for|code for)\s+(?:the\s+|a\s+|an\s+)?(.+?)(?:\?|$|\s+under|\s+in\b)', re.IGNORECASE),
    re.compile(r'what is the\s+(?:hts|classification|tariff code|code)\s+(?:of|for)\s+(?:the\s+|a\s+|an\s+)?(.+?)(\?|$)', re.IGNORECASE),
    # Broader pattern for item after keyword
    re.compile(r'\b(' + '|'.join(CLASSIFICATION_KEYWORDS) + r')\s+(?:of|for)?\s*(?:the\s+|a\s+|an\s+)?([\w\s\-]+?)(\?|$)', re.IGNORECASE)
]


def is_classification_question(message: str) -> bool:
    """Checks if the message likely pertains to HTS classification using keywords."""
    if not message: return False
    return CLASSIFICATION_REGEX.search(message) is not None

def extract_search_term(message: str) -> str | None:
    """Extracts a potential item name for CROSS rulings search."""
    if not message: return None
    logger.debug(f"Attempting to extract search term from: '{message}'")

    for i, pattern in enumerate(ITEM_EXTRACTION_PATTERNS):
        match = pattern.search(message)
        # Adjust group index based on pattern structure
        term_group_index = 1 if i < 2 else 2
        if match and len(match.groups()) >= term_group_index:
            term = match.group(term_group_index).strip().rstrip('.?,!')
            # Basic cleanup
            term = re.sub(r'\s+(?:is|are|was|were)$', '', term).strip() # Remove trailing verbs
            term = re.sub(r"'s\b", "", term) # Remove possessives
            term_words = term.split()
            # Filter out terms that are just keywords themselves or too short/long
            if term.lower() not in CLASSIFICATION_KEYWORDS and 0 < len(term_words) < 8:
                 logger.info(f"Extracted search term '{term}' using pattern index {i}: {pattern.pattern}")
                 return term
            else:
                 logger.debug(f"Term '{term}' rejected (length: {len(term_words)} or keyword match).")

    logger.warning(f"Could not extract a suitable search term using defined patterns from: '{message}'")
    # Optional: Add a very simple fallback? (e.g., nouns after keyword) - risky
    return None


def format_cross_rulings(rulings: list[dict]) -> str:
    """Formats the CROSS rulings list into a string for the prompt context."""
    if not rulings:
        return ""

    formatted_string = "\n\n--- Relevant CROSS Rulings ---\n" # Clear separator
    for i, ruling in enumerate(rulings):
        num = ruling.get('ruling_number', 'N/A')
        date = ruling.get('date', 'N/A')
        snippet = str(ruling.get('snippet', 'No snippet available')) # Ensure string
        url = ruling.get('url', '#')
        formatted_string += (
            f"\n{i+1}. Ruling: {num} ({date})\n"
            f"   URL: {url}\n"
            f"   Snippet: {snippet[:200]}...\n" # Limit snippet length
        )
    formatted_string += "\n-----------------------------\n"
    return formatted_string

def customs_router(message: str, language: str = None, id: str = None) -> dict:
    """
    Routes message to Azure Prompt Flow, adding CROSS rulings context
    for classification questions.
    """
    # --- Pre-flight Checks ---
    if not AZURE_ENDPOINT or not AZURE_API_KEY or not HEADERS.get("Authorization"):
        error_msg = "Backend Misconfiguration: Azure endpoint or API key missing or not loaded from .env."
        logger.critical(error_msg)
        return {"kind": "error", "result": None, "history": [], "error": error_msg}

    if not message:
        logger.warning("Received empty message in customs_router.")
        return {"kind": "error", "result": None, "history": [], "error": "Input message is empty."}

    # --- CROSS Ruling Logic ---
    cross_rulings_context = ""
    if is_classification_question(message):
        logger.info("Classification question detected. Attempting CROSS search.")
        search_term = extract_search_term(message)
        if search_term:
            logger.info(f"Extracted search term: '{search_term}'. Calling get_cross_rulings.")
            try:
                # Call scraper (ensure it was imported correctly)
                cross_rulings = get_cross_rulings(search_term, max_rulings=3)
                cross_rulings_context = format_cross_rulings(cross_rulings)
                if cross_rulings_context:
                    logger.info("Formatted CROSS rulings context generated.")
                else:
                    logger.info("No relevant CROSS rulings found or formatted.")
            except Exception as e_scrape:
                 logger.error(f"Error occurred during get_cross_rulings call or formatting: {e_scrape}", exc_info=True)
                 # Decide if you want to proceed without CROSS context or return error
                 cross_rulings_context = "\n\n[Error fetching relevant CROSS rulings]\n" # Inform LLM?
        else:
            logger.info("Could not extract a suitable search term for CROSS rulings.")
    else:
        logger.info("Message not identified as a classification question. Skipping CROSS search.")

    # --- Prepare Payload for Azure Prompt Flow ---
    # IMPORTANT: Verify this matches your specific Prompt Flow's input schema.
    combined_context = cross_rulings_context.strip()

    # Construct the payload dynamically based on expected Prompt Flow inputs
    payload = {
        "question": message,
        # Only include contexts if not empty? Or let Prompt Flow handle empty.
        "contexts": combined_context
        # Add other fields your Prompt Flow expects, e.g., chat_history
        # "chat_history": [] # Placeholder if needed
    }

    # Log keys being sent, not values, for security/brevity
    logger.debug(f"Sending payload to Azure ML. Keys: {list(payload.keys())}")

    # --- Call Azure ML ---
    try:
        response = requests.post(AZURE_ENDPOINT, headers=HEADERS, json=payload, timeout=REQUEST_TIMEOUT)
        logger.info(f"Azure ML Response Status Code: {response.status_code}") # Use INFO for status code
        response.raise_for_status() # Raise HTTPError for 4xx/5xx responses

        result = response.json()
        logger.debug(f"Azure ML Parsed JSON Response Keys: {list(result.keys())}") # Log keys only

        # Adapt this based on the actual key containing the answer in your Azure response
        output_text = result.get("output") or result.get("answer") or "[Agent response not found in expected field]"

        return {
            "kind": "customs_agent_result",
            "result": output_text,
            "history": [], # Placeholder for history management
            "error": None
        }

    # --- Error Handling ---
    except requests.exceptions.Timeout:
        error_message = f"Request to Azure ML timed out after {REQUEST_TIMEOUT} seconds."
        logger.error(error_message)
        return {"kind": "error", "result": None, "history": [], "error": error_message}
    except requests.exceptions.HTTPError as e_http:
        error_detail = response.text[:500] # Limit error response size
        error_message = f"Azure ML API Error {response.status_code}: {error_detail}"
        logger.error(f"{error_message} - Request URL: {AZURE_ENDPOINT}")
        return {"kind": "error", "result": None, "history": [], "error": error_message}
    except requests.exceptions.RequestException as e_req:
        error_message = f"Network or Request Error connecting to Azure ML: {e_req}"
        logger.error(error_message, exc_info=True)
        return {"kind": "error", "result": None, "history": [], "error": error_message}
    except Exception as e:
        error_message = f"An unexpected error occurred in customs_router: {e}"
        logger.exception(error_message) # Log full traceback
        return {"kind": "error", "result": None, "history": [], "error": "An internal server error occurred."} # Generic message
