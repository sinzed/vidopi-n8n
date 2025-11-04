import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export class MoviePyNode implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'MoviePy',
    name: 'moviePy',
    group: ['transform'],
    version: 1,
    description: 'Process videos with MoviePy (Python)',
    defaults: {
      name: 'MoviePy',
    },
    inputs: ['main'],
    outputs: ['main'],
    properties: [
      {
        displayName: 'Input File Path',
        name: 'inputPath',
        type: 'string',
        default: '',
        required: true,
      },
      {
        displayName: 'Output File Path',
        name: 'outputPath',
        type: 'string',
        default: '',
        required: true,
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    for (let i = 0; i < items.length; i++) {
      const inputPath = this.getNodeParameter('inputPath', i) as string;
      const outputPath = this.getNodeParameter('outputPath', i) as string;
      try {
        await execFileAsync('python3', [
          `${__dirname}/../python/moviepy_script.py`,
          inputPath,
          outputPath,
        ]);
        returnData.push({ json: { success: true, inputPath, outputPath } });
      } catch (error) {
        returnData.push({ json: { success: false, error: error instanceof Error ? error.message : String(error), inputPath, outputPath } });
      }
    }
    return [returnData];
  }
} 