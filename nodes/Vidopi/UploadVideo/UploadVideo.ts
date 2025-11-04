import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';

class UploadVideo implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Vidopi Upload Video',
    name: 'vidopiUploadVideo',
    icon: 'file:vidopi.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["operation"]}}',
    description: 'Upload video files for processing',
    defaults: {
      name: 'Vidopi Upload Video',
    },
    inputs: ['main'],
    outputs: ['main'],
    credentials: [
      {
        name: 'vidopiApi',
        required: true,
      },
    ],
    properties: [
      {
        displayName: 'Video File',
        name: 'videoFile',
        type: 'string',
        default: '',
        required: true,
        description: 'URL or file path of the video to upload',
        placeholder: 'https://example.com/video.mp4',
      },
      {
        displayName: 'Additional Fields',
        name: 'additionalFields',
        type: 'collection',
        placeholder: 'Add Field',
        default: {},
        options: [
          {
            displayName: 'Public Link',
            name: 'publicLink',
            type: 'boolean',
            default: true,
            description: 'Whether to generate a public link for the uploaded video',
          },
        ],
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];
    const credentials = await this.getCredentials('vidopiApi');

    for (let i = 0; i < items.length; i++) {
      try {
        const videoFile = this.getNodeParameter('videoFile', i) as string;
        const additionalFields = this.getNodeParameter('additionalFields', i) as {
          publicLink?: boolean;
        };

        const body: any = {
          video_url: videoFile,
        };

        if (additionalFields.publicLink !== undefined) {
          body.public_link = additionalFields.publicLink;
        }

        const response = await this.helpers.httpRequest({
          method: 'POST',
          url: 'https://api.vidopi.com/upload-video/',
          body,
          json: true,
        });
        returnData.push({ json: response });
      } catch (error) {
        if (this.continueOnFail()) {
          returnData.push({ json: { error: error instanceof Error ? error.message : String(error) } });
          continue;
        }
        throw error;
      }
    }

    return [returnData];
  }
}

// Export for CommonJS
module.exports = UploadVideo;

