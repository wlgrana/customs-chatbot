"""
scraper.py - Searches CBP CROSS rulings via JSON API.
"""

import requests
import sys
import json
import logging
from typing import List, Dict, Any

# Configure basic logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

CROSS_API_URL = "https://rulings.cbp.gov/api/search"

def search_cross_rulings(
    term: str,
    collection: str = "ALL",
    page_size: int = 10,
    page: int = 1,
    sort_by: str = "RELEVANCE"
) -> List[Dict[str, Any]]:
    """
    Searches CROSS rulings using the official CBP JSON API.

    Args:
        term: The search term (e.g., "laptop computer").
        collection: The collection to search within (default: "ALL").
        page_size: The number of results per page (default: 10).
        page: The page number to retrieve (default: 1).
        sort_by: The sorting criteria (default: "RELEVANCE").

    Returns:
        A list of dictionaries, each representing a ruling item.

    Raises:
        requests.exceptions.HTTPError: If the API returns an HTTP error status code.
    """
    params = {
        "term": term,
        "collection": collection,
        "pageSize": page_size,
        "page": page,
        "sortBy": sort_by
    }
    headers = {
        "Accept": "application/json"
    }

    logger.info(f"Querying CROSS API: {CROSS_API_URL} with params: {params}")

    response = requests.get(CROSS_API_URL, params=params, headers=headers, timeout=30)
    response.raise_for_status()

    data = response.json()
    items: List[Dict[str, Any]] = data.get("rulings", [])

    logger.info(f"Retrieved {len(items)} items for term '{term}'.") # Log message is concise
    return items


if __name__ == "__main__":
    term = sys.argv[1] if len(sys.argv) > 1 else "fuel pump"
    print(f"Searching CROSS rulings for: '{term}' (max 5 results)...\n")

    try:
        rulings = search_cross_rulings(term, page_size=5)
        if not rulings:
            print("No rulings found.")
        else:
            for idx, ruling in enumerate(rulings, start=1):
                print(f"--- Ruling {idx} ---")
                print(f"Date    : {ruling.get('rulingDate', 'N/A')}")
                print(f"Number  : {ruling.get('rulingNumber', 'N/A')}")
                tariffs = ruling.get('tariffs', [])
                print(f"Tariffs : {', '.join(tariffs) if tariffs else 'N/A'}")
                print(f"Subject : {ruling.get('subject', 'N/A')}") # Changed label to 'Subject'
                print()
    except requests.exceptions.HTTPError as e:
        logger.error(f"API Error: {e}")
        print(f"API Error: {e}")
    except requests.exceptions.RequestException as e:
        logger.error(f"Network Error: {e}")
        print(f"Network Error: {e}")
    except ValueError as e:
        logger.error(f"Data Error: {e}")
        print(f"Data Error: {e}")
    except Exception as e:
        logger.error(f"Unexpected Error: {e}")
        print(f"Unexpected Error: {e}")
