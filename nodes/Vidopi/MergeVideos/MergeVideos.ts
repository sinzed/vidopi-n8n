import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';

class MergeVideos implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Vidopi Merge Videos',
    name: 'vidopiMergeVideos',
    icon: 'file:logo.png',
    group: ['transform'],
    version: 1,
    subtitle: 'Merge two videos together',
    description: 'Merge two videos together into a single video file',
    defaults: {
      name: 'Vidopi Merge Videos',
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
        displayName: 'First Video URL',
        name: 'videoUrl1',
        type: 'string',
        default: '',
        required: true,
        description: 'Public link or URL of the first video',
        placeholder: 'https://vidopi.com/public/video1.mp4',
      },
      {
        displayName: 'Second Video URL',
        name: 'videoUrl2',
        type: 'string',
        default: '',
        required: true,
        description: 'Public link or URL of the second video',
        placeholder: 'https://vidopi.com/public/video2.mp4',
      },
      {
        displayName: 'Additional Fields',
        name: 'additionalFields',
        type: 'collection',
        placeholder: 'Add Field',
        default: {},
        options: [
          {
            displayName: 'Output Format',
            name: 'outputFormat',
            type: 'string',
            default: 'mp4',
            description: 'Output video format (mp4, avi, mov, etc.)',
          },
          {
            displayName: 'Merge Order',
            name: 'mergeOrder',
            type: 'options',
            options: [
              {
                name: 'First then Second',
                value: 'sequential',
              },
              {
                name: 'Side by Side',
                value: 'side_by_side',
              },
            ],
            default: 'sequential',
            description: 'How to merge the videos',
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
        const videoUrl1 = this.getNodeParameter('videoUrl1', i) as string;
        const videoUrl2 = this.getNodeParameter('videoUrl2', i) as string;
        const additionalFields = this.getNodeParameter('additionalFields', i) as {
          outputFormat?: string;
          mergeOrder?: string;
        };

        const body: any = {
          video_url_1: videoUrl1,
          video_url_2: videoUrl2,
        };

        if (additionalFields.outputFormat) {
          body.output_format = additionalFields.outputFormat;
        }

        if (additionalFields.mergeOrder) {
          body.merge_order = additionalFields.mergeOrder;
        }

        const response = await this.helpers.httpRequest({
          method: 'POST',
          url: 'https://api.vidopi.com/merge-video/',
          headers: {
            'X-API-Key': credentials.apiKey as string,
          },
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
exports.MergeVideos = MergeVideos;

