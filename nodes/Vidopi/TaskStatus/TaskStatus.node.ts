import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeConnectionType,
} from 'n8n-workflow';

interface VidopiCredentials {
  apiKey: string;
}

type VidopiTaskStatus = 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED';

interface TaskStatusErrorResult {
  error?: unknown;
  [key: string]: unknown;
}

interface TaskStatusResponse {
  status: VidopiTaskStatus;
  result?: TaskStatusErrorResult | null;
  download_url?: string;
  [key: string]: unknown;
}

const fetchTaskStatus = async (
  executeFunctions: IExecuteFunctions,
  taskId: string,
  credentials: VidopiCredentials
): Promise<TaskStatusResponse> => {
  const response = (await executeFunctions.helpers.httpRequest({
    method: 'GET',
    url: `https://api.vidopi.com/task-status/${taskId}`,
    headers: {
      'X-API-Key': credentials.apiKey as string,
    },
    json: true,
  })) as TaskStatusResponse;

  return response;
};

class TaskStatus implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Vidopi Task Status',
    name: 'vidopiTaskStatus',
    icon: 'file:../logo.png',
    group: ['transform'],
    version: 1,
    documentationUrl: 'https://dashboard.vidopi.com/api-docs',
    subtitle: 'Check a processing task',
    description: 'Fetch the current status and result details for a Vidopi processing task',
    defaults: {
      name: 'Vidopi Task Status',
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
        displayName: 'Task ID',
        name: 'taskId',
        type: 'string',
        default: '',
        required: true,
        description: 'Identifier returned when you start an asynchronous Vidopi task',
        placeholder: 'abc123',
      },
      {
        displayName: 'Wait For Completion',
        name: 'waitForCompletion',
        type: 'boolean',
        default: true,
        description: 'Whether to poll the API until the task completes or fails',
      },
      {
        displayName: 'Poll Interval (seconds)',
        name: 'pollInterval',
        type: 'number',
        default: 5,
        typeOptions: {
          minValue: 1,
        },
        description: 'Seconds to wait between status checks',
        displayOptions: {
          show: {
            waitForCompletion: [true],
          },
        },
      },
      {
        displayName: 'Max Wait Time (seconds)',
        name: 'maxWaitTime',
        type: 'number',
        default: 600,
        typeOptions: {
          minValue: 5,
        },
        description: 'Maximum amount of time to wait for completion before timing out',
        displayOptions: {
          show: {
            waitForCompletion: [true],
          },
        },
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];
    const credentials = (await this.getCredentials('vidopiApi')) as VidopiCredentials;

    for (let i = 0; i < items.length; i++) {
      try {
        const taskId = this.getNodeParameter('taskId', i) as string;
        const waitForCompletion = this.getNodeParameter('waitForCompletion', i, true) as boolean;

        let pollIntervalSeconds = this.getNodeParameter('pollInterval', i, 5) as number;
        let maxWaitTimeSeconds = this.getNodeParameter('maxWaitTime', i, 600) as number;

        pollIntervalSeconds = Number.isFinite(pollIntervalSeconds) && pollIntervalSeconds > 0 ? pollIntervalSeconds : 5;
        maxWaitTimeSeconds = Number.isFinite(maxWaitTimeSeconds) && maxWaitTimeSeconds > 0 ? maxWaitTimeSeconds : 600;

        if (!waitForCompletion) {
          const status = await fetchTaskStatus(this, taskId, credentials);
          returnData.push({
            json: {
              task_id: taskId,
              ...status,
            },
          });
          continue;
        }

        const pollIntervalMs = pollIntervalSeconds * 1000;
        const maxAttempts = Math.max(1, Math.ceil(maxWaitTimeSeconds / pollIntervalSeconds));

        let status: TaskStatusResponse | undefined;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          status = await fetchTaskStatus(this, taskId, credentials);

          if (status.status === 'SUCCESS' || status.status === 'FAILED') {
            break;
          }

          await this.putExecutionToWait(new Date(Date.now() + pollIntervalMs));
        }

        if (!status) {
          throw new Error('No response received from Vidopi API.');
        }

        if (status.status !== 'SUCCESS' && status.status !== 'FAILED') {
          throw new Error(
            `Task "${taskId}" did not finish within ${maxWaitTimeSeconds} seconds. Last known status: ${status.status}.`
          );
        }

        returnData.push({
          json: {
            task_id: taskId,
            ...status,
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
exports.TaskStatus = TaskStatus;


