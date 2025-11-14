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
  webhook_url: string;
}

interface MergeVideoTaskResponse extends IDataObject {
  task_id?: string;
  status?: string;
}

interface WebhookDestination {
  webhookUrl: string;
  dynamicPath?: string;
}

const resolveWebhookDestination = (
  executeFunctions: IExecuteFunctions,
  resumeUrl?: string,
): WebhookDestination => {
  if (resumeUrl && resumeUrl.trim() !== '') {
    return { webhookUrl: resumeUrl.trim() };
  }

  const dynamicPath = `vidopi-wait-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  const baseUrl = executeFunctions.getRestApiUrl().replace('/rest', '');

  return {
    webhookUrl: `${baseUrl}/webhook/${dynamicPath}`,
    dynamicPath,
  };
};

class MergeVideos implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Vidopi Merge Videos',
    name: 'vidopiMergeVideos',
    icon: 'file:../logo.png',
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
      {
        displayName: 'Resume URL (from Wait node)',
        name: 'resume_url',
        type: 'string',
        default: '={{$execution.resumeUrl}}',
        description:
          "Optional: Use {{$execution.resumeUrl}} from n8n's Wait node so Vidopi can resume the workflow when merging finishes. Leave empty to auto-generate a webhook path.",
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
        const resumeUrl = this.getNodeParameter('resume_url', i, '') as string;
        const { webhookUrl, dynamicPath } = resolveWebhookDestination(this, resumeUrl);

        const body: MergeVideosRequestBody = {
          public_link_1: videoUrl1,
          public_link_2: videoUrl2,
          webhook_url: webhookUrl,
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

        const result: IDataObject = {
          ...response,
          webhookUrl,
        };

        if (dynamicPath) {
          result.dynamicPath = dynamicPath;
        }

        returnData.push({ json: result });
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

