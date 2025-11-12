import {
  IDataObject,
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeConnectionType,
} from 'n8n-workflow';

interface VidopiCredentials {
  apiKey: string;
}

interface CutVideoRequestBody {
  public_link: string;
  start_time: number;
  end_time: number;
  output_format?: string;
}

interface CutVideoResponse extends IDataObject {
  task_id?: string;
}


class CutVideo implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Vidopi Cut Video',
    name: 'vidopiCutVideo',
    icon: 'file:../../../logo.png',
    group: ['transform'],
    version: 1,
    documentationUrl: 'https://dashboard.vidopi.com/api-docs',
    subtitle: 'Cut a segment from a video',
    description: 'Cut a segment from a video by specifying start and end times',
    defaults: {
      name: 'Vidopi Cut Video',
    },
    inputs: [NodeConnectionType.Main],
    outputs: [NodeConnectionType.Main],
    credentials: [
      {
        name: 'vidopiApi',
        required: true,
      },
    ],
    properties: [
      {
        displayName: 'Public Link',
        name: 'publicLink',
        type: 'string',
        default: 'https://download.samplelib.com/mp4/sample-10s.mp4',
        required: true,
        description: 'Public link or URL of the video to cut',
        placeholder: 'https://vidopi.com/public/video.mp4',
      },
      {
        displayName: 'Start Time (seconds)',
        name: 'startTime',
        type: 'number',
        default: 3,
        required: true,
        description: 'Start time in seconds for the cut segment',
      },
      {
        displayName: 'End Time (seconds)',
        name: 'endTime',
        type: 'number',
        default: 5,
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
    const credentials = (await this.getCredentials('vidopiApi')) as VidopiCredentials;

    for (let i = 0; i < items.length; i++) {
      try {
        const publicLink = this.getNodeParameter('publicLink', i) as string;
        const startTime = this.getNodeParameter('startTime', i) as number;
        const endTime = this.getNodeParameter('endTime', i) as number;
        const additionalFields = this.getNodeParameter('additionalFields', i) as {
          outputFormat?: string;
        };

        const body: CutVideoRequestBody = {
          public_link: publicLink,
          start_time: startTime,
          end_time: endTime,
        };

        if (additionalFields.outputFormat) {
          body.output_format = additionalFields.outputFormat;
        }

        // Start the cut video task
        const response = (await this.helpers.httpRequest({
          method: 'POST',
          url: 'https://api.vidopi.com/cut-video/',
          headers: {
            'X-API-Key': credentials.apiKey as string,
          },
          body,
          json: true,
        })) as CutVideoResponse;

        // Extract task ID from response
        const taskId = response.task_id;
        if (!taskId) {
          throw new Error('No task ID returned from API');
        }

        // Poll for task completion

        // Return the final result
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

