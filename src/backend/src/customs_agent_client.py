# US Customs Agent Client - integrates Azure AI Projects agent with the template

from azure.ai.projects import AIProjectClient
from azure.identity import DefaultAzureCredential
import os

class CustomsAgentClient:
    def __init__(self, conn_str=None, agent_id=None, thread_id=None, credential=None, api_key=None):
        self.conn_str = conn_str or os.environ.get("US_CUSTOMS_AGENT_CONN_STR")
        self.agent_id = agent_id or os.environ.get("US_CUSTOMS_AGENT_ID")
        self.thread_id = thread_id or os.environ.get("US_CUSTOMS_AGENT_THREAD_ID")
        self.api_key = api_key or os.environ.get("US_CUSTOMS_AGENT_API_KEY")
        self.credential = credential or DefaultAzureCredential()
        # If API key is required, pass it as a 'key' argument if supported
        # If not supported, document how to use it
        try:
            self.project_client = AIProjectClient.from_connection_string(
                credential=self.credential,
                conn_str=self.conn_str,
                key=self.api_key
            )
        except TypeError:
            # Fallback: if 'key' is not a valid argument, document usage
            self.project_client = AIProjectClient.from_connection_string(
                credential=self.credential,
                conn_str=self.conn_str
            )
            # If the SDK requires passing the API key in another way, please consult the documentation.
        self.agent = self.project_client.agents.get_agent(self.agent_id)
        self.thread = self.project_client.agents.get_thread(self.thread_id)

    def send_message(self, message: str, role: str = "user"):
        self.project_client.agents.create_message(
            thread_id=self.thread.id,
            role=role,
            content=message
        )
        run = self.project_client.agents.create_and_process_run(
            thread_id=self.thread.id,
            agent_id=self.agent.id)
        messages = self.project_client.agents.list_messages(thread_id=self.thread.id)
        # Return all text messages as dicts
        return [msg.as_dict() for msg in messages.text_messages]

