import {
	IExecuteFunctions,
	IWebhookFunctions,
	IWebhookResponseData,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeConnectionType,
} from 'n8n-workflow';

// Date far in the future for indefinite wait (year 2099)
const WAIT_INDEFINITELY = new Date('2099-12-31T23:59:59.999Z');

export class VidopiWait implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Vidopi Wait',
		name: 'vidopiWaitNode',
		group: ['organization'],
		version: 1,
		description: 'Waits for Vidopi callback webhook on a dynamic path from Cut Video node',
		defaults: { name: 'Vidopi Wait' },
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				// Use dynamic path from Cut Video node output (from input data or node reference)
				path: '={{$input.item.json.dynamicPath || $node["Cut Video"].json["dynamicPath"]}}',
				restartWebhook: true,
			},
		],
		properties: [
			{
				displayName:
					'The webhook URL will be generated at run time from the Cut Video node output. It uses the <strong>dynamicPath</strong> field from the Cut Video node. <a href="https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.wait/?utm_source=n8n_app&utm_medium=node_settings_modal-credential_link&utm_campaign=n8n-nodes-base.wait" target="_blank">More info</a>',
				name: 'webhookNotice',
				type: 'notice',
				default: '',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		// Put execution to wait indefinitely until webhook is received
		await this.putExecutionToWait(WAIT_INDEFINITELY);
		// Return input data - execution will resume when webhook is received
		return [this.getInputData()];
	}

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const body = this.getBodyData();
		const headers = this.getHeaderData();
		const query = this.getQueryData();

		// Return webhook data to continue workflow execution
		return {
			workflowData: [
				[
					{
						json: {
							...(typeof body === 'object' && body !== null ? body : {}),
							webhook_body: body,
							webhook_headers: headers,
							webhook_query: query,
							timestamp: new Date().toISOString(),
						},
					},
				],
			],
		};
	}
}

// Export for CommonJS - n8n expects the export name to match the directory name
exports.Wait = VidopiWait;
