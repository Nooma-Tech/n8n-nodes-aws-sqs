import {
	IPollFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeConnectionType,
	NodeOperationError,
} from 'n8n-workflow';
import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';

export class AwsSqsTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'AWS SQS Trigger',
		name: 'awsSqsTrigger',
		icon: 'file:sqs.svg',
		group: ['trigger'],
		version: 1,
		description: 'Starts the workflow when AWS SQS messages are received',
		defaults: {
			name: 'AWS SQS',
		},
		inputs: [],
		outputs: [NodeConnectionType.Main],
		credentials: [
			{
				name: 'aws',
				required: true,
			},
		],
		polling: true,
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
				displayName: 'Auto Delete Messages',
				name: 'autoDelete',
				type: 'boolean',
				default: true,
				description: 'Whether to automatically delete messages after processing them',
			},
			{
				displayName: 'Include Message Attributes',
				name: 'includeMessageAttributes',
				type: 'boolean',
				default: true,
				description: 'Whether to include message attributes in the output',
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

	async poll(this: IPollFunctions): Promise<INodeExecutionData[][]> {
		const queueUrl = this.getNodeParameter('queueUrl') as string;
		const maxNumberOfMessages = this.getNodeParameter('maxNumberOfMessages', 10) as number;
		const visibilityTimeout = this.getNodeParameter('visibilityTimeout', 20) as number;
		const waitTimeSeconds = this.getNodeParameter('waitTimeSeconds', 0) as number;
		const autoDelete = this.getNodeParameter('autoDelete', true) as boolean;
		const includeMessageAttributes = this.getNodeParameter(
			'includeMessageAttributes',
			true,
		) as boolean;
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

		try {
			const command = new ReceiveMessageCommand(receiveParams);
			const response = await sqsClient.send(command);

			if (!response.Messages || response.Messages.length === 0) {
				return [];
			}

			const returnData: INodeExecutionData[] = [];

			for (const message of response.Messages) {
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

				returnData.push(nodeExecutionData);

				if (autoDelete && message.ReceiptHandle) {
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
			}

			return [returnData];
		} catch (error) {
			throw new NodeOperationError(
				this.getNode(),
				`Failed to receive messages from SQS queue: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}
}
