# Copyright (c) Microsoft Corporation.
# Licensed under the MIT License.
import os
import json
from azure.identity import DefaultAzureCredential, ManagedIdentityCredential
from azure.ai.language.questionanswering.authoring import AuthoringClient


def get_azure_credential():
    use_mi_auth = os.environ.get('USE_MI_AUTH', 'false').lower() == 'true'

    if use_mi_auth:
        mi_client_id = os.environ['MI_CLIENT_ID']
        return ManagedIdentityCredential(
            client_id=mi_client_id
        )

    return DefaultAzureCredential()


project_name = os.environ['CQA_PROJECT_NAME']
deployment_name = os.environ['CQA_DEPLOYMENT_NAME']

endpoint = os.environ['LANGUAGE_ENDPOINT']
credential = get_azure_credential()

client = AuthoringClient(endpoint, credential)

# Check if project is created:
projects = client.list_projects()
project_names = [p['projectName'] for p in projects]

if project_name not in project_names:
    # Create CQA project:
    print('Creating CQA project...')

    project = client.create_project(
        project_name=project_name,
        options={
            'description': '',
            'language': 'en',
            'multilingualResource': False,
            'settings': {
                'defaultAnswer': 'No answer found'
            }
        }
    )

    print(project)
else:
    print(f'Project {project_name} already created.')

print('Importing CQA project...')
import_file = 'cqa_import.json'
with open(import_file, 'r') as fp:
    project_json = json.load(fp)

poller = client.begin_import_assets(
    project_name=project_name,
    options=project_json
)

response = poller.result()
print(response)

# Check deployments:
print("Checking CQA deployments...")

deployments = client.list_deployments(
    project_name=project_name
)

deployment_names = [d['deploymentName'] for d in deployments]

if deployment_name not in deployment_names:
    # Deploy kb:
    print("Deploying knowledge base...")

    poller = client.begin_deploy_project(
        project_name=project_name,
        deployment_name=deployment_name
    )

    response = poller.result()
    print(response)
else:
    print(f"Deployment {deployment_name} already deployed.")
