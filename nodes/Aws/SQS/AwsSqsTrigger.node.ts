import {
	IDataObject,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
	ITriggerFunctions,
	ITriggerResponse,
	JsonObject,
	NodeApiError,
	NodeConnectionType,
	NodeOperationError,
} from 'n8n-workflow';

import {
	SQSClient,
	ReceiveMessageCommand,
	DeleteMessageCommand,
	DeleteMessageBatchCommand,
	ListQueuesCommand,
} from '@aws-sdk/client-sqs';

export class AwsSqsTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'AWS SQS Trigger',
		name: 'awsSqsTrigger',
		icon: 'file:awssqs.svg',
		group: ['trigger'],
		version: 1,
		subtitle: `={{$parameter["queue"]}}`,
		description: 'Consume queue messages from AWS SQS',
		defaults: {
			name: 'AWS SQS Trigger',
		},
		inputs: [],
		outputs: [NodeConnectionType.Main],
		credentials: [
			{
				name: 'aws',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Queue Name or ID',
				name: 'queue',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getQueues',
				},
				options: [],
				default: '',
				required: true,
				description:
					'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
			},
			{
				displayName: 'Interval',
				name: 'interval',
				type: 'number',
				typeOptions: {
					minValue: 1,
				},
				default: 1,
				description: 'Interval value which the queue will be checked for new messages',
			},
			{
				displayName: 'Unit',
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
				],
				default: 'seconds',
				description: 'Unit of the interval value',
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Attribute Names',
						name: 'attributeNames',
						type: 'string',
						default: 'All',
						description: 'Queue attribute names to retrieve. Use "All" to retrieve all attributes.',
					},
					{
						displayName: 'Delete Messages',
						name: 'deleteMessages',
						type: 'boolean',
						default: true,
						description: 'Whether to delete messages after receiving them',
					},
					{
						displayName: 'Max Number Of Messages',
						name: 'maxNumberOfMessages',
						type: 'number',
						default: 1,
						typeOptions: {
							minValue: 1,
							maxValue: 10,
						},
						description:
							'Maximum number of messages to return. SQS never returns more messages than this value but might return fewer.',
					},
					{
						displayName: 'Message Attribute Names',
						name: 'messageAttributeNames',
						type: 'string',
						default: 'All',
						description:
							'Message attribute names to retrieve. Use "All" to retrieve all attributes.',
					},
					{
						displayName: 'Visibility Timeout',
						name: 'visibilityTimeout',
						type: 'number',
						default: 30,
						description:
							'The duration (in seconds) that the received messages are hidden from subsequent retrieve requests after being retrieved by a receive message request',
					},
					{
						displayName: 'Wait Time Seconds',
						name: 'waitTimeSeconds',
						type: 'number',
						default: 0,
						typeOptions: {
							minValue: 0,
							maxValue: 20,
						},
						description:
							'Enable long-polling with a non-zero number of seconds. Maximum 20 seconds.',
					},
				],
			},
		],
	};

	methods = {
		loadOptions: {
			async getQueues(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const credentials = await this.getCredentials('aws');

				const sqsClient = new SQSClient({
					region: credentials.region as string,
					credentials: {
						accessKeyId: credentials.accessKeyId as string,
						secretAccessKey: credentials.secretAccessKey as string,
						sessionToken: credentials.sessionToken as string,
					},
				});

				try {
					const command = new ListQueuesCommand({});
					const response = await sqsClient.send(command);

					if (!response.QueueUrls || response.QueueUrls.length === 0) {
						return [];
					}

					return response.QueueUrls.map((queueUrl: string) => {
						const urlParts = queueUrl.split('/');
						const name = urlParts[urlParts.length - 1];

						return {
							name,
							value: queueUrl,
						};
					});
				} catch (error) {
					throw new NodeApiError(this.getNode(), error as JsonObject);
				} finally {
					sqsClient.destroy();
				}
			},
		},
	};

	async trigger(this: ITriggerFunctions): Promise<ITriggerResponse> {
		const queueUrl = this.getNodeParameter('queue') as string;
		const interval = this.getNodeParameter('interval') as number;
		const unit = this.getNodeParameter('unit') as string;
		const options = this.getNodeParameter('options', {}) as IDataObject;

		if (interval <= 0) {
			throw new NodeOperationError(
				this.getNode(),
				'The interval has to be set to at least 1 or higher!',
			);
		}

		if (options.waitTimeSeconds !== undefined) {
			const waitTime = options.waitTimeSeconds as number;
			if (waitTime < 0 || waitTime > 20) {
				throw new NodeOperationError(this.getNode(), 'Wait Time Seconds must be between 0 and 20.');
			}
		}

		let intervalValue = interval;
		if (unit === 'minutes') {
			intervalValue *= 60;
		}
		if (unit === 'hours') {
			intervalValue *= 60 * 60;
		}

		intervalValue *= 1000;

		if (intervalValue > 2147483647) {
			throw new NodeApiError(this.getNode(), { message: 'The interval value is too large.' });
		}

		const credentials = await this.getCredentials('aws');
		const sqsClient = new SQSClient({
			region: credentials.region as string,
			credentials: {
				accessKeyId: credentials.accessKeyId as string,
				secretAccessKey: credentials.secretAccessKey as string,
				sessionToken: credentials.sessionToken as string,
			},
		});

		const executeTrigger = async () => {
			try {
				const receiveParams: any = {
					QueueUrl: queueUrl,
					MessageAttributeNames: [(options.messageAttributeNames as string) || 'All'],
					AttributeNames: [(options.attributeNames as string) || 'All'],
				};

				if (options.visibilityTimeout !== undefined) {
					receiveParams.VisibilityTimeout = options.visibilityTimeout as number;
				}

				if (options.maxNumberOfMessages !== undefined) {
					receiveParams.MaxNumberOfMessages = options.maxNumberOfMessages as number;
				}

				if (options.waitTimeSeconds !== undefined) {
					receiveParams.WaitTimeSeconds = options.waitTimeSeconds as number;
				}

				const receiveCommand = new ReceiveMessageCommand(receiveParams);
				const response = await sqsClient.send(receiveCommand);

				if (response.Messages && response.Messages.length > 0) {
					const returnMessages: INodeExecutionData[] = response.Messages.map((message) => {
						let parsedBody;
						try {
							parsedBody = message.Body ? JSON.parse(message.Body) : {};
						} catch {
							parsedBody = message.Body;
						}

						return {
							json: {
								messageId: message.MessageId,
								receiptHandle: message.ReceiptHandle,
								body: message.Body,
								parsedBody,
								attributes: message.Attributes || {},
								messageAttributes: message.MessageAttributes || {},
								md5OfBody: message.MD5OfBody,
								md5OfMessageAttributes: message.MD5OfMessageAttributes,
							},
						};
					});

					if (options.deleteMessages !== false) {
						if (response.Messages.length === 1) {
							const deleteCommand = new DeleteMessageCommand({
								QueueUrl: queueUrl,
								ReceiptHandle: response.Messages[0].ReceiptHandle,
							});
							await sqsClient.send(deleteCommand);
						} else {
							const deleteEntries = response.Messages.map((message, index) => ({
								Id: `msg${index + 1}`,
								ReceiptHandle: message.ReceiptHandle!,
							}));

							const deleteBatchCommand = new DeleteMessageBatchCommand({
								QueueUrl: queueUrl,
								Entries: deleteEntries,
							});
							await sqsClient.send(deleteBatchCommand);
						}
					}

					this.emit([returnMessages]);
				}
			} catch (error) {
				throw new NodeApiError(this.getNode(), error as JsonObject);
			}
		};

		let running = true;
		let intervalObj = setTimeout(run, 0);

		async function run() {
			await executeTrigger();
			if (running) {
				intervalObj = setTimeout(run, intervalValue);
			}
		}

		async function closeFunction() {
			running = false;
			clearTimeout(intervalObj);
			sqsClient.destroy();
		}

		return {
			closeFunction,
		};
	}
}
