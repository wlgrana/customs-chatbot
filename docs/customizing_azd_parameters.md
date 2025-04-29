## [Optional]: Customizing resource names 

By default this template will use the environment name as the prefix to prevent naming collisions within Azure. The parameters below show the default values. You only need to run the statements below if you need to change the values. 


> To override any of the parameters, run `azd env set <key> <value>` before running `azd up`. On the first azd command, it will prompt you for the environment name. Be sure to choose a 3-20 charaters alphanumeric unique name. 


Change the GPT Model Deployment Type (allowed values: `Standard`, `GlobalStandard`)

```shell
azd env set AZURE_ENV_GPT_MODEL_DEPLOYMENT_TYPE GlobalStandard
```

Set the GPT Model (allowed values: `gpt-4o-mini`, `gpt-4o`, `gpt-4`)

```shell
azd env set AZURE_ENV_GPT_MODEL_NAME gpt-4o-mini
```

Change the GPT Model Capacity (choose a number based on available GPT model capacity in your subscription)

```shell
azd env set AZURE_ENV_GPT_MODEL_CAPACITY 20
```

Change the Embedding Model:

```shell
azd env set AZURE_ENV_EMBEDDING_MODEL_NAME text-embedding-ada-002
```

Change the Embedding Deployment Capacity (choose a number based on available embedding model capacity in your subscription)

```shell
azd env set AZURE_ENV_EMBEDDING_MODEL_CAPACITY 80
```