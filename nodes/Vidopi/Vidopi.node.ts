import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionType } from 'n8n-workflow';

import {
	DEFAULT_CONTENT_TYPE,
	fetchTaskStatus,
	guessContentType,
	parseUploadInitResponse,
	putToPresignedUrl,
	requireWebhookUrl,
	validateVideoForUpload,
	vidopiApiRequest,
} from './utils';

export class Vidopi implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Vidopi',
		name: 'vidopi',
		icon: 'file:logo.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Interact with the Vidopi video processing API',
		documentationUrl: 'https://dashboard.vidopi.com/api-docs',
		defaults: {
			name: 'Vidopi',
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
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Video',
						value: 'video',
					},
					{
						name: 'Task',
						value: 'task',
					},
				],
				default: 'video',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['video'],
					},
				},
				options: [
					{
						name: 'Upload',
						value: 'upload',
						description:
							'Upload a video via presigned URL (init → R2 → complete) and receive a public link',
						action: 'Upload a video',
					},
					{
						name: 'Cut',
						value: 'cut',
						description: 'Cut a segment from a video',
						action: 'Cut a video',
					},
					{
						name: 'Merge',
						value: 'merge',
						description: 'Merge two videos into one',
						action: 'Merge videos',
					},
					{
						name: 'Resize',
						value: 'resize',
						description: 'Resize video dimensions',
						action: 'Resize a video',
					},
				],
				default: 'upload',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['task'],
					},
				},
				options: [
					{
						name: 'Get Status',
						value: 'getStatus',
						description: 'Get the status of an asynchronous processing task',
						action: 'Get task status',
					},
				],
				default: 'getStatus',
			},
			// Upload
			{
				displayName: 'Binary Property',
				name: 'binaryPropertyName',
				type: 'string',
				default: 'data',
				description: 'Name of the binary property that contains the file to upload',
				displayOptions: {
					show: {
						resource: ['video'],
						operation: ['upload'],
					},
				},
			},
			// Cut
			{
				displayName: 'Public Video URL',
				name: 'publicLink',
				type: 'string',
				default: '',
				required: true,
				description: 'Public link of the video to cut (from upload or another source)',
				displayOptions: {
					show: {
						resource: ['video'],
						operation: ['cut'],
					},
				},
			},
			{
				displayName: 'Start Time (s)',
				name: 'startTime',
				type: 'number',
				default: 0,
				required: true,
				displayOptions: {
					show: {
						resource: ['video'],
						operation: ['cut'],
					},
				},
			},
			{
				displayName: 'End Time (s)',
				name: 'endTime',
				type: 'number',
				default: 10,
				required: true,
				displayOptions: {
					show: {
						resource: ['video'],
						operation: ['cut'],
					},
				},
			},
			// Merge
			{
				displayName: 'First Video Public Link',
				name: 'videoUrl1',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						resource: ['video'],
						operation: ['merge'],
					},
				},
			},
			{
				displayName: 'Second Video Public Link',
				name: 'videoUrl2',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						resource: ['video'],
						operation: ['merge'],
					},
				},
			},
			// Resize
			{
				displayName: 'Video URL',
				name: 'videoUrl',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						resource: ['video'],
						operation: ['resize'],
					},
				},
			},
			{
				displayName: 'Width',
				name: 'width',
				type: 'number',
				default: 1920,
				required: true,
				displayOptions: {
					show: {
						resource: ['video'],
						operation: ['resize'],
					},
				},
			},
			{
				displayName: 'Height',
				name: 'height',
				type: 'number',
				default: 1080,
				required: true,
				displayOptions: {
					show: {
						resource: ['video'],
						operation: ['resize'],
					},
				},
			},
			{
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				options: [
					{
						displayName: 'Maintain Aspect Ratio',
						name: 'maintainAspectRatio',
						type: 'boolean',
						default: true,
					},
					{
						displayName: 'Output Format',
						name: 'outputFormat',
						type: 'string',
						default: 'mp4',
					},
				],
				displayOptions: {
					show: {
						resource: ['video'],
						operation: ['resize'],
					},
				},
			},
			// Async operations webhook
			{
				displayName: 'Callback Webhook URL',
				name: 'webhookUrl',
				type: 'string',
				default: '={{ $node["Vidopi Trigger"].webhookUrl }}',
				required: true,
				description:
					'Webhook URL from the Vidopi Trigger node. Vidopi calls this URL when cut, merge, or resize processing completes.',
				displayOptions: {
					show: {
						resource: ['video'],
						operation: ['cut', 'merge', 'resize'],
					},
				},
			},
			// Task status
			{
				displayName: 'Task ID',
				name: 'taskId',
				type: 'string',
				default: '',
				required: true,
				description: 'Task ID returned by an asynchronous Vidopi operation',
				displayOptions: {
					show: {
						resource: ['task'],
						operation: ['getStatus'],
					},
				},
			},
			{
				displayName: 'Wait For Completion',
				name: 'waitForCompletion',
				type: 'boolean',
				default: true,
				description: 'Whether to poll the API until the task completes or fails',
				displayOptions: {
					show: {
						resource: ['task'],
						operation: ['getStatus'],
					},
				},
			},
			{
				displayName: 'Poll Interval (seconds)',
				name: 'pollInterval',
				type: 'number',
				default: 5,
				typeOptions: {
					minValue: 1,
				},
				displayOptions: {
					show: {
						resource: ['task'],
						operation: ['getStatus'],
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
				displayOptions: {
					show: {
						resource: ['task'],
						operation: ['getStatus'],
						waitForCompletion: [true],
					},
				},
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			const pushItem = (json: IDataObject) => {
				returnData.push({ json, pairedItem: { item: i } });
			};

			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;

				if (resource === 'video') {
					if (operation === 'upload') {
						pushItem(await uploadVideo(this, i, items));
					} else if (operation === 'cut') {
						pushItem(await cutVideo(this, i));
					} else if (operation === 'merge') {
						pushItem(await mergeVideos(this, i));
					} else if (operation === 'resize') {
						pushItem(await resizeVideo(this, i));
					} else {
						throw new Error(`Unknown video operation: ${operation}`);
					}
				} else if (resource === 'task') {
					if (operation === 'getStatus') {
						pushItem(await getTaskStatus(this, i));
					} else {
						throw new Error(`Unknown task operation: ${operation}`);
					}
				} else {
					throw new Error(`Unknown resource: ${resource}`);
				}
			} catch (error) {
				if (this.continueOnFail()) {
					pushItem({ error: error instanceof Error ? error.message : String(error) });
					continue;
				}
				throw error;
			}
		}

		return [returnData];
	}
}

async function uploadVideo(
	ctx: IExecuteFunctions,
	itemIndex: number,
	items: INodeExecutionData[],
): Promise<IDataObject> {
		const binaryPropertyName =
			(ctx.getNodeParameter('binaryPropertyName', itemIndex, '') as string) || 'data';
		let fileName = 'video.mp4';
		let fileBuffer: Buffer | undefined;
		let contentType = DEFAULT_CONTENT_TYPE;

		const binaryData = items[itemIndex].binary;

		if (!binaryPropertyName) {
			throw new Error('Please specify the Binary Property that contains the file to upload.');
		}

		if (!binaryData?.[binaryPropertyName]) {
			throw new Error(
				`Binary data not found. Ensure the previous node outputs binary data under the property name "${binaryPropertyName}".`,
			);
		}

		const binaryItem = binaryData[binaryPropertyName];
		fileName = binaryItem.fileName || fileName;
		contentType = binaryItem.mimeType || guessContentType(fileName);

		try {
			if (ctx.helpers.getBinaryDataBuffer) {
				fileBuffer = await ctx.helpers.getBinaryDataBuffer(itemIndex, binaryPropertyName);
			} else {
				fileBuffer = Buffer.from(binaryItem.data, 'base64');
			}
		} catch {
			fileBuffer = Buffer.from(binaryItem.data, 'base64');
		}

		if (!fileBuffer) {
			throw new Error('Unable to determine video file content for upload.');
		}

		validateVideoForUpload(fileName, contentType, fileBuffer.length);

		const initResponse = await vidopiApiRequest(ctx, {
			method: 'POST',
			url: 'https://api.vidopi.com/upload-video/init',
			body: {
				filename: fileName,
				content_type: contentType,
				file_size: fileBuffer.length,
			},
			json: true,
		});

		const { upload_url, object_key } = parseUploadInitResponse(initResponse);

		await putToPresignedUrl(ctx, upload_url, fileBuffer, contentType);

		const completeResponse = await vidopiApiRequest(ctx, {
			method: 'POST',
			url: 'https://api.vidopi.com/upload-video/complete',
			body: {
				object_key,
			},
			json: true,
		});

		return typeof completeResponse === 'string'
			? JSON.parse(completeResponse)
			: (completeResponse as IDataObject);
}

async function cutVideo(ctx: IExecuteFunctions, itemIndex: number): Promise<IDataObject> {
	const publicLink = ctx.getNodeParameter('publicLink', itemIndex) as string;
	const startTime = ctx.getNodeParameter('startTime', itemIndex) as number;
	const endTime = ctx.getNodeParameter('endTime', itemIndex) as number;
	const webhookUrl = requireWebhookUrl(
		ctx.getNodeParameter('webhookUrl', itemIndex) as string,
		'cut',
	);

	const response = await vidopiApiRequest(ctx, {
		method: 'POST',
		url: 'https://api.vidopi.com/cut-video/',
		body: {
			public_link: publicLink,
			start_time: startTime,
			end_time: endTime,
			webhook_url: webhookUrl,
		},
		json: true,
	});

	return {
		...(response as IDataObject),
		webhookUrl,
	};
}

async function mergeVideos(ctx: IExecuteFunctions, itemIndex: number): Promise<IDataObject> {
	const videoUrl1 = ctx.getNodeParameter('videoUrl1', itemIndex) as string;
	const videoUrl2 = ctx.getNodeParameter('videoUrl2', itemIndex) as string;
	const webhookUrl = requireWebhookUrl(
		ctx.getNodeParameter('webhookUrl', itemIndex) as string,
		'merge',
	);

	const response = await vidopiApiRequest(ctx, {
		method: 'POST',
		url: 'https://api.vidopi.com/merge-video/',
		body: {
			public_link_1: videoUrl1,
			public_link_2: videoUrl2,
			webhook_url: webhookUrl,
		},
		json: true,
	});

	return {
		...(response as IDataObject),
		webhookUrl,
	};
}

async function resizeVideo(ctx: IExecuteFunctions, itemIndex: number): Promise<IDataObject> {
	const videoUrl = ctx.getNodeParameter('videoUrl', itemIndex) as string;
	const width = ctx.getNodeParameter('width', itemIndex) as number;
	const height = ctx.getNodeParameter('height', itemIndex) as number;
	const additionalFields = ctx.getNodeParameter('additionalFields', itemIndex) as {
		maintainAspectRatio?: boolean;
		outputFormat?: string;
	};
	const webhookUrl = requireWebhookUrl(
		ctx.getNodeParameter('webhookUrl', itemIndex) as string,
		'resize',
	);

	const body: IDataObject = {
		public_link: videoUrl,
		webhook_url: webhookUrl,
		width,
		height,
	};

	if (additionalFields.maintainAspectRatio !== undefined) {
		body.maintain_aspect_ratio = additionalFields.maintainAspectRatio;
	}

	if (additionalFields.outputFormat) {
		body.output_format = additionalFields.outputFormat;
	}

	const response = await vidopiApiRequest(ctx, {
		method: 'POST',
		url: 'https://api.vidopi.com/resize-video/',
		body,
		json: true,
	});

	return {
		...(response as IDataObject),
		webhookUrl,
	};
}

async function getTaskStatus(ctx: IExecuteFunctions, itemIndex: number): Promise<IDataObject> {
	const taskId = ctx.getNodeParameter('taskId', itemIndex) as string;
	const waitForCompletion = ctx.getNodeParameter('waitForCompletion', itemIndex, true) as boolean;

	if (!waitForCompletion) {
		const status = await fetchTaskStatus(ctx, taskId);
		return { task_id: taskId, ...status };
	}

	let pollIntervalSeconds = ctx.getNodeParameter('pollInterval', itemIndex, 5) as number;
	let maxWaitTimeSeconds = ctx.getNodeParameter('maxWaitTime', itemIndex, 600) as number;

	pollIntervalSeconds =
		Number.isFinite(pollIntervalSeconds) && pollIntervalSeconds > 0 ? pollIntervalSeconds : 5;
	maxWaitTimeSeconds =
		Number.isFinite(maxWaitTimeSeconds) && maxWaitTimeSeconds > 0 ? maxWaitTimeSeconds : 600;

	const pollIntervalMs = pollIntervalSeconds * 1000;
	const maxAttempts = Math.max(1, Math.ceil(maxWaitTimeSeconds / pollIntervalSeconds));

	let status = await fetchTaskStatus(ctx, taskId);

	for (let attempt = 0; attempt < maxAttempts; attempt++) {
		if (status.status === 'SUCCESS' || status.status === 'FAILED') {
			return { task_id: taskId, ...status };
		}

		await ctx.putExecutionToWait(new Date(Date.now() + pollIntervalMs));
		status = await fetchTaskStatus(ctx, taskId);
	}

	if (status.status !== 'SUCCESS' && status.status !== 'FAILED') {
		throw new Error(
			`Task "${taskId}" did not finish within ${maxWaitTimeSeconds} seconds. Last known status: ${status.status}.`,
		);
	}

	return { task_id: taskId, ...status };
}

exports.Vidopi = Vidopi;
