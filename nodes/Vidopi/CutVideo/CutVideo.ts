import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
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

interface TaskStatusErrorResult {
  error?: unknown;
  [key: string]: unknown;
}

interface TaskStatusResponse {
  status: 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED';
  result?: TaskStatusErrorResult | null;
  download_url?: string;
  [key: string]: unknown;
}

interface CutVideoResponse {
  task_id?: string;
  [key: string]: unknown;
}

async function pollTaskStatus(
  executeFunctions: IExecuteFunctions,
  taskId: string,
  credentials: VidopiCredentials,
  maxAttempts: number = 120 // 10 minutes max (120 * 5 seconds)
): Promise<TaskStatusResponse> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const statusResponse = (await executeFunctions.helpers.httpRequest({
        method: 'GET',
        url: `https://api.vidopi.com/task-status/${taskId}`,
        headers: {
          'X-API-Key': credentials.apiKey as string,
        },
        json: true,
      })) as TaskStatusResponse;

      // Check if task is complete
      if (statusResponse.status === 'SUCCESS') {
        return statusResponse;
      } else if (statusResponse.status === 'FAILED') {
        throw new Error(`Task failed: ${JSON.stringify(statusResponse.result?.error || statusResponse.result)}`);
      }

      // Wait 5 seconds before next poll
      await new Promise(resolve => setTimeout(resolve, 5000));
    } catch (error) {
      // If it's a task failure error, throw it
      if (error instanceof Error && error.message.includes('Task failed')) {
        throw error;
      }
      // Otherwise, continue polling (might be temporary network issue)
      if (attempt === maxAttempts - 1) {
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  throw new Error('Task timed out after 10 minutes');
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
        displayName: 'Public Link',
        name: 'publicLink',
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
        const finalResult = await pollTaskStatus(this, taskId, credentials);

        // Return the final result
        returnData.push({ 
          json: {
            task_id: taskId,
            status: finalResult.status,
            result: finalResult.result,
            download_url: finalResult.download_url,
          }
        });
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

