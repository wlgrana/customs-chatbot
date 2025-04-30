import requests

# Azure Prompt Flow endpoint and API key
endpoint = "https://us-customs-rules-vnvgf.eastus2.inference.ml.azure.com/score"
api_key = "60Wh1UeSsQ1PSWkhoSQ0VyNyYloDGzo9qcmbs9KuS0Jm8UFwtTaOJQQJ99BDAAAAAAAAAAAAINFRAZML2zQy"

headers = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {api_key}"
}

def customs_router(message: str, language: str = None, id: str = None) -> dict:
    """
    Routes message to US Customs Agent via Azure Prompt Flow REST API.
    """
    payload = {
        "question": message
    }

    try:
        response = requests.post(endpoint, headers=headers, json=payload)

        # Log response for debugging
        print("STATUS CODE:", response.status_code)
        print("RAW RESPONSE TEXT:", response.text)

        if response.status_code == 200:
            result = response.json()
            print("PARSED JSON:", result)

            output_text = result.get("output") or result.get("answer") or "[No output or answer field in response]"

            return {
                "kind": "customs_agent_result",
                "result": output_text,
                "history": [],
                "error": None
            }

        else:
            return {
                "kind": "customs_agent_result",
                "result": None,
                "history": [],
                "error": f"Error {response.status_code}: {response.text}"
            }

    except Exception as e:
        return {
            "kind": "customs_agent_result",
            "result": None,
            "history": [],
            "error": str(e)
        }
