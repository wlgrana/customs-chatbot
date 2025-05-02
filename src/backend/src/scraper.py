# src/backend/src/scraper.py
import requests
from bs4 import BeautifulSoup
import logging
import re
import time

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

CROSS_SEARCH_URL = "https://rulings.cbp.gov/search?term={term}&collection=ALL&sortBy=RELEVANCE&pageSize=10&page=1" # Reduced page size
CROSS_BASE_URL = "https://rulings.cbp.gov"

def get_cross_rulings(search_term: str, max_rulings: int = 3) -> list[dict]:
    """ Scrapes CROSS rulings for a given term. """
    rulings = []
    if not search_term:
        logger.warning("No search term provided for CROSS rulings.")
        return rulings

    search_url = CROSS_SEARCH_URL.format(term=search_term.replace(" ", "+"))
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }

    logger.info(f"Fetching CROSS rulings for '{search_term}' from {search_url}")
    try:
        # Optional polite delay - uncomment if making frequent calls elsewhere
        # time.sleep(0.5)
        response = requests.get(search_url, headers=headers, timeout=15)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, 'html.parser')

        # --- Parsing Logic (Adapted for observed structure May 2025) ---
        results_list = soup.find('ul', class_='search-results-list')
        result_items = results_list.find_all('li', class_='search-result') if results_list else []
        if not result_items:
             result_items = soup.find_all('div', class_='result-item') # Fallback

        logger.info(f"Found {len(result_items)} potential results on page.")

        for item in result_items:
            if len(rulings) >= max_rulings:
                break
            try:
                ruling_info = {}
                # Robust selector for link/title
                link_tag = item.select_one('h4 > a, h3 > a, li > a[href*="/ruling/"]')

                if link_tag and link_tag.has_attr('href'):
                    relative_url = link_tag['href']
                    ruling_info['url'] = CROSS_BASE_URL + relative_url if relative_url.startswith('/') else relative_url
                    ruling_text = link_tag.get_text(strip=True)
                    # Extract ruling number (e.g., NY N123456)
                    num_match = re.match(r'([A-Z]{2,3}\s?[A-Z0-9]+)', ruling_text)
                    ruling_info['ruling_number'] = num_match.group(1).strip() if num_match else ruling_text.split('–')[0].strip()
                else:
                    logger.warning("Could not find ruling link/number in item.")
                    continue # Skip this item

                # Extract Date
                meta_tag = item.find(['p', 'div'], class_='meta')
                ruling_info['date'] = "Date not found"
                if meta_tag:
                     date_match = re.search(r'\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{1,2},\s+\d{4}\b', meta_tag.get_text())
                     if date_match: ruling_info['date'] = date_match.group(0)

                # Extract Snippet
                snippet_tag = item.find(['p', 'div'], class_='snippet')
                if snippet_tag:
                    ruling_info['snippet'] = snippet_tag.get_text(strip=True)
                else: # Basic fallback
                    first_p = item.find('p')
                    if first_p and 'meta' not in first_p.get('class', []):
                        ruling_info['snippet'] = first_p.get_text(strip=True)
                    else:
                        ruling_info['snippet'] = "Snippet not found"

                if ruling_info.get('ruling_number') and ruling_info.get('url'):
                    rulings.append(ruling_info)
                else:
                    logger.warning(f"Skipping item due to missing data: {ruling_info}")

            except Exception as e_item:
                logger.error(f"Error parsing individual CROSS ruling item: {e_item}", exc_info=False)
                continue
    except requests.exceptions.Timeout:
         logger.error(f"Timeout fetching CROSS rulings for '{search_term}'.")
    except requests.exceptions.RequestException as e_req:
        logger.error(f"Request Error fetching CROSS rulings: {e_req}")
    except Exception as e_parse:
        logger.error(f"General Error parsing CROSS page: {e_parse}")

    logger.info(f"Successfully extracted {len(rulings)} rulings for '{search_term}'.")
    return rulings[:max_rulings]

# Example for testing module directly
# if __name__ == '__main__':
#     test_term = "led lamp"
#     scraped_rulings = get_cross_rulings(test_term)
#     if scraped_rulings:
#         for rule in scraped_rulings:
#             print(rule)
#     else:
#         print(f"No rulings found or error for '{test_term}'")
