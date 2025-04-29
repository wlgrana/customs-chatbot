# Router for US Customs Agent using CustomsAgentClient
from customs_agent_client import CustomsAgentClient
import os

def customs_router(message: str, language: str = None, id: str = None) -> dict:
    """
    Routes message to US Customs Agent via CustomsAgentClient.
    """
    # These can be set via environment variables or hardcoded for testing
    conn_str = os.environ.get("US_CUSTOMS_AGENT_CONN_STR")
    agent_id = os.environ.get("US_CUSTOMS_AGENT_ID")
    thread_id = os.environ.get("US_CUSTOMS_AGENT_THREAD_ID")
    
    client = CustomsAgentClient(conn_str=conn_str, agent_id=agent_id, thread_id=thread_id)
    try:
        responses = client.send_message(message)
        # Return last response as main result, all as history
        return {
            "kind": "customs_agent_result",
            "result": responses[-1] if responses else None,
            "history": responses,
            "error": None
        }
    except Exception as e:
        return {"kind": "customs_agent_result", "result": None, "history": [], "error": str(e)}
