import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeTypeDescription,
	INodeProperties,
	IDisplayOptions,
	IWebhookFunctions,
	IWebhookResponseData,
	INodeType,
} from 'n8n-workflow';

import {
	NodeConnectionType,
	FORM_TRIGGER_NODE_TYPE,
	tryToParseDateTime,
	NodeOperationError,
} from 'n8n-workflow';

// Date far in the future for indefinite wait
const WAIT_INDEFINITELY = new Date('2099-12-31T23:59:59.999Z');

const validateWaitUnit = (unit: string): boolean => {
	return ['seconds', 'minutes', 'hours', 'days'].includes(unit);
};

const validateWaitAmount = (amount: number): boolean => {
	return typeof amount === 'number' && amount >= 0 && !isNaN(amount);
};

const toWaitAmount: INodeProperties = {
	displayName: 'Wait Amount',
	name: 'amount',
	type: 'number',
	typeOptions: {
		minValue: 0,
		numberPrecision: 2,
	},
	default: 1,
	description: 'The time to wait',
	validateType: 'number',
};

const unitSelector: INodeProperties = {
	displayName: 'Wait Unit',
	name: 'unit',
	type: 'options',
	options: [
		{
			name: 'Seconds',
			value: 'seconds',
		},
		{
			name: 'Minutes',
			value: 'minutes',
		},
		{
			name: 'Hours',
			value: 'hours',
		},
		{
			name: 'Days',
			value: 'days',
		},
	],
	default: 'hours',
	description: 'The time unit of the Wait Amount value',
};

const waitTimeProperties: INodeProperties[] = [
	{
		displayName: 'Limit Wait Time',
		name: 'limitWaitTime',
		type: 'boolean',
		default: false,
		description:
			'Whether to limit the time this node should wait for a user response before execution resumes',
		displayOptions: {
			show: {
				resume: ['webhook', 'form'],
			},
		},
	},
	{
		displayName: 'Limit Type',
		name: 'limitType',
		type: 'options',
		default: 'afterTimeInterval',
		description:
			'Sets the condition for the execution to resume. Can be a specified date or after some time.',
		displayOptions: {
			show: {
				limitWaitTime: [true],
				resume: ['webhook', 'form'],
			},
		},
		options: [
			{
				name: 'After Time Interval',
				description: 'Waits for a certain amount of time',
				value: 'afterTimeInterval',
			},
			{
				name: 'At Specified Time',
				description: 'Waits until the set date and time to continue',
				value: 'atSpecifiedTime',
			},
		],
	},
	{
		displayName: 'Amount',
		name: 'resumeAmount',
		type: 'number',
		displayOptions: {
			show: {
				limitType: ['afterTimeInterval'],
				limitWaitTime: [true],
				resume: ['webhook', 'form'],
			},
		},
		typeOptions: {
			minValue: 0,
			numberPrecision: 2,
		},
		default: 1,
		description: 'The time to wait',
	},
	{
		displayName: 'Unit',
		name: 'resumeUnit',
		type: 'options',
		displayOptions: {
			show: {
				limitType: ['afterTimeInterval'],
				limitWaitTime: [true],
				resume: ['webhook', 'form'],
			},
		},
		options: [
			{
				name: 'Seconds',
				value: 'seconds',
			},
			{
				name: 'Minutes',
				value: 'minutes',
			},
			{
				name: 'Hours',
				value: 'hours',
			},
			{
				name: 'Days',
				value: 'days',
			},
		],
		default: 'hours',
		description: 'Unit of the interval value',
	},
	{
		displayName: 'Max Date and Time',
		name: 'maxDateAndTime',
		type: 'dateTime',
		displayOptions: {
			show: {
				limitType: ['atSpecifiedTime'],
				limitWaitTime: [true],
				resume: ['webhook', 'form'],
			},
		},
		default: '',
		description: 'Continue execution after the specified date and time',
	},
];

const webhookSuffix: INodeProperties = {
	displayName: 'Webhook Suffix',
	name: 'webhookSuffix',
	type: 'string',
	default: '',
	placeholder: 'webhook',
	noDataExpression: true,
	description:
		'This suffix path will be appended to the restart URL. Helpful when using multiple wait nodes.',
};

const displayOnWebhook: IDisplayOptions = {
	show: {
		resume: ['webhook'],
	},
};

const displayOnFormSubmission: IDisplayOptions = {
	show: {
		resume: ['form'],
	},
};

const webhookPath = '={{$parameter["options"]["webhookSuffix"] || ""}}';

const waitingTooltip = (
	parameters: { resume: string; options?: Record<string, string> },
	resumeUrl: string,
	formResumeUrl: string,
) => {
	const resume = parameters.resume;

	if (['webhook', 'form'].includes(resume as string)) {
		const { webhookSuffix } = (parameters.options ?? {}) as { webhookSuffix: string };

		const suffix = webhookSuffix && typeof webhookSuffix !== 'object' ? `/${webhookSuffix}` : '';

		let message = '';
		const url = `${resume === 'form' ? formResumeUrl : resumeUrl}${suffix}`;

		if (resume === 'form') {
			message = 'Execution will continue when form is submitted on ';
		}

		if (resume === 'webhook') {
			message = 'Execution will continue when webhook is received on ';
		}

		return `${message}<a href="${url}" target="_blank">${url}</a>`;
	}

	return 'Execution will continue when wait time is over';
};

export class Wait implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Vidopi Wait',
		name: 'vidopiWait',
		icon: 'fa:pause-circle',
		iconColor: 'crimson',
		group: ['organization'],
		version: 1,
		description: 'Wait before continue with execution',
		defaults: {
			name: 'Vidopi Wait',
			color: '#804050',
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		webhooks: [
			{
				name: 'default',
				httpMethod: '={{$parameter["httpMethod"] || "POST"}}',
				isFullPath: false,
				responseMode: '={{$parameter["responseMode"]}}',
				path: webhookPath,
				restartWebhook: true,
			},
			{
				name: 'default',
				httpMethod: 'GET',
				responseMode: 'onReceived',
				path: webhookPath,
				restartWebhook: true,
				isFullPath: true,
				nodeType: 'form',
			},
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: '={{$parameter["responseMode"]}}',
				responseData: '={{$parameter["responseMode"] === "lastNode" ? "noData" : undefined}}',
				path: webhookPath,
				restartWebhook: true,
				isFullPath: true,
				nodeType: 'form',
			},
		],
		properties: [
			{
				displayName: 'Resume',
				name: 'resume',
				type: 'options',
				options: [
					{
						name: 'After Time Interval',
						value: 'timeInterval',
						description: 'Waits for a certain amount of time',
					},
					{
						name: 'At Specified Time',
						value: 'specificTime',
						description: 'Waits until a specific date and time to continue',
					},
					{
						name: 'On Webhook Call',
						value: 'webhook',
						description: 'Waits for a webhook call before continuing',
					},
					{
						name: 'On Form Submitted',
						value: 'form',
						description: 'Waits for a form submission before continuing',
					},
				],
				default: 'timeInterval',
				description: 'Determines the waiting mode to use before the workflow continues',
			},
			{
				displayName: 'Authentication',
				name: 'incomingAuthentication',
				type: 'options',
				options: [
					{
						name: 'Basic Auth',
						value: 'basicAuth',
					},
					{
						name: 'None',
						value: 'none',
					},
				],
				default: 'none',
				description:
					'If and how incoming resume-webhook-requests to $execution.resumeFormUrl should be authenticated for additional security',
				displayOptions: displayOnFormSubmission,
			},
			{
				displayName: 'Authentication',
				name: 'incomingAuthentication',
				type: 'options',
				options: [
					{
						name: 'Basic Auth',
						value: 'basicAuth',
					},
					{
						name: 'None',
						value: 'none',
					},
				],
				default: 'none',
				description:
					'If and how incoming resume-webhook-requests to $execution.resumeUrl should be authenticated for additional security',
				displayOptions: displayOnWebhook,
			},

			// ----------------------------------
			//         resume:specificTime
			// ----------------------------------
			{
				displayName: 'Date and Time',
				name: 'dateTime',
				type: 'dateTime',
				displayOptions: {
					show: {
						resume: ['specificTime'],
					},
				},
				default: '',
				description: 'The date and time to wait for before continuing',
				required: true,
			},

			// ----------------------------------
			//         resume:timeInterval
			// ----------------------------------
			{
				...toWaitAmount,
				displayOptions: {
					show: {
						resume: ['timeInterval'],
					},
				},
			},
			{
				...unitSelector,
				default: 'seconds',
				displayOptions: {
					show: {
						resume: ['timeInterval'],
					},
				},
			},

			// ----------------------------------
			//         resume:webhook & form
			// ----------------------------------
			{
				displayName:
					'The webhook URL will be generated at run time. It can be referenced with the <strong>$execution.resumeUrl</strong> variable. Send it somewhere before getting to this node. <a href="https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.wait/?utm_source=n8n_app&utm_medium=node_settings_modal-credential_link&utm_campaign=n8n-nodes-base.wait" target="_blank">More info</a>',
				name: 'webhookNotice',
				type: 'notice',
				displayOptions: displayOnWebhook,
				default: '',
			},
			{
				displayName:
					'The form url will be generated at run time. It can be referenced with the <strong>$execution.resumeFormUrl</strong> variable. Send it somewhere before getting to this node. <a href="https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.wait/?utm_source=n8n_app&utm_medium=node_settings_modal-credential_link&utm_campaign=n8n-nodes-base.wait" target="_blank">More info</a>',
				name: 'formNotice',
				type: 'notice',
				displayOptions: displayOnFormSubmission,
				default: '',
			},
			{
				displayName: 'HTTP Method',
				name: 'httpMethod',
				type: 'options',
				options: [
					{
						name: 'GET',
						value: 'GET',
					},
					{
						name: 'POST',
						value: 'POST',
					},
				],
				default: 'POST',
				description: 'The HTTP method of the Webhook call',
				displayOptions: displayOnWebhook,
			},
			{
				displayName: 'Response Code',
				name: 'responseCode',
				type: 'number',
				displayOptions: {
					show: {
						resume: ['webhook'],
					},
				},
				typeOptions: {
					minValue: 100,
					maxValue: 599,
				},
				default: 200,
				description: 'The HTTP Response code to return',
			},
			{
				displayName: 'Response Mode',
				name: 'responseMode',
				type: 'options',
				options: [
					{
						name: 'On Received',
						value: 'onReceived',
						description: 'As soon as this node executes',
					},
					{
						name: 'Using \'Respond to Webhook\' Node',
						value: 'responseNode',
						description: 'When another node executes',
					},
					{
						name: 'Last Node',
						value: 'lastNode',
						description: 'Returns the data of the last-executed node',
					},
				],
				default: 'onReceived',
				description: 'When to respond to the webhook',
				displayOptions: displayOnWebhook,
			},
			{
				displayName: 'Response Data',
				name: 'responseData',
				type: 'options',
				displayOptions: {
					show: {
						resume: ['webhook'],
						responseMode: ['onReceived', 'lastNode'],
					},
				},
				options: [
					{
						name: 'All Incoming Items',
						value: 'allEntries',
						description: 'All data items of the last-executed node',
					},
					{
						name: 'First Incoming Item',
						value: 'firstEntry',
						description: 'First data item of the last-executed node',
					},
					{
						name: 'No Data',
						value: 'noData',
						description: 'No data gets returned',
					},
				],
				default: 'firstEntry',
				description: 'What data should be returned',
			},
			...waitTimeProperties,
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add option',
				default: {},
				displayOptions: displayOnWebhook,
				options: [webhookSuffix],
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add option',
				default: {},
				displayOptions: displayOnFormSubmission,
				options: [webhookSuffix],
			},
		],
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const resume = this.getNodeParameter('resume', 0) as string;
		const responseMode = this.getNodeParameter('responseMode', 0) as string;
		const responseCode = (this.getNodeParameter('responseCode', 0) as number) || 200;

		// Get incoming webhook data
		const req = this.getRequestObject();
		const body = this.getBodyData();
		const headers = this.getHeaderData();
		const query = this.getQueryData();

		// Prepare workflow data from webhook
		const workflowData: INodeExecutionData[] = [
			{
				json: {
					body,
					headers,
					query,
					method: req.method,
					url: req.url,
				},
			},
		];

		if (resume === 'form') {
			// Form webhook handling
			return {
				workflowData: [workflowData],
			};
		}

		// Webhook handling - return workflow data
		// Response handling is managed by n8n based on responseMode parameter
		return {
			workflowData: [workflowData],
		};
	}

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const resume = this.getNodeParameter('resume', 0) as string;

		if (['webhook', 'form'].includes(resume)) {
			let hasFormTrigger = false;

			if (resume === 'form') {
				const parentNodes = this.getParentNodes(this.getNode().name);
				hasFormTrigger = parentNodes.some((node) => node.type === FORM_TRIGGER_NODE_TYPE);
			}

			const returnData = await configureAndPutToWait(this);

			if (resume === 'form' && hasFormTrigger) {
				this.sendResponse({
					headers: {
						location: this.evaluateExpression('{{ $execution.resumeFormUrl }}', 0),
					},
					statusCode: 307,
				});
			}

			return returnData;
		}

		let waitTill: Date;
		if (resume === 'timeInterval') {
			const unit = this.getNodeParameter('unit', 0) as string;

			if (!validateWaitUnit(unit)) {
				throw new NodeOperationError(
					this.getNode(),
					"Invalid wait unit. Valid units are 'seconds', 'minutes', 'hours', or 'days'.",
				);
			}

			let waitAmount = this.getNodeParameter('amount', 0) as number;

			if (!validateWaitAmount(waitAmount)) {
				throw new NodeOperationError(
					this.getNode(),
					'Invalid wait amount. Please enter a number that is 0 or greater.',
				);
			}

			if (unit === 'minutes') {
				waitAmount *= 60;
			}
			if (unit === 'hours') {
				waitAmount *= 60 * 60;
			}
			if (unit === 'days') {
				waitAmount *= 60 * 60 * 24;
			}

			waitAmount *= 1000;

			// Timezone does not change relative dates, since they are just
			// a number of seconds added to the current timestamp
			waitTill = new Date(new Date().getTime() + waitAmount);
		} else {
			try {
				const dateTimeStrRaw = this.getNodeParameter('dateTime', 0) as string;
				const parsedDateTime = tryToParseDateTime(dateTimeStrRaw);

				waitTill = parsedDateTime.toUTC().toJSDate();
			} catch (e) {
				throw new NodeOperationError(
					this.getNode(),
					'Cannot put execution to wait because `dateTime` parameter is not a valid date. Please pick a specific date and time to wait until.',
				);
			}
		}

		const waitValue = Math.max(waitTill.getTime() - new Date().getTime(), 0);

		if (waitValue < 65000) {
			// If wait time is shorter than 65 seconds leave execution active because
			// we just check the database every 60 seconds.
			return await new Promise((resolve) => {
				const timer = setTimeout(() => resolve([this.getInputData()]), waitValue);
				this.onExecutionCancellation(() => clearTimeout(timer));
			});
		}

		// If longer than 65 seconds put execution to wait
		return await putToWait(this, waitTill);
	}
}

async function configureAndPutToWait(context: IExecuteFunctions): Promise<INodeExecutionData[][]> {
	let waitTill = WAIT_INDEFINITELY;
	const limitWaitTime = context.getNodeParameter('limitWaitTime', 0) as boolean;

	if (limitWaitTime === true) {
		const limitType = context.getNodeParameter('limitType', 0) as string;

		if (limitType === 'afterTimeInterval') {
			let waitAmount = context.getNodeParameter('resumeAmount', 0) as number;
			const resumeUnit = context.getNodeParameter('resumeUnit', 0) as string;

			if (resumeUnit === 'minutes') {
				waitAmount *= 60;
			}
			if (resumeUnit === 'hours') {
				waitAmount *= 60 * 60;
			}
			if (resumeUnit === 'days') {
				waitAmount *= 60 * 60 * 24;
			}

			waitAmount *= 1000;
			waitTill = new Date(new Date().getTime() + waitAmount);
		} else {
			waitTill = new Date(context.getNodeParameter('maxDateAndTime', 0) as string);
		}
	}

	return await putToWait(context, waitTill);
}

async function putToWait(context: IExecuteFunctions, waitTill: Date): Promise<INodeExecutionData[][]> {
	await context.putExecutionToWait(waitTill);
	return [context.getInputData()];
}

// Export for CommonJS
exports.Wait = Wait;
