import type {
	IWebhookFunctions,
	IWebhookResponseData,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionType } from 'n8n-workflow';

export class VidopiTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Vidopi Trigger',
		name: 'vidopiTrigger',
		icon: 'file:logo.svg',
		group: ['trigger'],
		version: 1,
		documentationUrl: 'https://dashboard.vidopi.com/api-docs',
		description: 'Starts the workflow when Vidopi sends a webhook callback after video processing completes',
		defaults: {
			name: 'Vidopi Trigger',
		},
		inputs: [],
		outputs: [NodeConnectionType.Main],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'vidopi',
			},
		],
		properties: [
			{
				displayName:
					'Use the production webhook URL shown above (or copy it from this node when the workflow is active) as the Callback Webhook URL in Vidopi video operations (cut, merge, resize).',
				name: 'webhookNotice',
				type: 'notice',
				default: '',
			},
		],
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const body = this.getBodyData();
		const headers = this.getHeaderData();
		const query = this.getQueryData();
		const req = this.getRequestObject();

		const workflowData: INodeExecutionData[] = [
			{
				json: {
					...(typeof body === 'object' && body !== null ? body : { body }),
					webhook_body: body,
					webhook_headers: headers,
					webhook_query: query,
					webhook_method: req.method,
					webhook_url: req.url,
					timestamp: new Date().toISOString(),
				},
			},
		];

		return {
			workflowData: [workflowData],
		};
	}
}

exports.VidopiTrigger = VidopiTrigger;
