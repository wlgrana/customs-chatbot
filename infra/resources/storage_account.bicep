@description('Name of Storage Account resource.')
param name string = 'st${uniqueString(resourceGroup().id)}'

@description('Location for all resources.')
param location string = resourceGroup().location

@description('Blob container name.')
param blob_container_name string = 'contoso-outdoors-manuals'

resource storage_account 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: name
  location: location
  kind: 'StorageV2'
  properties: {
    allowSharedKeyAccess: false
    allowBlobPublicAccess: false
    publicNetworkAccess: 'Enabled'
    networkAcls: {
      defaultAction: 'Allow'
      bypass: 'AzureServices'
    }
  }
  sku: {
    name: 'Standard_LRS'
  }

  resource blob_service 'blobServices' = {
    name: 'default'

    resource blob_container 'containers' = {
      name: blob_container_name
      properties: {
        publicAccess: 'None'
      }
    }
  }
}

output name string = storage_account.name
output connection_string string = 'ResourceId=${storage_account.id};'
output blob_container_name string = storage_account::blob_service::blob_container.name
