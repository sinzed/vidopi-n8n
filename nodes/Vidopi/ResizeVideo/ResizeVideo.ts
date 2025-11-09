import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';

interface VidopiCredentials {
  apiKey: string;
}

interface ResizeVideoRequestBody {
  video_url: string;
  width: number;
  height: number;
  maintain_aspect_ratio?: boolean;
  output_format?: string;
}

type ResizeVideoResponse = Record<string, unknown>;

class ResizeVideo implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Vidopi Resize Video',
    name: 'vidopiResizeVideo',
    icon: 'file:logo.png',
    group: ['transform'],
    version: 1,
    subtitle: 'Resize video dimensions',
    description: 'Resize video dimensions by specifying width and height in pixels',
    defaults: {
      name: 'Vidopi Resize Video',
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
        description: 'Public link or URL of the video to resize',
        placeholder: 'https://vidopi.com/public/video.mp4',
      },
      {
        displayName: 'Width',
        name: 'width',
        type: 'number',
        default: 1920,
        required: true,
        description: 'Width in pixels for the resized video',
      },
      {
        displayName: 'Height',
        name: 'height',
        type: 'number',
        default: 1080,
        required: true,
        description: 'Height in pixels for the resized video',
      },
      {
        displayName: 'Additional Fields',
        name: 'additionalFields',
        type: 'collection',
        placeholder: 'Add Field',
        default: {},
        options: [
          {
            displayName: 'Maintain Aspect Ratio',
            name: 'maintainAspectRatio',
            type: 'boolean',
            default: true,
            description: 'Whether to maintain the original aspect ratio',
          },
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
    const credentials = (await this.getCredentials('vidopiApi')) as VidopiCredentials;

    for (let i = 0; i < items.length; i++) {
      try {
        const videoUrl = this.getNodeParameter('videoUrl', i) as string;
        const width = this.getNodeParameter('width', i) as number;
        const height = this.getNodeParameter('height', i) as number;
        const additionalFields = this.getNodeParameter('additionalFields', i) as {
          maintainAspectRatio?: boolean;
          outputFormat?: string;
        };

        const body: ResizeVideoRequestBody = {
          video_url: videoUrl,
          width,
          height,
        };

        if (additionalFields.maintainAspectRatio !== undefined) {
          body.maintain_aspect_ratio = additionalFields.maintainAspectRatio;
        }

        if (additionalFields.outputFormat) {
          body.output_format = additionalFields.outputFormat;
        }

        const response = (await this.helpers.httpRequest({
          method: 'POST',
          url: 'https://api.vidopi.com/resize-video/',
          headers: {
            'X-API-Key': credentials.apiKey as string,
          },
          body,
          json: true,
        })) as ResizeVideoResponse;
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
exports.ResizeVideo = ResizeVideo;

