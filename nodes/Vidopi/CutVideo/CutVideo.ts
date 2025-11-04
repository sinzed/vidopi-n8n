import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';

class CutVideo implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Vidopi Cut Video',
    name: 'vidopiCutVideo',
    icon: 'file:logo.png',
    group: ['transform'],
    version: 1,
    subtitle: 'Cut a segment from a video',
    description: 'Cut a segment from a video by specifying start and end times',
    defaults: {
      name: 'Vidopi Cut Video',
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
        displayName: 'Video URL',
        name: 'videoUrl',
        type: 'string',
        default: '',
        required: true,
        description: 'Public link or URL of the video to cut',
        placeholder: 'https://vidopi.com/public/video.mp4',
      },
      {
        displayName: 'Start Time (seconds)',
        name: 'startTime',
        type: 'number',
        default: 0,
        required: true,
        description: 'Start time in seconds for the cut segment',
      },
      {
        displayName: 'End Time (seconds)',
        name: 'endTime',
        type: 'number',
        default: 10,
        required: true,
        description: 'End time in seconds for the cut segment',
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
        const videoUrl = this.getNodeParameter('videoUrl', i) as string;
        const startTime = this.getNodeParameter('startTime', i) as number;
        const endTime = this.getNodeParameter('endTime', i) as number;
        const additionalFields = this.getNodeParameter('additionalFields', i) as {
          outputFormat?: string;
        };

        const body: any = {
          video_url: videoUrl,
          start_time: startTime,
          end_time: endTime,
        };

        if (additionalFields.outputFormat) {
          body.output_format = additionalFields.outputFormat;
        }

        const response = await this.helpers.httpRequest({
          method: 'POST',
          url: 'https://api.vidopi.com/cut-video/',
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
exports.CutVideo = CutVideo;

