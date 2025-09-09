import {
	ITriggerFunctions,
	ITriggerResponse,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeConnectionType,
	NodeOperationError,
} from 'n8n-workflow';
import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';

interface MessageTracker {
	activeMessages: Map<string, any>;
	closeRequested: boolean;
}

export class AwsSqsTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'AWS SQS Trigger',
		name: 'awsSqsTrigger',
		icon: 'file:awssqs.svg',
		group: ['trigger'],
		version: 1,
		description: 'Starts the workflow when AWS SQS messages are received',
		eventTriggerDescription: '',
		defaults: {
			name: 'AWS SQS',
		},
		triggerPanel: {
			header: '',
			executionsHelp: {
				inactive:
					"<b>While building your workflow</b>, click the 'execute step' button, then send a message to your SQS queue. This will trigger an execution, which will show up in this editor.<br /> <br /><b>Once you're happy with your workflow</b>, <a data-key='activate'>activate</a> it. Then every time a message is received, the workflow will execute. These executions will show up in the <a data-key='executions'>executions list</a>, but not in the editor.",
				active:
					"<b>While building your workflow</b>, click the 'execute step' button, then send a message to your SQS queue. This will trigger an execution, which will show up in this editor.<br /> <br /><b>Your workflow will also execute automatically</b>, since it's activated. Every time a message is received, this node will trigger an execution. These executions will show up in the <a data-key='executions'>executions list</a>, but not in the editor.",
			},
			activationHint:
				"Once you've finished building your workflow, <a data-key='activate'>activate</a> it to have it also listen continuously (you just won't see those executions here).",
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
				displayName: 'Queue URL',
				name: 'queueUrl',
				type: 'string',
				default: '',
				required: true,
				description: 'The URL of the SQS queue to monitor',
				placeholder: 'https://sqs.region.amazonaws.com/account-ID/queue-name',
			},
			{
				displayName: 'Max Number of Messages',
				name: 'maxNumberOfMessages',
				type: 'number',
				default: 10,
				typeOptions: {
					minValue: 1,
					maxValue: 10,
				},
				description: 'Maximum number of messages to receive per poll (1-10)',
			},
			{
				displayName: 'Visibility Timeout',
				name: 'visibilityTimeout',
				type: 'number',
				default: 20,
				typeOptions: {
					minValue: 0,
					maxValue: 43200,
				},
				description:
					'The duration (in seconds) that the received messages are hidden from subsequent retrieve requests',
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
					'The duration (in seconds) for which the call waits for a message to arrive in the queue before returning',
			},
			{
				displayName: 'Delete From Queue When',
				name: 'acknowledge',
				type: 'options',
				options: [
					{
						name: 'Execution Finishes',
						value: 'executionFinishes',
						description:
							'After the workflow execution finished. No matter if the execution was successful or not.',
					},
					{
						name: 'Execution Finishes Successfully',
						value: 'executionFinishesSuccessfully',
						description: 'After the workflow execution finished successfully',
					},
					{
						name: 'Immediately',
						value: 'immediately',
						description: 'As soon as the message got received',
					},
				],
				default: 'immediately',
				description: 'When to acknowledge the message',
			},
			{
				displayName: 'Include Message Attributes',
				name: 'includeMessageAttributes',
				type: 'boolean',
				default: true,
				description: 'Whether to include message attributes in the output',
			},
			{
				displayName: 'Parallel Message Processing Limit',
				name: 'parallelMessages',
				type: 'number',
				default: -1,
				displayOptions: {
					hide: {
						acknowledge: ['immediately'],
					},
				},
				description: 'Max number of executions at a time. Use -1 for no limit.',
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
						type: 'multiOptions',
						options: [
							{
								name: 'All',
								value: 'All',
							},
							{
								name: 'Approximate First Receive Timestamp',
								value: 'ApproximateFirstReceiveTimestamp',
							},
							{
								name: 'Approximate Receive Count',
								value: 'ApproximateReceiveCount',
							},
							{
								name: 'AWS Trace Header',
								value: 'AWSTraceHeader',
							},
							{
								name: 'Message Deduplication ID',
								value: 'MessageDeduplicationId',
							},
							{
								name: 'Message Group ID',
								value: 'MessageGroupId',
							},
							{
								name: 'Sender ID',
								value: 'SenderId',
							},
							{
								name: 'Sent Timestamp',
								value: 'SentTimestamp',
							},
							{
								name: 'Sequence Number',
								value: 'SequenceNumber',
							},
						],
						default: ['All'],
						description: 'List of attributes to retrieve',
					},
					{
						displayName: 'Message Attribute Names',
						name: 'messageAttributeNames',
						type: 'string',
						default: 'All',
						description: 'Message attribute names to retrieve (comma-separated or "All")',
					},
				],
			},
		],
	};

	async trigger(this: ITriggerFunctions): Promise<ITriggerResponse> {
		const queueUrl = this.getNodeParameter('queueUrl') as string;
		const maxNumberOfMessages = this.getNodeParameter('maxNumberOfMessages', 10) as number;
		const visibilityTimeout = this.getNodeParameter('visibilityTimeout', 20) as number;
		const waitTimeSeconds = this.getNodeParameter('waitTimeSeconds', 0) as number;
		const acknowledge = this.getNodeParameter('acknowledge', 'immediately') as string;
		const includeMessageAttributes = this.getNodeParameter(
			'includeMessageAttributes',
			true,
		) as boolean;
		const parallelMessages = this.getNodeParameter('parallelMessages', -1) as number;
		const options = this.getNodeParameter('options', {}) as any;

		const credentials = await this.getCredentials('aws');

		const sqsClient = new SQSClient({
			region: credentials.region as string,
			credentials: {
				accessKeyId: credentials.accessKeyId as string,
				secretAccessKey: credentials.secretAccessKey as string,
				...(credentials.sessionToken && { sessionToken: credentials.sessionToken as string }),
			},
		});

		const messageTracker: MessageTracker = {
			activeMessages: new Map(),
			closeRequested: false,
		};

		let isPolling = false;

		// Validate parallel messages setting
		if (isNaN(parallelMessages) || parallelMessages === 0 || parallelMessages < -1) {
			throw new NodeOperationError(
				this.getNode(),
				'Parallel message processing limit must be a number greater than zero (or -1 for no limit)',
			);
		}

		const receiveParams: any = {
			QueueUrl: queueUrl,
			MaxNumberOfMessages: maxNumberOfMessages,
			VisibilityTimeout: visibilityTimeout,
			WaitTimeSeconds: waitTimeSeconds,
		};

		if (options.attributeNames && options.attributeNames.length > 0) {
			receiveParams.AttributeNames = options.attributeNames;
		}

		if (includeMessageAttributes) {
			const messageAttributeNames = options.messageAttributeNames || 'All';
			if (messageAttributeNames === 'All') {
				receiveParams.MessageAttributeNames = ['All'];
			} else {
				receiveParams.MessageAttributeNames = messageAttributeNames
					.split(',')
					.map((name: string) => name.trim());
			}
		}

		const processMessage = async (message: any) => {
			if (messageTracker.closeRequested) {
				return;
			}

			const nodeExecutionData: INodeExecutionData = {
				json: {
					messageId: message.MessageId,
					body: message.Body,
					receiptHandle: message.ReceiptHandle,
					md5OfBody: message.MD5OfBody,
					attributes: message.Attributes || {},
					messageAttributes: message.MessageAttributes || {},
					timestamp: new Date().toISOString(),
				},
			};

			try {
				const parsedBody = JSON.parse(message.Body || '{}');
				nodeExecutionData.json.parsedBody = parsedBody;
			} catch (error) {
				nodeExecutionData.json.parsedBody = null;
			}

			// Store message for potential cleanup
			if (acknowledge !== 'immediately') {
				messageTracker.activeMessages.set(message.MessageId, {
					receiptHandle: message.ReceiptHandle,
					queueUrl,
				});
			}

			// Delete immediately if configured
			if (acknowledge === 'immediately' && message.ReceiptHandle) {
				try {
					const deleteCommand = new DeleteMessageCommand({
						QueueUrl: queueUrl,
						ReceiptHandle: message.ReceiptHandle,
					});
					await sqsClient.send(deleteCommand);
				} catch (deleteError) {
					console.warn(`Failed to delete message ${message.MessageId}:`, deleteError);
				}
			}

			// Emit the workflow trigger
			this.emit([nodeExecutionData], undefined, {
				executionFinished:
					acknowledge === 'executionFinishes'
						? async () => {
								await this.deleteMessage(sqsClient, message.MessageId, messageTracker);
							}
						: undefined,
				executionFinishedSuccessfully:
					acknowledge === 'executionFinishesSuccessfully'
						? async () => {
								await this.deleteMessage(sqsClient, message.MessageId, messageTracker);
							}
						: undefined,
			});
		};

		const pollForMessages = async () => {
			if (messageTracker.closeRequested || isPolling) {
				return;
			}

			isPolling = true;

			try {
				// Check parallel processing limit
				if (parallelMessages !== -1 && messageTracker.activeMessages.size >= parallelMessages) {
					return;
				}

				const command = new ReceiveMessageCommand(receiveParams);
				const response = await sqsClient.send(command);

				if (response.Messages && response.Messages.length > 0) {
					for (const message of response.Messages) {
						await processMessage(message);
					}
				}
			} catch (error) {
				if (!messageTracker.closeRequested) {
					this.emitError(
						new NodeOperationError(
							this.getNode(),
							`Failed to receive messages from SQS queue: ${error instanceof Error ? error.message : String(error)}`,
						),
					);
				}
			} finally {
				isPolling = false;
			}
		};

		// Start continuous polling
		const startPolling = () => {
			if (!messageTracker.closeRequested) {
				pollForMessages().finally(() => {
					if (!messageTracker.closeRequested) {
						setTimeout(startPolling, 1000); // Poll every second
					}
				});
			}
		};

		const closeFunction = async () => {
			messageTracker.closeRequested = true;

			// Clean up any remaining messages
			for (const [messageId, messageData] of messageTracker.activeMessages.entries()) {
				try {
					const deleteCommand = new DeleteMessageCommand({
						QueueUrl: messageData.queueUrl,
						ReceiptHandle: messageData.receiptHandle,
					});
					await sqsClient.send(deleteCommand);
				} catch (error) {
					console.warn(`Failed to delete message ${messageId} during cleanup:`, error);
				}
			}
			messageTracker.activeMessages.clear();
		};

		// Handle manual trigger mode
		if (this.getMode() === 'manual') {
			const manualTriggerFunction = async () => {
				await pollForMessages();
			};

			return {
				closeFunction,
				manualTriggerFunction,
			};
		}

		// Start continuous polling for active mode
		startPolling();

		return {
			closeFunction,
		};
	}

	private async deleteMessage(
		sqsClient: SQSClient,
		messageId: string,
		messageTracker: MessageTracker,
	) {
		const messageData = messageTracker.activeMessages.get(messageId);
		if (messageData) {
			try {
				const deleteCommand = new DeleteMessageCommand({
					QueueUrl: messageData.queueUrl,
					ReceiptHandle: messageData.receiptHandle,
				});
				await sqsClient.send(deleteCommand);
				messageTracker.activeMessages.delete(messageId);
			} catch (error) {
				console.warn(`Failed to delete message ${messageId}:`, error);
			}
		}
	}
}
