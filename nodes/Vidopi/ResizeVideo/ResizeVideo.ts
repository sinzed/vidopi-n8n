import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';

export class ResizeVideo implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Vidopi Resize Video',
    name: 'vidopiResizeVideo',
    icon: 'file:vidopi.svg',
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
    const credentials = await this.getCredentials('vidopiApi');

    for (let i = 0; i < items.length; i++) {
      try {
        const videoUrl = this.getNodeParameter('videoUrl', i) as string;
        const width = this.getNodeParameter('width', i) as number;
        const height = this.getNodeParameter('height', i) as number;
        const additionalFields = this.getNodeParameter('additionalFields', i) as {
          maintainAspectRatio?: boolean;
          outputFormat?: string;
        };

        const body: any = {
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

        const response = await this.helpers.httpRequest({
          method: 'POST',
          url: 'https://api.vidopi.com/resize-video/',
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

export default ResizeVideo;

