import type { IExecuteFunctions, IHttpRequestOptions } from 'n8n-workflow';

export const DEFAULT_CONTENT_TYPE = 'video/mp4';

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

export const createMultipartBody = (
	fileBuffer: Buffer,
	fileName: string,
	contentType: string,
): { body: Buffer; boundary: string } => {
	const boundary = `vidopi-boundary-${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
	const chunks: Buffer[] = [];

	const appendString = (value: string) => {
		chunks.push(Buffer.from(value, 'utf8'));
	};

	const sanitizedFileName = fileName.replace(/"/g, '\\"');
	appendString(`--${boundary}\r\n`);
	appendString(`Content-Disposition: form-data; name="file"; filename="${sanitizedFileName}"\r\n`);
	appendString(`Content-Type: ${contentType}\r\n\r\n`);
	chunks.push(fileBuffer);
	appendString('\r\n');

	appendString(`--${boundary}--\r\n`);

	return {
		body: Buffer.concat(chunks),
		boundary,
	};
};

export type VidopiTaskStatus = 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED';

export const vidopiApiRequest = async (
	ctx: IExecuteFunctions,
	options: IHttpRequestOptions,
): Promise<unknown> => {
	return ctx.helpers.httpRequestWithAuthentication.call(ctx, 'vidopiApi', options);
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
		url: `https://api.vidopi.com/task-status/${taskId}`,
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
