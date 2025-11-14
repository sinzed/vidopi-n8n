import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeConnectionType,
} from 'n8n-workflow';
import FormData = require('form-data');
import { promises as fs } from 'fs';
import * as path from 'path';

type UploadSource = 'binary' | 'localFile';

const DEFAULT_CONTENT_TYPE = 'video/mp4';

const guessContentType = (fileName: string): string => {
  const extension = path.extname(fileName).toLowerCase();

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

class UploadVideo implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Vidopi Upload Video',
    name: 'vidopiUploadVideo',
    icon: 'file:logo.png',
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
        displayName: 'Upload Source',
        name: 'uploadSource',
        type: 'options',
        default: 'binary',
        description: 'Where the video file should be loaded from',
        options: [
          {
            name: 'Binary Data',
            value: 'binary',
            description: 'Use binary data produced by a previous node',
          },
          {
            name: 'Local File Path',
            value: 'localFile',
            description: 'Load a video from the file system accessible to the n8n server',
          },
        ],
      },
      {
        displayName: 'Binary Property',
        name: 'binaryPropertyName',
        type: 'string',
        default: 'data',
        required: false,
        description: 'Name of the binary property that contains the file to upload.',
        placeholder: 'data',
        displayOptions: {
          show: {
            uploadSource: ['binary'],
          },
        },
      },
      {
        displayName: 'File Path',
        name: 'localFilePath',
        type: 'string',
        default: '',
        required: false,
        description: 'Absolute or relative path to the video file on disk.',
        placeholder: '/data/videos/video.mp4',
        displayOptions: {
          show: {
            uploadSource: ['localFile'],
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
            displayName: 'Public Link',
            name: 'publicLink',
            type: 'boolean',
            default: true,
            description: 'Whether to generate a public link for the uploaded video',
          },
        ],
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];
    const credentials = await this.getCredentials('vidopiApi');

    for (let i = 0; i < items.length; i++) {
      try {
        const uploadSourceParam = this.getNodeParameter('uploadSource', i, '') as string;
        const localFilePath = this.getNodeParameter('localFilePath', i, '') as string;
        const binaryPropertyName = (this.getNodeParameter('binaryPropertyName', i, '') as string) || 'data';
        const additionalFields = this.getNodeParameter('additionalFields', i) as {
          publicLink?: boolean;
        };

        let fileName = 'video.mp4';
        let fileBuffer: Buffer | undefined;
        let contentType = DEFAULT_CONTENT_TYPE;

        const inferredUploadSource: UploadSource =
          (uploadSourceParam as UploadSource) || 'binary';

        if (inferredUploadSource === 'binary') {
          const binaryData = items[i].binary;

          if (!binaryPropertyName) {
            throw new Error('Please specify the Binary Property that contains the file to upload.');
          }

          if (binaryData && binaryData[binaryPropertyName]) {
            const binaryItem = binaryData[binaryPropertyName];
            fileName = binaryItem.fileName || fileName;
            contentType = binaryItem.mimeType || contentType;

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
        } else if (inferredUploadSource === 'localFile') {
          if (!localFilePath) {
            throw new Error('Please provide a value for "File Path" when using the Local File Path upload source.');
          }

          const resolvedPath = path.resolve(localFilePath);

          try {
            fileBuffer = await fs.readFile(resolvedPath);
          } catch (error) {
            throw new Error(`Failed to read file at path "${resolvedPath}": ${
              error instanceof Error ? error.message : String(error)
            }`);
          }

          fileName = path.basename(resolvedPath);
          contentType = guessContentType(fileName);
        } else {
          throw new Error(`Unsupported upload source "${uploadSourceParam as string}".`);
        }

        if (!fileBuffer) {
          throw new Error('Unable to determine video file content for upload.');
        }

        // Upload the file
        const formData = new FormData();
        formData.append('file', fileBuffer, {
          filename: fileName,
          contentType: contentType,
        });
        
        if (additionalFields.publicLink !== undefined) {
          formData.append('public_link', additionalFields.publicLink.toString());
        }
        
        const response = await this.helpers.httpRequest({
          method: 'POST',
          url: 'https://api.vidopi.com/upload-video/',
          headers: {
            'X-API-Key': credentials.apiKey as string,
            ...formData.getHeaders(),
          },
          body: formData,
        });
        
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

// Export for CommonJS
exports.UploadVideo = UploadVideo;


