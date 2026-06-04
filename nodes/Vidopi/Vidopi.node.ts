import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionType } from 'n8n-workflow';

import {
	appendDefinedFields,
	DEFAULT_CONTENT_TYPE,
	fetchTaskStatus,
	guessContentType,
	parseUploadInitResponse,
	putToPresignedUrl,
	requireWebhookUrl,
	submitAsyncVideoJob,
	validateVideoForUpload,
	vidopiApiRequest,
} from './utils';

const ASYNC_VIDEO_OPERATIONS = [
	'cut',
	'merge',
	'resize',
	'crop',
	'rotate',
	'speed',
	'compress',
	'extractAudio',
	'composeAudio',
	'imageOverlay',
	'textOverlay',
	'generateThumbnail',
] as const;

const API_BASE = 'https://api.vidopi.com';

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
						name: 'File',
						value: 'file',
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
					{
						name: 'Crop',
						value: 'crop',
						description: 'Crop a video to a rectangular region',
						action: 'Crop a video',
					},
					{
						name: 'Rotate',
						value: 'rotate',
						description: 'Rotate a video by an angle in degrees',
						action: 'Rotate a video',
					},
					{
						name: 'Speed',
						value: 'speed',
						description: 'Change video playback speed',
						action: 'Change video speed',
					},
					{
						name: 'Compress',
						value: 'compress',
						description: 'Compress or transcode a video',
						action: 'Compress a video',
					},
					{
						name: 'Extract Audio',
						value: 'extractAudio',
						description: 'Extract audio from a video',
						action: 'Extract audio from a video',
					},
					{
						name: 'Compose Audio',
						value: 'composeAudio',
						description: 'Add or mix an audio track onto a video',
						action: 'Compose audio on a video',
					},
					{
						name: 'Image Overlay',
						value: 'imageOverlay',
						description: 'Add an image overlay (watermark, logo, etc.)',
						action: 'Add an image overlay',
					},
					{
						name: 'Text Overlay',
						value: 'textOverlay',
						description: 'Add text overlay to a video',
						action: 'Add a text overlay',
					},
					{
						name: 'Generate Thumbnail',
						value: 'generateThumbnail',
						description: 'Generate a thumbnail image from a video',
						action: 'Generate a thumbnail',
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
						resource: ['file'],
					},
				},
				options: [
					{
						name: 'Get Info',
						value: 'getInfo',
						description: 'Get information about an uploaded file',
						action: 'Get file info',
					},
				],
				default: 'getInfo',
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
			// Shared public link (most async video operations)
			{
				displayName: 'Public Video URL',
				name: 'publicLink',
				type: 'string',
				default: '',
				required: true,
				description: 'Public link of the video (from upload or another source)',
				displayOptions: {
					show: {
						resource: ['video'],
						operation: [
							'cut',
							'rotate',
							'speed',
							'compress',
							'extractAudio',
							'composeAudio',
							'imageOverlay',
							'textOverlay',
							'generateThumbnail',
						],
					},
				},
			},
			// Crop
			{
				displayName: 'File ID',
				name: 'fileId',
				type: 'string',
				default: '',
				required: true,
				description: 'File ID of the video to crop (from upload response or File → Get Info)',
				displayOptions: {
					show: {
						resource: ['video'],
						operation: ['crop'],
					},
				},
			},
			{
				displayName: 'X',
				name: 'cropX',
				type: 'number',
				default: 0,
				required: true,
				description: 'X offset of the crop region in pixels',
				displayOptions: {
					show: {
						resource: ['video'],
						operation: ['crop'],
					},
				},
			},
			{
				displayName: 'Y',
				name: 'cropY',
				type: 'number',
				default: 0,
				required: true,
				description: 'Y offset of the crop region in pixels',
				displayOptions: {
					show: {
						resource: ['video'],
						operation: ['crop'],
					},
				},
			},
			{
				displayName: 'Crop Width',
				name: 'cropWidth',
				type: 'number',
				default: 1920,
				required: true,
				displayOptions: {
					show: {
						resource: ['video'],
						operation: ['crop'],
					},
				},
			},
			{
				displayName: 'Crop Height',
				name: 'cropHeight',
				type: 'number',
				default: 1080,
				required: true,
				displayOptions: {
					show: {
						resource: ['video'],
						operation: ['crop'],
					},
				},
			},
			// Rotate
			{
				displayName: 'Angle (degrees)',
				name: 'angle',
				type: 'number',
				default: 90,
				required: true,
				displayOptions: {
					show: {
						resource: ['video'],
						operation: ['rotate'],
					},
				},
			},
			// Speed
			{
				displayName: 'Speed Factor',
				name: 'speedFactor',
				type: 'number',
				default: 1,
				required: true,
				description: 'Playback multiplier (e.g. 0.5 for half speed, 2 for double)',
				displayOptions: {
					show: {
						resource: ['video'],
						operation: ['speed'],
					},
				},
			},
			// Compose audio
			{
				displayName: 'Audio Public URL',
				name: 'audioPublicLink',
				type: 'string',
				default: '',
				required: true,
				description: 'Public URL of the audio file (mp3, wav, m4a, aac, ogg, flac)',
				displayOptions: {
					show: {
						resource: ['video'],
						operation: ['composeAudio'],
					},
				},
			},
			// Image overlay
			{
				displayName: 'Image Public URL',
				name: 'imagePublicLink',
				type: 'string',
				default: '',
				required: true,
				description: 'Public URL of the overlay image (PNG with transparency recommended)',
				displayOptions: {
					show: {
						resource: ['video'],
						operation: ['imageOverlay'],
					},
				},
			},
			// Text overlay
			{
				displayName: 'Text',
				name: 'overlayText',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						resource: ['video'],
						operation: ['textOverlay'],
					},
				},
			},
			// Compress additional fields
			{
				displayName: 'Additional Fields',
				name: 'compressAdditionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				options: [
					{
						displayName: 'Bitrate',
						name: 'bitrate',
						type: 'string',
						default: '1000k',
						description: 'Target bitrate (e.g. 1000k, 2000k)',
					},
					{
						displayName: 'FPS',
						name: 'fps',
						type: 'number',
						default: 0,
						description: 'Target frames per second',
					},
					{
						displayName: 'Resolution Scale',
						name: 'resolutionScale',
						type: 'number',
						default: 1,
						description: 'Scale factor from 0.0 to 1.0',
					},
				],
				displayOptions: {
					show: {
						resource: ['video'],
						operation: ['compress'],
					},
				},
			},
			// Extract audio additional fields
			{
				displayName: 'Additional Fields',
				name: 'extractAudioAdditionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				options: [
					{
						displayName: 'Start Time (s)',
						name: 'startTime',
						type: 'number',
						default: 0,
					},
					{
						displayName: 'End Time (s)',
						name: 'endTime',
						type: 'number',
						default: 0,
						description: 'Leave at 0 to use end of video',
					},
					{
						displayName: 'Format',
						name: 'format',
						type: 'string',
						default: 'mp3',
					},
				],
				displayOptions: {
					show: {
						resource: ['video'],
						operation: ['extractAudio'],
					},
				},
			},
			// Compose audio additional fields
			{
				displayName: 'Additional Fields',
				name: 'composeAudioAdditionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				options: [
					{
						displayName: 'Mode',
						name: 'mode',
						type: 'options',
						options: [
							{ name: 'Replace', value: 'replace' },
							{ name: 'Mix', value: 'mix' },
						],
						default: 'replace',
						description: 'Replace existing audio or mix with it',
					},
					{
						displayName: 'Audio Start Time (s)',
						name: 'audioStartTime',
						type: 'number',
						default: 0,
					},
					{
						displayName: 'Audio Offset (s)',
						name: 'audioOffset',
						type: 'number',
						default: 0,
						description: 'Trim this many seconds from the start of the audio file',
					},
					{
						displayName: 'Video Volume',
						name: 'videoVolume',
						type: 'number',
						default: 1,
						description: 'Existing video audio volume when mode is mix',
					},
					{
						displayName: 'Audio Volume',
						name: 'audioVolume',
						type: 'number',
						default: 1,
					},
					{
						displayName: 'Duration (s)',
						name: 'duration',
						type: 'number',
						default: 0,
						description: 'Maximum duration to use from the audio file (0 = no limit)',
					},
				],
				displayOptions: {
					show: {
						resource: ['video'],
						operation: ['composeAudio'],
					},
				},
			},
			// Image overlay additional fields
			{
				displayName: 'Additional Fields',
				name: 'imageOverlayAdditionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				options: [
					{
						displayName: 'Position',
						name: 'position',
						type: 'options',
						options: [
							{ name: 'Bottom Right', value: 'bottom-right' },
							{ name: 'Bottom Left', value: 'bottom-left' },
							{ name: 'Top Right', value: 'top-right' },
							{ name: 'Top Left', value: 'top-left' },
							{ name: 'Center', value: 'center' },
							{ name: 'Top', value: 'top' },
							{ name: 'Bottom', value: 'bottom' },
							{ name: 'Left', value: 'left' },
							{ name: 'Right', value: 'right' },
						],
						default: 'bottom-right',
					},
					{
						displayName: 'Width',
						name: 'width',
						type: 'number',
						default: 0,
						description: 'Resize overlay width in pixels (0 = original)',
					},
					{
						displayName: 'Height',
						name: 'height',
						type: 'number',
						default: 0,
						description: 'Resize overlay height in pixels (0 = original)',
					},
					{
						displayName: 'Opacity',
						name: 'opacity',
						type: 'number',
						default: 1,
						description: '0 (transparent) to 1 (opaque)',
					},
					{
						displayName: 'Start Time (s)',
						name: 'startTime',
						type: 'number',
						default: 0,
					},
					{
						displayName: 'Duration (s)',
						name: 'duration',
						type: 'number',
						default: 0,
						description: 'Overlay duration (0 = full video)',
					},
					{
						displayName: 'Margin',
						name: 'margin',
						type: 'number',
						default: 12,
						description: 'Padding from frame edges in pixels',
					},
				],
				displayOptions: {
					show: {
						resource: ['video'],
						operation: ['imageOverlay'],
					},
				},
			},
			// Text overlay additional fields
			{
				displayName: 'Additional Fields',
				name: 'textOverlayAdditionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				options: [
					{
						displayName: 'Position',
						name: 'position',
						type: 'options',
						options: [
							{ name: 'Center', value: 'center' },
							{ name: 'Top', value: 'top' },
							{ name: 'Bottom', value: 'bottom' },
						],
						default: 'center',
					},
					{
						displayName: 'Font Size',
						name: 'fontsize',
						type: 'number',
						default: 50,
					},
					{
						displayName: 'Color',
						name: 'color',
						type: 'string',
						default: 'white',
					},
					{
						displayName: 'Start Time (s)',
						name: 'startTime',
						type: 'number',
						default: 0,
					},
					{
						displayName: 'Duration (s)',
						name: 'duration',
						type: 'number',
						default: 0,
						description: 'Overlay duration (0 = full video)',
					},
					{
						displayName: 'Font',
						name: 'font',
						type: 'string',
						default: '',
					},
				],
				displayOptions: {
					show: {
						resource: ['video'],
						operation: ['textOverlay'],
					},
				},
			},
			// Thumbnail additional fields
			{
				displayName: 'Additional Fields',
				name: 'thumbnailAdditionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				options: [
					{
						displayName: 'Time (s)',
						name: 'time',
						type: 'number',
						default: 0,
						description: 'Time in the video to capture the thumbnail',
					},
					{
						displayName: 'Width',
						name: 'width',
						type: 'number',
						default: 0,
						description: 'Thumbnail width (0 = auto)',
					},
					{
						displayName: 'Height',
						name: 'height',
						type: 'number',
						default: 0,
						description: 'Thumbnail height (0 = auto)',
					},
					{
						displayName: 'Format',
						name: 'format',
						type: 'options',
						options: [
							{ name: 'JPG', value: 'jpg' },
							{ name: 'PNG', value: 'png' },
						],
						default: 'jpg',
					},
				],
				displayOptions: {
					show: {
						resource: ['video'],
						operation: ['generateThumbnail'],
					},
				},
			},
			// File get info
			{
				displayName: 'File ID',
				name: 'fileId',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						resource: ['file'],
						operation: ['getInfo'],
					},
				},
			},
			// Async operations webhook
			{
				displayName:
					'Add a **Vidopi Trigger** node to this workflow, activate the workflow, then paste the trigger’s **Production URL** into **Callback Webhook URL** below.',
				name: 'webhookNotice',
				type: 'notice',
				default: '',
				displayOptions: {
					show: {
						resource: ['video'],
						operation: [...ASYNC_VIDEO_OPERATIONS],
					},
				},
			},
			{
				displayName: 'Callback Webhook URL',
				name: 'webhookUrl',
				type: 'string',
				default: '',
				required: true,
				placeholder: 'https://your-n8n.example.com/webhook/...',
				description:
					'Production webhook URL from the Vidopi Trigger node (shown on the trigger when the workflow is active). Vidopi POSTs here when processing completes.',
				displayOptions: {
					show: {
						resource: ['video'],
						operation: [...ASYNC_VIDEO_OPERATIONS],
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
					} else if (operation === 'crop') {
						pushItem(await cropVideo(this, i));
					} else if (operation === 'rotate') {
						pushItem(await rotateVideo(this, i));
					} else if (operation === 'speed') {
						pushItem(await speedVideo(this, i));
					} else if (operation === 'compress') {
						pushItem(await compressVideo(this, i));
					} else if (operation === 'extractAudio') {
						pushItem(await extractAudioVideo(this, i));
					} else if (operation === 'composeAudio') {
						pushItem(await composeAudioVideo(this, i));
					} else if (operation === 'imageOverlay') {
						pushItem(await imageOverlayVideo(this, i));
					} else if (operation === 'textOverlay') {
						pushItem(await textOverlayVideo(this, i));
					} else if (operation === 'generateThumbnail') {
						pushItem(await generateThumbnail(this, i));
					} else {
						throw new Error(`Unknown video operation: ${operation}`);
					}
				} else if (resource === 'file') {
					if (operation === 'getInfo') {
						pushItem(await getFileInfo(this, i));
					} else {
						throw new Error(`Unknown file operation: ${operation}`);
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
			url: `${API_BASE}/upload-video/init`,
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
			url: `${API_BASE}/upload-video/complete`,
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
	return submitAsyncVideoJob(ctx, itemIndex, 'cut', `${API_BASE}/cut-video/`, {
		public_link: ctx.getNodeParameter('publicLink', itemIndex) as string,
		start_time: ctx.getNodeParameter('startTime', itemIndex) as number,
		end_time: ctx.getNodeParameter('endTime', itemIndex) as number,
	});
}

async function mergeVideos(ctx: IExecuteFunctions, itemIndex: number): Promise<IDataObject> {
	return submitAsyncVideoJob(ctx, itemIndex, 'merge', `${API_BASE}/merge-video/`, {
		public_link_1: ctx.getNodeParameter('videoUrl1', itemIndex) as string,
		public_link_2: ctx.getNodeParameter('videoUrl2', itemIndex) as string,
	});
}

async function resizeVideo(ctx: IExecuteFunctions, itemIndex: number): Promise<IDataObject> {
	const additionalFields = ctx.getNodeParameter('additionalFields', itemIndex) as {
		maintainAspectRatio?: boolean;
		outputFormat?: string;
	};

	const body: IDataObject = {
		public_link: ctx.getNodeParameter('videoUrl', itemIndex) as string,
		width: ctx.getNodeParameter('width', itemIndex) as number,
		height: ctx.getNodeParameter('height', itemIndex) as number,
	};

	appendDefinedFields(body, {
		maintain_aspect_ratio: additionalFields.maintainAspectRatio,
		output_format: additionalFields.outputFormat,
	});

	return submitAsyncVideoJob(ctx, itemIndex, 'resize', `${API_BASE}/resize-video/`, body);
}

async function cropVideo(ctx: IExecuteFunctions, itemIndex: number): Promise<IDataObject> {
	const webhookUrl = requireWebhookUrl(
		ctx.getNodeParameter('webhookUrl', itemIndex) as string,
		'crop',
	);

	const query = new URLSearchParams({
		file_id: ctx.getNodeParameter('fileId', itemIndex) as string,
		x: String(ctx.getNodeParameter('cropX', itemIndex) as number),
		y: String(ctx.getNodeParameter('cropY', itemIndex) as number),
		width: String(ctx.getNodeParameter('cropWidth', itemIndex) as number),
		height: String(ctx.getNodeParameter('cropHeight', itemIndex) as number),
		webhook_url: webhookUrl,
	});

	const response = await vidopiApiRequest(ctx, {
		method: 'POST',
		url: `${API_BASE}/crop-video/?${query.toString()}`,
		json: true,
	});

	return { ...(response as IDataObject), webhookUrl };
}

async function rotateVideo(ctx: IExecuteFunctions, itemIndex: number): Promise<IDataObject> {
	return submitAsyncVideoJob(ctx, itemIndex, 'rotate', `${API_BASE}/rotate-video/`, {
		public_link: ctx.getNodeParameter('publicLink', itemIndex) as string,
		angle: ctx.getNodeParameter('angle', itemIndex) as number,
	});
}

async function speedVideo(ctx: IExecuteFunctions, itemIndex: number): Promise<IDataObject> {
	return submitAsyncVideoJob(ctx, itemIndex, 'speed', `${API_BASE}/speed-video/`, {
		public_link: ctx.getNodeParameter('publicLink', itemIndex) as string,
		speed_factor: ctx.getNodeParameter('speedFactor', itemIndex) as number,
	});
}

async function compressVideo(ctx: IExecuteFunctions, itemIndex: number): Promise<IDataObject> {
	const additionalFields = ctx.getNodeParameter('compressAdditionalFields', itemIndex) as {
		bitrate?: string;
		fps?: number;
		resolutionScale?: number;
	};

	const body: IDataObject = {
		public_link: ctx.getNodeParameter('publicLink', itemIndex) as string,
	};

	appendDefinedFields(body, {
		bitrate: additionalFields.bitrate,
		fps: additionalFields.fps,
		resolution_scale: additionalFields.resolutionScale,
	});

	return submitAsyncVideoJob(ctx, itemIndex, 'compress', `${API_BASE}/compress-video/`, body);
}

async function extractAudioVideo(ctx: IExecuteFunctions, itemIndex: number): Promise<IDataObject> {
	const additionalFields = ctx.getNodeParameter('extractAudioAdditionalFields', itemIndex) as {
		startTime?: number;
		endTime?: number;
		format?: string;
	};

	const body: IDataObject = {
		public_link: ctx.getNodeParameter('publicLink', itemIndex) as string,
	};

	appendDefinedFields(body, {
		start_time: additionalFields.startTime,
		end_time: additionalFields.endTime,
		format: additionalFields.format,
	});

	return submitAsyncVideoJob(ctx, itemIndex, 'extract audio', `${API_BASE}/extract-audio-video/`, body);
}

async function composeAudioVideo(ctx: IExecuteFunctions, itemIndex: number): Promise<IDataObject> {
	const additionalFields = ctx.getNodeParameter('composeAudioAdditionalFields', itemIndex) as {
		mode?: string;
		audioStartTime?: number;
		audioOffset?: number;
		videoVolume?: number;
		audioVolume?: number;
		duration?: number;
	};

	const body: IDataObject = {
		public_link: ctx.getNodeParameter('publicLink', itemIndex) as string,
		audio_public_link: ctx.getNodeParameter('audioPublicLink', itemIndex) as string,
	};

	appendDefinedFields(body, {
		mode: additionalFields.mode,
		audio_start_time: additionalFields.audioStartTime,
		audio_offset: additionalFields.audioOffset,
		video_volume: additionalFields.videoVolume,
		audio_volume: additionalFields.audioVolume,
		duration: additionalFields.duration,
	});

	return submitAsyncVideoJob(ctx, itemIndex, 'compose audio', `${API_BASE}/compose-audio-video/`, body);
}

async function imageOverlayVideo(ctx: IExecuteFunctions, itemIndex: number): Promise<IDataObject> {
	const additionalFields = ctx.getNodeParameter('imageOverlayAdditionalFields', itemIndex) as {
		position?: string;
		width?: number;
		height?: number;
		opacity?: number;
		startTime?: number;
		duration?: number;
		margin?: number;
	};

	const body: IDataObject = {
		public_link: ctx.getNodeParameter('publicLink', itemIndex) as string,
		image_public_link: ctx.getNodeParameter('imagePublicLink', itemIndex) as string,
	};

	appendDefinedFields(body, {
		position: additionalFields.position,
		width: additionalFields.width,
		height: additionalFields.height,
		opacity: additionalFields.opacity,
		start_time: additionalFields.startTime,
		duration: additionalFields.duration,
		margin: additionalFields.margin,
	});

	return submitAsyncVideoJob(ctx, itemIndex, 'image overlay', `${API_BASE}/image-overlay-video/`, body);
}

async function textOverlayVideo(ctx: IExecuteFunctions, itemIndex: number): Promise<IDataObject> {
	const additionalFields = ctx.getNodeParameter('textOverlayAdditionalFields', itemIndex) as {
		position?: string;
		fontsize?: number;
		color?: string;
		startTime?: number;
		duration?: number;
		font?: string;
	};

	const body: IDataObject = {
		public_link: ctx.getNodeParameter('publicLink', itemIndex) as string,
		text: ctx.getNodeParameter('overlayText', itemIndex) as string,
	};

	appendDefinedFields(body, {
		position: additionalFields.position,
		fontsize: additionalFields.fontsize,
		color: additionalFields.color,
		start_time: additionalFields.startTime,
		duration: additionalFields.duration,
		font: additionalFields.font,
	});

	return submitAsyncVideoJob(ctx, itemIndex, 'text overlay', `${API_BASE}/text-overlay-video/`, body);
}

async function generateThumbnail(ctx: IExecuteFunctions, itemIndex: number): Promise<IDataObject> {
	const additionalFields = ctx.getNodeParameter('thumbnailAdditionalFields', itemIndex) as {
		time?: number;
		width?: number;
		height?: number;
		format?: string;
	};

	const body: IDataObject = {
		public_link: ctx.getNodeParameter('publicLink', itemIndex) as string,
	};

	appendDefinedFields(body, {
		time: additionalFields.time,
		width: additionalFields.width,
		height: additionalFields.height,
		format: additionalFields.format,
	});

	return submitAsyncVideoJob(
		ctx,
		itemIndex,
		'generate thumbnail',
		`${API_BASE}/generate-thumbnail/`,
		body,
	);
}

async function getFileInfo(ctx: IExecuteFunctions, itemIndex: number): Promise<IDataObject> {
	const fileId = ctx.getNodeParameter('fileId', itemIndex) as string;

	return (await vidopiApiRequest(ctx, {
		method: 'GET',
		url: `${API_BASE}/file-info/${encodeURIComponent(fileId)}`,
		json: true,
	})) as IDataObject;
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
