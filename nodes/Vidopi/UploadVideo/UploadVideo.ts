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
    subtitle: '={{$parameter["operation"]}}',
    description: 'Upload video files for processing',
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
        displayName: 'Video File',
        name: 'videoFile',
        type: 'string',
        default: '',
        required: true,
        description: 'URL or file path of the video to upload',
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
        const additionalFields = this.getNodeParameter('additionalFields', i) as {
          publicLink?: boolean;
        };

        const binaryPropertyName = 'data';
        let fileName = 'video.mp4';
        
        // Check if we have binary data from previous node
        const binaryData = items[i].binary;
        
        if (binaryData && binaryData[binaryPropertyName]) {
          // Use binary data from previous node
          fileName = binaryData[binaryPropertyName].fileName || fileName;
        } else if (videoFile) {
                      // Download file from URL first, then upload
          try {
            const downloadResponse = await this.helpers.httpRequest({
              method: 'GET',
              url: videoFile,
            });
            
            // Extract filename from URL
            fileName = videoFile.split('/').pop() || videoFile.split('\\').pop() || 'video.mp4';
            
            // Convert response to buffer for upload
            let fileBuffer: Buffer;
            if (Buffer.isBuffer(downloadResponse)) {
              fileBuffer = downloadResponse;
            } else if (typeof downloadResponse === 'string') {
              fileBuffer = Buffer.from(downloadResponse, 'binary');
            } else {
              fileBuffer = Buffer.from(JSON.stringify(downloadResponse));
            }
            
            // Prepare multipart form data using FormData-like structure
            const formData = new FormData();
            formData.append('file', fileBuffer, {
              filename: fileName,
              contentType: 'video/mp4',
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
            
            // Parse JSON response
            const jsonResponse = typeof response === 'string' ? JSON.parse(response) : response;
            returnData.push({ json: jsonResponse });
            continue;
          } catch (error) {
            throw new Error(`Failed to download or upload video: ${error instanceof Error ? error.message : String(error)}`);
          }
        } else {
          throw new Error('No video file provided. Please provide a file URL or connect a node that outputs binary data.');
        }

        // If we have binary data, upload it
        if (binaryData && binaryData[binaryPropertyName]) {
          const formData = new FormData();
          
          formData.append('file', Buffer.from(binaryData[binaryPropertyName].data, 'base64'), {
            filename: fileName,
            contentType: binaryData[binaryPropertyName].mimeType || 'video/mp4',
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
        }
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

