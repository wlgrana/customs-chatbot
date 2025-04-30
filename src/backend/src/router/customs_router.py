# Router for US Customs Agent using CustomsAgentClient
import requests

# Set your endpoint and key
endpoint = "https://us-customs-rules-vnvgf.eastus2.inference.ml.azure.com/score"
api_key = "60Wh1UeSsQ1PSWkhoSQ0VyNyYloDGzo9qcmbs9KuS0Jm8UFwtTaOJQQJ99BDAAAAAAAAAAAAINFRAZML2zQy"
# Swagger/OpenAPI: https://us-customs-rules-vnvgf.eastus2.inference.ml.azure.com/swagger.json

headers = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {api_key}"
}

def customs_router(message: str, language: str = None, id: str = None) -> dict:
    """
    Routes message to US Customs Agent via new Prompt Flow REST API.
    """
    payload = {
        "question": message
    }
    try:
        response = requests.post(endpoint, headers=headers, json=payload)
        if response.status_code == 200:
            result = response.json()
            return {
                "kind": "customs_agent_result",
                "result": result.get("output", "[No output field in response]"),
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
        return {"kind": "customs_agent_result", "result": None, "history": [], "error": str(e)}
