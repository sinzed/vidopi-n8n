import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';

export class TaskStatus implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Vidopi Task Status',
    name: 'vidopiTaskStatus',
    icon: 'file:vidopi.svg',
    group: ['transform'],
    version: 1,
    subtitle: 'Check task status and results',
    description: 'Check the status and get results of asynchronous video processing tasks',
    defaults: {
      name: 'Vidopi Task Status',
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
        displayName: 'Task ID',
        name: 'taskId',
        type: 'string',
        default: '',
        required: true,
        description: 'The task ID returned from a video processing operation',
        placeholder: 'task_123456789',
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];
    const credentials = await this.getCredentials('vidopiApi');

    for (let i = 0; i < items.length; i++) {
      try {
        const taskId = this.getNodeParameter('taskId', i) as string;

        const response = await this.helpers.httpRequest({
          method: 'GET',
          url: `${credentials.baseUrl}/task-status/${taskId}`,
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

