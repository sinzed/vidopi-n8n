import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestOptions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

export const DEFAULT_CONTENT_TYPE = 'video/mp4';
export const MAX_VIDEO_UPLOAD_BYTES = 500 * 1024 * 1024;

const SUPPORTED_VIDEO_EXTENSIONS = new Set([
	'.mp4',
	'.avi',
	'.mov',
	'.mkv',
	'.wmv',
	'.flv',
]);

const getExtension = (fileName: string): string => {
	const normalizedName = fileName?.split(/[\\/]/).pop() ?? '';
	const dotIndex = normalizedName.lastIndexOf('.');

	if (dotIndex === -1) {
		return '';
	}

	return normalizedName.substring(dotIndex).toLowerCase();
};

export const guessContentType = (fileName: string): string => {
	const extension = getExtension(fileName);

	switch (extension) {
		case '.mov':
			return 'video/quicktime';
		case '.mkv':
			return 'video/x-matroska';
		case '.webm':
			return 'video/webm';
		case '.avi':
			return 'video/x-msvideo';
		case '.flv':
			return 'video/x-flv';
		case '.wmv':
			return 'video/x-ms-wmv';
		case '.m4v':
			return 'video/x-m4v';
		case '.mpg':
		case '.mpeg':
			return 'video/mpeg';
		case '.ogv':
			return 'video/ogg';
		case '.ts':
			return 'video/mp2t';
		case '.3gp':
			return 'video/3gpp';
		case '.3g2':
			return 'video/3gpp2';
		default:
			return DEFAULT_CONTENT_TYPE;
	}
};

export const validateVideoForUpload = (
	fileName: string,
	contentType: string,
	fileSize: number,
): void => {
	if (fileSize <= 0) {
		throw new Error('Video file is empty.');
	}

	if (fileSize > MAX_VIDEO_UPLOAD_BYTES) {
		throw new Error(
			`Video file exceeds the maximum size of 500MB (file is ${Math.ceil(fileSize / (1024 * 1024))}MB).`,
		);
	}

	if (!contentType.startsWith('video/')) {
		throw new Error(`Content type must start with "video/" (got "${contentType}").`);
	}

	const extension = getExtension(fileName);
	if (!extension || !SUPPORTED_VIDEO_EXTENSIONS.has(extension)) {
		throw new Error(
			`Unsupported file extension "${extension || '(none)'}". Supported formats: MP4, AVI, MOV, MKV, WMV, FLV.`,
		);
	}
};

export interface UploadInitResponse {
	upload_url: string;
	object_key: string;
}

export const parseUploadInitResponse = (response: unknown): UploadInitResponse => {
	const data = (
		typeof response === 'string' ? JSON.parse(response) : response
	) as IDataObject;
	const uploadUrl = (data.upload_url ?? data.uploadUrl) as string | undefined;
	const objectKey = (data.object_key ?? data.objectKey) as string | undefined;

	if (!uploadUrl || !objectKey) {
		throw new Error('Upload init response is missing upload_url or object_key.');
	}

	return { upload_url: uploadUrl, object_key: objectKey };
};

export const putToPresignedUrl = async (
	ctx: IExecuteFunctions,
	uploadUrl: string,
	fileBuffer: Buffer,
	contentType: string,
): Promise<void> => {
	try {
		await ctx.helpers.httpRequest({
			method: 'PUT',
			url: uploadUrl,
			headers: {
				'Content-Type': contentType,
			},
			body: fileBuffer,
		});
	} catch (error) {
		throw new NodeApiError(ctx.getNode(), error as JsonObject);
	}
};

export type VidopiTaskStatus = 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED';

export const vidopiApiRequest = async (
	ctx: IExecuteFunctions,
	options: IHttpRequestOptions,
): Promise<unknown> => {
	try {
		return await ctx.helpers.httpRequestWithAuthentication.call(ctx, 'vidopiApi', options);
	} catch (error) {
		throw new NodeApiError(ctx.getNode(), error as JsonObject);
	}
};

export interface TaskStatusResponse {
	status: VidopiTaskStatus;
	result?: { error?: unknown; [key: string]: unknown } | null;
	download_url?: string;
	[key: string]: unknown;
}

export const fetchTaskStatus = async (
	ctx: IExecuteFunctions,
	taskId: string,
): Promise<TaskStatusResponse> => {
	return (await vidopiApiRequest(ctx, {
		method: 'GET',
		url: `https://api.vidopi.com/task-status/${encodeURIComponent(taskId)}`,
		json: true,
	})) as TaskStatusResponse;
};

export const requireWebhookUrl = (webhookUrl: string, operation: string): string => {
	const trimmed = webhookUrl?.trim() ?? '';
	if (!trimmed) {
		throw new Error(
			`Callback Webhook URL is required for the ${operation} operation. Add a Vidopi Trigger node, activate the workflow, and use its webhook URL.`,
		);
	}
	return trimmed;
};

/** POST an async video job with webhook_url and return API response plus webhookUrl. */
export const submitAsyncVideoJob = async (
	ctx: IExecuteFunctions,
	itemIndex: number,
	operationLabel: string,
	url: string,
	body: IDataObject,
): Promise<IDataObject> => {
	const webhookUrl = requireWebhookUrl(
		ctx.getNodeParameter('webhookUrl', itemIndex) as string,
		operationLabel,
	);

	const response = await vidopiApiRequest(ctx, {
		method: 'POST',
		url,
		body: { ...body, webhook_url: webhookUrl },
		json: true,
	});

	return { ...(response as IDataObject), webhookUrl };
};

export const appendDefinedFields = (
	target: IDataObject,
	fields: Record<string, unknown>,
): void => {
	for (const [key, value] of Object.entries(fields)) {
		if (value === undefined || value === null || value === '') {
			continue;
		}
		// Skip numeric zero used as "unset" in optional additional fields.
		if (value === 0) {
			continue;
		}
		target[key] = value;
	}
};
