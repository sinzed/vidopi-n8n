import {
  IAuthenticateGeneric,
  ICredentialTestRequest,
  ICredentialType,
  INodeProperties,
} from 'n8n-workflow';

class VidopiApi implements ICredentialType {
  name = 'vidopiApi';
  displayName = 'Vidopi API';
  documentationUrl = 'https://vidopi.com/api/docs';
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
        Authorization: '=Bearer {{$credentials.apiKey}}',
      },
    },
  };

  test: ICredentialTestRequest = {
    request: {
      baseURL: 'https://api.vidopi.com',
      url: '/upload-video/',
      method: 'POST',
      body: {
        video_url: 'test',
      },
    },
  };
}

// Export for CommonJS
exports.VidopiApi = VidopiApi;

