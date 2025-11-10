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

interface MergeVideosRequestBody {
  public_link_1: string;
  public_link_2: string;
}

interface MergeVideoTaskResponse extends IDataObject {
  task_id?: string;
  status?: string;
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

async function pollTaskStatus(
  executeFunctions: IExecuteFunctions,
  taskId: string,
  credentials: VidopiCredentials,
  maxAttempts: number = 120,
  delayMs: number = 5000,
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

      if (statusResponse.status === 'SUCCESS') {
        return statusResponse;
      }

      if (statusResponse.status === 'FAILED') {
        throw new Error(
          `Task failed: ${JSON.stringify(statusResponse.result?.error || statusResponse.result)}`,
        );
      }
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Task failed:')) {
        throw error;
      }
      if (attempt === maxAttempts - 1) {
        throw error;
      }
    }
    await executeFunctions.putExecutionToWait(new Date(Date.now() + 5000));
  }

  throw new Error('Task timed out after waiting for the merge to complete.');
}

class MergeVideos implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Vidopi Merge Videos',
    name: 'vidopiMergeVideos',
    icon: 'file:../../../logo.png',
    group: ['transform'],
    version: 1,
    documentationUrl: 'https://dashboard.vidopi.com/api-docs',
    subtitle: 'Merge two videos together',
    description: 'Merge two videos together into a single video file',
    defaults: {
      name: 'Vidopi Merge Videos',
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
        displayName: 'First Video Public Link',
        name: 'videoUrl1',
        type: 'string',
        default: '',
        required: true,
        description: 'Public link returned by the Upload Video node for the first video',
        placeholder: 'https://api.vidopi.com/files/abc123.mp4',
      },
      {
        displayName: 'Second Video Public Link',
        name: 'videoUrl2',
        type: 'string',
        default: '',
        required: true,
        description: 'Public link returned by the Upload Video node for the second video',
        placeholder: 'https://api.vidopi.com/files/def456.mp4',
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];
    const credentials = (await this.getCredentials('vidopiApi')) as VidopiCredentials;

    for (let i = 0; i < items.length; i++) {
      try {
        const videoUrl1 = this.getNodeParameter('videoUrl1', i) as string;
        const videoUrl2 = this.getNodeParameter('videoUrl2', i) as string;

        const body: MergeVideosRequestBody = {
          public_link_1: videoUrl1,
          public_link_2: videoUrl2,
        };

        const response = (await this.helpers.httpRequest({
          method: 'POST',
          url: 'https://api.vidopi.com/merge-video/',
          headers: {
            'X-API-Key': credentials.apiKey as string,
          },
          body,
          json: true,
        })) as MergeVideoTaskResponse;

        const taskId = response.task_id;

        if (!taskId) {
          returnData.push({ json: response });
          continue;
        }

        const finalResult = await pollTaskStatus(this, taskId, credentials);

        returnData.push({
          json: {
            ...response,
            task_id: taskId,
            status: finalResult.status,
            result: finalResult.result,
            download_url: finalResult.download_url,
          },
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
exports.MergeVideos = MergeVideos;

