import {
  IHttpRequestOptions,
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeConnectionType,
} from 'n8n-workflow';
const DEFAULT_CONTENT_TYPE = 'video/mp4';

const getExtension = (fileName: string): string => {
  const normalizedName = fileName?.split(/[\\/]/).pop() ?? '';
  const dotIndex = normalizedName.lastIndexOf('.');

  if (dotIndex === -1) {
    return '';
  }

  return normalizedName.substring(dotIndex).toLowerCase();
};

const guessContentType = (fileName: string): string => {
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

const createMultipartBody = (
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

export class UploadVideo implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Vidopi Upload Video',
    name: 'vidopiUploadVideo',
    icon: 'file:../logo.png',
    group: ['transform'],
    version: 1,
    documentationUrl: 'https://dashboard.vidopi.com/api-docs',
    subtitle: 'Upload video files',
    description: 'Upload video files for processing. Supports binary data, local file paths, or remote URLs.',
    defaults: {
      name: 'Vidopi Upload Video',
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
        displayName: 'Binary Property',
        name: 'binaryPropertyName',
        type: 'string',
        default: 'data',
        required: false,
        description: 'Name of the binary property that contains the file to upload.',
        placeholder: 'data',
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];
    const credentials = await this.getCredentials('vidopiApi');

    for (let i = 0; i < items.length; i++) {
      try {
        const binaryPropertyName = (this.getNodeParameter('binaryPropertyName', i, '') as string) || 'data';
        let fileName = 'video.mp4';
        let fileBuffer: Buffer | undefined;
        let contentType = DEFAULT_CONTENT_TYPE;

        const binaryData = items[i].binary;

        if (!binaryPropertyName) {
          throw new Error('Please specify the Binary Property that contains the file to upload.');
        }

        if (binaryData && binaryData[binaryPropertyName]) {
          const binaryItem = binaryData[binaryPropertyName];
          fileName = binaryItem.fileName || fileName;
          contentType = binaryItem.mimeType || guessContentType(fileName);

          try {
            if (this.helpers.getBinaryDataBuffer) {
              fileBuffer = await this.helpers.getBinaryDataBuffer(i, binaryPropertyName);
            } else {
              fileBuffer = Buffer.from(binaryItem.data, 'base64');
            }
          } catch (_error) {
            fileBuffer = Buffer.from(binaryItem.data, 'base64');
          }
        } else {
          throw new Error(
            `Binary data not found. Ensure the previous node outputs binary data under the property name "${binaryPropertyName}".`,
          );
        }

        if (!fileBuffer) {
          throw new Error('Unable to determine video file content for upload.');
        }

        // Upload the file
        const { body, boundary } = createMultipartBody(fileBuffer, fileName, contentType);

        const requestOptions: IHttpRequestOptions = {
          method: 'POST',
          url: 'https://api.vidopi.com/upload-video/',
          headers: {
            'X-API-Key': credentials.apiKey as string,
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
          },
          body,
        };

        const response = await this.helpers.httpRequest(requestOptions);
        
        const jsonResponse = typeof response === 'string' ? JSON.parse(response) : response;
        returnData.push({ json: jsonResponse });
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

