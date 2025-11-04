import {
  IAuthenticateGeneric,
  ICredentialTestRequest,
  ICredentialType,
  INodeProperties,
} from 'n8n-workflow';

class VidopiApi implements ICredentialType {
  name = 'vidopiApi';
  displayName = 'Vidopi API';
  documentationUrl = 'https://dashboard.vidopi.com/api-docs';
  properties: INodeProperties[] = [
    {
      displayName: 'API Key',
      name: 'apiKey',
      type: 'string',
      typeOptions: {
        password: true,
      },
      default: '',
      required: true,
      description: 'Your Vidopi API key. Get your API key from https://vidopi.com (free tier available)',
    },
  ];

  authenticate: IAuthenticateGeneric = {
    type: 'generic',
    properties: {
      headers: {
        'X-API-Key': '={{$credentials.apiKey}}',
      },
    },
  };

  test: ICredentialTestRequest = {
    request: {
      baseURL: 'https://api.vidopi.com',
      url: '/apikey-test',
      method: 'GET',
    },
  };
}

// Export for CommonJS
exports.VidopiApi = VidopiApi;

