import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';
import FormData from 'form-data';

class UploadVideo implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Vidopi Upload Video',
    name: 'vidopiUploadVideo',
    icon: 'file:logo.png',
    group: ['transform'],
    version: 1,
    subtitle: 'Upload video files',
    description: 'Upload video files for processing. Supports binary files from previous nodes or URLs.',
    defaults: {
      name: 'Vidopi Upload Video',
    },
    inputs: ['main'],
    outputs: ['main'],
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
        description: 'Name of the binary property that contains the file to upload. Leave empty if providing a URL.',
        placeholder: 'data',
      },
      {
        displayName: 'Video File URL',
        name: 'videoFile',
        type: 'string',
        default: '',
        required: false,
        description: 'URL of the video to upload. Leave empty if using binary data from previous node.',
        placeholder: 'https://example.com/video.mp4',
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
        const videoFile = this.getNodeParameter('videoFile', i) as string;
        const binaryPropertyName = this.getNodeParameter('binaryPropertyName', i) as string || 'data';
        const additionalFields = this.getNodeParameter('additionalFields', i) as {
          publicLink?: boolean;
        };

        let fileName = 'video.mp4';
        let fileBuffer: Buffer;
        let contentType = 'video/mp4';
        
        // Check if we have binary data from previous node
        const binaryData = items[i].binary;
        
        if (binaryData && binaryData[binaryPropertyName]) {
          // Use binary data from previous node
          const binaryItem = binaryData[binaryPropertyName];
          fileName = binaryItem.fileName || fileName;
          contentType = binaryItem.mimeType || contentType;
          
          // Get binary data buffer using n8n helper if available, otherwise decode base64
          try {
            // Try to use n8n's helper method for getting binary data
            if (this.helpers.getBinaryDataBuffer) {
              fileBuffer = await this.helpers.getBinaryDataBuffer(i, binaryPropertyName);
            } else {
              // Fallback to manual base64 decoding
              fileBuffer = Buffer.from(binaryItem.data, 'base64');
            }
          } catch (_error) {
            // Fallback to manual base64 decoding if helper fails
            fileBuffer = Buffer.from(binaryItem.data, 'base64');
          }
        } else if (videoFile) {
          // Download file from URL first, then upload
          try {
            const downloadResponse = await this.helpers.httpRequest({
              method: 'GET',
              url: videoFile,
              responseType: 'arraybuffer',
            });
            
            // Extract filename from URL
            fileName = videoFile.split('/').pop() || videoFile.split('\\').pop() || 'video.mp4';
            
            // Convert response to buffer for upload
            if (Buffer.isBuffer(downloadResponse)) {
              fileBuffer = downloadResponse;
            } else if (downloadResponse instanceof ArrayBuffer) {
              fileBuffer = Buffer.from(downloadResponse);
            } else if (typeof downloadResponse === 'string') {
              fileBuffer = Buffer.from(downloadResponse, 'binary');
            } else {
              fileBuffer = Buffer.from(JSON.stringify(downloadResponse));
            }
          } catch (error) {
            throw new Error(`Failed to download video from URL: ${error instanceof Error ? error.message : String(error)}`);
          }
        } else {
          throw new Error('No video file provided. Please provide a file URL in "Video File URL" field or connect a node that outputs binary data and specify the "Binary Property" name.');
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

