import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeConnectionType,
} from 'n8n-workflow';

export class CutVideo implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Vidopi Cut Video',
		name: 'cutVideo',
		icon: 'file:../../../logo.png',
		group: ['transform'],
		version: 1,
		description: 'Send video cut request to Vidopi. Can use n8n Wait node resume URL or generate dynamic webhook path',
		defaults: { name: 'Cut Video' },
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
				displayName: 'Public Video URL',
				name: 'public_link',
				type: 'string',
				default: 'https://download.samplelib.com/mp4/sample-10s.mp4',
				required: true,
			},
			{
				displayName: 'Start Time (s)',
				name: 'start_time',
				type: 'number',
				default: 3,
				required: true,
			},
			{
				displayName: 'End Time (s)',
				name: 'end_time',
				type: 'number',
				default: 5,
				required: true,
			},
			{
				displayName: 'Resume URL (from Wait node)',
				name: 'resume_url',
				type: 'string',
				default: '',
				description: 'Optional: Use {{$execution.resumeUrl}} from n8n\'s built-in Wait node. If provided, Vidopi will call this URL when the video cut is complete, resuming the Wait node. If not provided, a dynamic webhook path will be generated instead.',
				required: false,
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const results: INodeExecutionData[] = [];
		const credentials = await this.getCredentials('vidopiApi');

		for (let i = 0; i < items.length; i++) {
			const public_link = this.getNodeParameter('public_link', i) as string;
			const start_time = this.getNodeParameter('start_time', i) as number;
			const end_time = this.getNodeParameter('end_time', i) as number;
			const resume_url = this.getNodeParameter('resume_url', i, '') as string;

			let webhookUrl: string;
			let dynamicPath: string | undefined;

			// If resume URL is provided (from Wait node), use it
			// Otherwise, generate a dynamic webhook path (legacy behavior)
			if (resume_url && resume_url.trim() !== '') {
				webhookUrl = resume_url.trim();
			} else {
				// Generate a unique dynamic webhook path
				dynamicPath = `vidopi-wait-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

				// Build full URL for this webhook
				const baseUrl = this.getRestApiUrl().replace('/rest', '');
				webhookUrl = `${baseUrl}/webhook/${dynamicPath}`;
			}

			// Call Vidopi API
			const response = await this.helpers.httpRequest({
				method: 'POST',
				url: 'https://api.vidopi.com/cut-video/',
				headers: {
					'X-API-Key': credentials.apiKey as string,
				},
				body: {
					public_link,
					start_time,
					end_time,
					webhook_url: webhookUrl,
				},
				json: true,
			});

			const resultData: any = {
				...response,
				webhookUrl,
			};

			// Only include dynamicPath if we generated one (legacy mode)
			if (dynamicPath) {
				resultData.dynamicPath = dynamicPath;
			}

			results.push({
				json: resultData,
			});
		}

		return [results];
	}
}
