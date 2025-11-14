import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
	INodeType,
} from 'n8n-workflow';

import {
	NodeConnectionType,
} from 'n8n-workflow';

// Date far in the future for indefinite wait
const WAIT_INDEFINITELY = new Date('2099-12-31T23:59:59.999Z');

export class Wait implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Vidopi Wait',
		name: 'vidopiWait',
		icon: 'file:../../../logo.png',
		group: ['organization'],
		version: 1,
		description: 'Wait for webhook POST call with JSON body before continuing execution',
		defaults: {
			name: 'Vidopi Wait',
			color: '#804050',
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: '',
				restartWebhook: true,
			},
		],
		properties: [
			{
				displayName:
					'The webhook URL will be generated at run time. It can be referenced with the <strong>$execution.resumeUrl</strong> variable. Send it somewhere before getting to this node.',
				name: 'webhookNotice',
				type: 'notice',
				default: '',
			},
		],
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		// Get incoming webhook data
		const body = this.getBodyData();
		const headers = this.getHeaderData();
		const query = this.getQueryData();
		const req = this.getRequestObject();

		// Prepare workflow data from webhook JSON body
		const workflowData: INodeExecutionData[] = [
			{
				json: {
					// Spread JSON body properties directly into the output
					...(typeof body === 'object' && body !== null ? body : {}),
					// Also include raw webhook data for reference
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

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		// Put execution to wait indefinitely until webhook POST is received
		await this.putExecutionToWait(WAIT_INDEFINITELY);
		// Return input data - execution will resume when webhook is received
		return [this.getInputData()];
	}
}

// Export for CommonJS
exports.Wait = Wait;
