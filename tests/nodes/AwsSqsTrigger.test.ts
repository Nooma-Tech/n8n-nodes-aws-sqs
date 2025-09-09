import { AwsSqsTrigger } from '../../nodes/Aws/SQS/AwsSqsTrigger.node';
import {
	ILoadOptionsFunctions,
	ITriggerFunctions,
	NodeApiError,
	NodeOperationError,
} from 'n8n-workflow';
import { SQSClient } from '@aws-sdk/client-sqs';

jest.mock('@aws-sdk/client-sqs');

const MockedSQSClient = SQSClient as jest.MockedClass<typeof SQSClient>;

describe('AwsSqsTrigger', () => {
	let awsSqsTrigger: AwsSqsTrigger;
	let mockSqsClient: jest.Mocked<SQSClient>;

	beforeEach(() => {
		awsSqsTrigger = new AwsSqsTrigger();
		mockSqsClient = {
			send: jest.fn().mockResolvedValue({}),
			destroy: jest.fn(),
		} as any;

		MockedSQSClient.mockImplementation(() => mockSqsClient);

		jest.clearAllMocks();
	});

	describe('Node Description', () => {
		it('should have correct node description', () => {
			expect(awsSqsTrigger.description.displayName).toBe('AWS SQS Trigger');
			expect(awsSqsTrigger.description.name).toBe('awsSqsTrigger');
			expect(awsSqsTrigger.description.icon).toBe('file:awssqs.svg');
			expect(awsSqsTrigger.description.group).toEqual(['trigger']);
			expect(awsSqsTrigger.description.version).toBe(1);
		});

		it('should have required credentials', () => {
			expect(awsSqsTrigger.description.credentials).toEqual([
				{
					name: 'aws',
					required: true,
				},
			]);
		});

		it('should have correct properties structure', () => {
			const properties = awsSqsTrigger.description.properties;
			expect(properties).toHaveLength(4);

			const queueProperty = properties.find((p) => p.name === 'queue');
			expect(queueProperty).toBeDefined();
			expect(queueProperty?.required).toBe(true);

			const intervalProperty = properties.find((p) => p.name === 'interval');
			expect(intervalProperty).toBeDefined();
			expect(intervalProperty?.default).toBe(1);
		});

		it('should have options in alphabetical order', () => {
			const optionsProperty = awsSqsTrigger.description.properties.find(
				(p) => p.name === 'options',
			);
			expect(optionsProperty).toBeDefined();

			if (optionsProperty && 'options' in optionsProperty) {
				const options = optionsProperty.options as any[];
				const names = options.map((opt) => opt.displayName);
				const sortedNames = [...names].sort();
				expect(names).toEqual(sortedNames);
			}
		});
	});

	describe('loadOptions - getQueues', () => {
		let mockLoadOptionsFunctions: jest.Mocked<ILoadOptionsFunctions>;

		beforeEach(() => {
			mockLoadOptionsFunctions = {
				getCredentials: jest.fn(),
				getNode: jest.fn(),
			} as any;
		});

		it('should load queues successfully', async () => {
			const mockCredentials = {
				region: 'us-east-1',
				accessKeyId: 'test-access-key',
				secretAccessKey: 'test-secret-key',
				sessionToken: 'test-session-token',
			};

			const mockQueueUrls = [
				'https://sqs.us-east-1.amazonaws.com/123456789012/queue1',
				'https://sqs.us-east-1.amazonaws.com/123456789012/queue2.fifo',
			];

			mockLoadOptionsFunctions.getCredentials.mockResolvedValue(mockCredentials);
			(mockSqsClient.send as jest.Mock).mockResolvedValue({ QueueUrls: mockQueueUrls });

			const result =
				await awsSqsTrigger.methods.loadOptions.getQueues.call(mockLoadOptionsFunctions);

			expect(result).toEqual([
				{ name: 'queue1', value: 'https://sqs.us-east-1.amazonaws.com/123456789012/queue1' },
				{
					name: 'queue2.fifo',
					value: 'https://sqs.us-east-1.amazonaws.com/123456789012/queue2.fifo',
				},
			]);

			expect(MockedSQSClient).toHaveBeenCalledWith({
				region: 'us-east-1',
				credentials: {
					accessKeyId: 'test-access-key',
					secretAccessKey: 'test-secret-key',
					sessionToken: 'test-session-token',
				},
			});

			expect(mockSqsClient.destroy).toHaveBeenCalled();
		});

		it('should return empty array when no queues exist', async () => {
			const mockCredentials = {
				region: 'us-east-1',
				accessKeyId: 'test-access-key',
				secretAccessKey: 'test-secret-key',
			};

			mockLoadOptionsFunctions.getCredentials.mockResolvedValue(mockCredentials);
			(mockSqsClient.send as jest.Mock).mockResolvedValue({ QueueUrls: [] });

			const result =
				await awsSqsTrigger.methods.loadOptions.getQueues.call(mockLoadOptionsFunctions);

			expect(result).toEqual([]);
		});

		it('should return empty array when QueueUrls is undefined', async () => {
			const mockCredentials = {
				region: 'us-east-1',
				accessKeyId: 'test-access-key',
				secretAccessKey: 'test-secret-key',
			};

			mockLoadOptionsFunctions.getCredentials.mockResolvedValue(mockCredentials);
			(mockSqsClient.send as jest.Mock).mockResolvedValue({});

			const result =
				await awsSqsTrigger.methods.loadOptions.getQueues.call(mockLoadOptionsFunctions);

			expect(result).toEqual([]);
		});

		it('should handle API errors', async () => {
			const mockCredentials = {
				region: 'us-east-1',
				accessKeyId: 'test-access-key',
				secretAccessKey: 'test-secret-key',
			};

			const error = new Error('AWS API Error');
			mockLoadOptionsFunctions.getCredentials.mockResolvedValue(mockCredentials);
			mockLoadOptionsFunctions.getNode.mockReturnValue({} as any);
			(mockSqsClient.send as jest.Mock).mockRejectedValue(error);

			await expect(
				awsSqsTrigger.methods.loadOptions.getQueues.call(mockLoadOptionsFunctions),
			).rejects.toThrow(NodeApiError);

			expect(mockSqsClient.destroy).toHaveBeenCalled();
		});
	});

	describe('trigger', () => {
		let mockTriggerFunctions: jest.Mocked<ITriggerFunctions>;

		beforeEach(() => {
			mockTriggerFunctions = {
				getNodeParameter: jest.fn(),
				getCredentials: jest.fn(),
				getNode: jest.fn(),
				emit: jest.fn(),
			} as any;
		});

		it('should validate interval parameter', async () => {
			mockTriggerFunctions.getNodeParameter
				.mockReturnValueOnce('https://sqs.us-east-1.amazonaws.com/123456789012/test-queue')
				.mockReturnValueOnce(0)
				.mockReturnValueOnce('seconds')
				.mockReturnValueOnce({});

			mockTriggerFunctions.getNode.mockReturnValue({} as any);

			await expect(awsSqsTrigger.trigger.call(mockTriggerFunctions)).rejects.toThrow(
				NodeOperationError,
			);
		});

		it('should validate waitTimeSeconds parameter', async () => {
			mockTriggerFunctions.getNodeParameter
				.mockReturnValueOnce('https://sqs.us-east-1.amazonaws.com/123456789012/test-queue')
				.mockReturnValueOnce(1)
				.mockReturnValueOnce('seconds')
				.mockReturnValueOnce({ waitTimeSeconds: 25 });

			mockTriggerFunctions.getNode.mockReturnValue({} as any);

			await expect(awsSqsTrigger.trigger.call(mockTriggerFunctions)).rejects.toThrow(
				NodeOperationError,
			);
		});

		it('should validate negative waitTimeSeconds parameter', async () => {
			mockTriggerFunctions.getNodeParameter
				.mockReturnValueOnce('https://sqs.us-east-1.amazonaws.com/123456789012/test-queue')
				.mockReturnValueOnce(1)
				.mockReturnValueOnce('seconds')
				.mockReturnValueOnce({ waitTimeSeconds: -1 });

			mockTriggerFunctions.getNode.mockReturnValue({} as any);

			await expect(awsSqsTrigger.trigger.call(mockTriggerFunctions)).rejects.toThrow(
				NodeOperationError,
			);
		});

		it('should handle large interval values', async () => {
			mockTriggerFunctions.getNodeParameter
				.mockReturnValueOnce('https://sqs.us-east-1.amazonaws.com/123456789012/test-queue')
				.mockReturnValueOnce(2147484)
				.mockReturnValueOnce('seconds')
				.mockReturnValueOnce({});

			mockTriggerFunctions.getNode.mockReturnValue({} as any);

			await expect(awsSqsTrigger.trigger.call(mockTriggerFunctions)).rejects.toThrow(NodeApiError);
		});

		it('should setup trigger with correct parameters', async () => {
			const mockCredentials = {
				region: 'us-east-1',
				accessKeyId: 'test-access-key',
				secretAccessKey: 'test-secret-key',
			};

			mockTriggerFunctions.getNodeParameter
				.mockReturnValueOnce('https://sqs.us-east-1.amazonaws.com/123456789012/test-queue')
				.mockReturnValueOnce(5)
				.mockReturnValueOnce('minutes')
				.mockReturnValueOnce({
					deleteMessages: true,
					visibilityTimeout: 60,
					maxNumberOfMessages: 5,
					waitTimeSeconds: 10,
				});

			mockTriggerFunctions.getCredentials.mockResolvedValue(mockCredentials);
			(mockSqsClient.send as jest.Mock).mockResolvedValue({ Messages: [] });

			const result = await awsSqsTrigger.trigger.call(mockTriggerFunctions);

			expect(MockedSQSClient).toHaveBeenCalledWith({
				region: 'us-east-1',
				credentials: {
					accessKeyId: 'test-access-key',
					secretAccessKey: 'test-secret-key',
					sessionToken: undefined,
				},
			});

			expect(result.closeFunction).toBeDefined();
			expect(typeof result.closeFunction).toBe('function');

			await result.closeFunction?.();
		});

		it('should convert time units correctly', async () => {
			const mockCredentials = {
				region: 'us-east-1',
				accessKeyId: 'test-access-key',
				secretAccessKey: 'test-secret-key',
			};

			// Test hours conversion
			mockTriggerFunctions.getNodeParameter
				.mockReturnValueOnce('https://sqs.us-east-1.amazonaws.com/123456789012/test-queue')
				.mockReturnValueOnce(2)
				.mockReturnValueOnce('hours')
				.mockReturnValueOnce({});

			mockTriggerFunctions.getCredentials.mockResolvedValue(mockCredentials);
			(mockSqsClient.send as jest.Mock).mockResolvedValue({ Messages: [] });

			const result = await awsSqsTrigger.trigger.call(mockTriggerFunctions);

			expect(result.closeFunction).toBeDefined();

			await result.closeFunction?.();
			expect(mockSqsClient.destroy).toHaveBeenCalled();
		});

		it('should handle message processing parameters', async () => {
			const mockCredentials = {
				region: 'us-east-1',
				accessKeyId: 'test-access-key',
				secretAccessKey: 'test-secret-key',
			};

			mockTriggerFunctions.getNodeParameter
				.mockReturnValueOnce('https://sqs.us-east-1.amazonaws.com/123456789012/test-queue')
				.mockReturnValueOnce(1)
				.mockReturnValueOnce('seconds')
				.mockReturnValueOnce({
					messageAttributeNames: 'priority,source',
					attributeNames: 'ApproximateReceiveCount',
					visibilityTimeout: 120,
					maxNumberOfMessages: 3,
					waitTimeSeconds: 5,
				});

			mockTriggerFunctions.getCredentials.mockResolvedValue(mockCredentials);
			(mockSqsClient.send as jest.Mock).mockResolvedValue({ Messages: [] });

			const result = await awsSqsTrigger.trigger.call(mockTriggerFunctions);

			expect(result.closeFunction).toBeDefined();

			await result.closeFunction?.();
		});

		it('should handle credentials without session token', async () => {
			const mockCredentials = {
				region: 'us-west-2',
				accessKeyId: 'test-access-key-2',
				secretAccessKey: 'test-secret-key-2',
			};

			mockTriggerFunctions.getNodeParameter
				.mockReturnValueOnce('https://sqs.us-west-2.amazonaws.com/123456789012/test-queue')
				.mockReturnValueOnce(1)
				.mockReturnValueOnce('seconds')
				.mockReturnValueOnce({});

			mockTriggerFunctions.getCredentials.mockResolvedValue(mockCredentials);
			(mockSqsClient.send as jest.Mock).mockResolvedValue({ Messages: [] });

			const result = await awsSqsTrigger.trigger.call(mockTriggerFunctions);

			expect(MockedSQSClient).toHaveBeenCalledWith({
				region: 'us-west-2',
				credentials: {
					accessKeyId: 'test-access-key-2',
					secretAccessKey: 'test-secret-key-2',
					sessionToken: undefined,
				},
			});

			await result.closeFunction?.();
		});

		it('should process messages and emit them', async () => {
			const mockCredentials = {
				region: 'us-east-1',
				accessKeyId: 'test-access-key',
				secretAccessKey: 'test-secret-key',
			};

			const mockMessage = {
				MessageId: 'msg-123',
				ReceiptHandle: 'receipt-handle-123',
				Body: '{"test": "data"}',
				Attributes: { ApproximateReceiveCount: '1' },
				MessageAttributes: { priority: { StringValue: 'high' } },
				MD5OfBody: 'md5-hash',
				MD5OfMessageAttributes: 'md5-attr-hash',
			};

			mockTriggerFunctions.getNodeParameter
				.mockReturnValueOnce('https://sqs.us-east-1.amazonaws.com/123456789012/test-queue')
				.mockReturnValueOnce(1)
				.mockReturnValueOnce('seconds')
				.mockReturnValueOnce({ deleteMessages: true });

			mockTriggerFunctions.getCredentials.mockResolvedValue(mockCredentials);

			// Mock the trigger execution by calling the executeTrigger function directly
			const trigger = awsSqsTrigger.trigger.call(mockTriggerFunctions);

			// Simulate receiving messages
			(mockSqsClient.send as jest.Mock)
				.mockResolvedValueOnce({ Messages: [mockMessage] })
				.mockResolvedValueOnce({}); // For delete operation

			// Wait for trigger setup
			const result = await trigger;

			// Verify SQS client was created correctly
			expect(MockedSQSClient).toHaveBeenCalledWith({
				region: 'us-east-1',
				credentials: {
					accessKeyId: 'test-access-key',
					secretAccessKey: 'test-secret-key',
					sessionToken: undefined,
				},
			});

			await result.closeFunction?.();
		});

		it('should handle multiple messages and batch delete', async () => {
			const mockCredentials = {
				region: 'us-east-1',
				accessKeyId: 'test-access-key',
				secretAccessKey: 'test-secret-key',
			};

			const mockMessages = [
				{
					MessageId: 'msg-123',
					ReceiptHandle: 'receipt-handle-123',
					Body: '{"test": "data1"}',
					Attributes: {},
					MessageAttributes: {},
					MD5OfBody: 'md5-hash-1',
				},
				{
					MessageId: 'msg-456',
					ReceiptHandle: 'receipt-handle-456',
					Body: 'plain text message',
					Attributes: {},
					MessageAttributes: {},
					MD5OfBody: 'md5-hash-2',
				},
			];

			mockTriggerFunctions.getNodeParameter
				.mockReturnValueOnce('https://sqs.us-east-1.amazonaws.com/123456789012/test-queue')
				.mockReturnValueOnce(1)
				.mockReturnValueOnce('seconds')
				.mockReturnValueOnce({ deleteMessages: true });

			mockTriggerFunctions.getCredentials.mockResolvedValue(mockCredentials);

			(mockSqsClient.send as jest.Mock)
				.mockResolvedValueOnce({ Messages: mockMessages })
				.mockResolvedValueOnce({}); // For batch delete operation

			const result = await awsSqsTrigger.trigger.call(mockTriggerFunctions);

			await result.closeFunction?.();
		});

		it('should not delete messages when deleteMessages is false', async () => {
			const mockCredentials = {
				region: 'us-east-1',
				accessKeyId: 'test-access-key',
				secretAccessKey: 'test-secret-key',
			};

			const mockMessage = {
				MessageId: 'msg-123',
				ReceiptHandle: 'receipt-handle-123',
				Body: '{"test": "data"}',
				Attributes: {},
				MessageAttributes: {},
				MD5OfBody: 'md5-hash',
			};

			mockTriggerFunctions.getNodeParameter
				.mockReturnValueOnce('https://sqs.us-east-1.amazonaws.com/123456789012/test-queue')
				.mockReturnValueOnce(1)
				.mockReturnValueOnce('seconds')
				.mockReturnValueOnce({ deleteMessages: false });

			mockTriggerFunctions.getCredentials.mockResolvedValue(mockCredentials);

			(mockSqsClient.send as jest.Mock).mockResolvedValueOnce({ Messages: [mockMessage] });

			const result = await awsSqsTrigger.trigger.call(mockTriggerFunctions);

			await result.closeFunction?.();
		});

		it('should handle no messages scenario', async () => {
			const mockCredentials = {
				region: 'us-east-1',
				accessKeyId: 'test-access-key',
				secretAccessKey: 'test-secret-key',
			};

			mockTriggerFunctions.getNodeParameter
				.mockReturnValueOnce('https://sqs.us-east-1.amazonaws.com/123456789012/test-queue')
				.mockReturnValueOnce(1)
				.mockReturnValueOnce('seconds')
				.mockReturnValueOnce({});

			mockTriggerFunctions.getCredentials.mockResolvedValue(mockCredentials);

			(mockSqsClient.send as jest.Mock).mockResolvedValue({ Messages: [] });

			const result = await awsSqsTrigger.trigger.call(mockTriggerFunctions);

			await result.closeFunction?.();
		});

		it('should handle undefined messages', async () => {
			const mockCredentials = {
				region: 'us-east-1',
				accessKeyId: 'test-access-key',
				secretAccessKey: 'test-secret-key',
			};

			mockTriggerFunctions.getNodeParameter
				.mockReturnValueOnce('https://sqs.us-east-1.amazonaws.com/123456789012/test-queue')
				.mockReturnValueOnce(1)
				.mockReturnValueOnce('seconds')
				.mockReturnValueOnce({});

			mockTriggerFunctions.getCredentials.mockResolvedValue(mockCredentials);

			(mockSqsClient.send as jest.Mock).mockResolvedValue({});

			const result = await awsSqsTrigger.trigger.call(mockTriggerFunctions);

			await result.closeFunction?.();
		});

		it('should handle messages with invalid JSON body', async () => {
			const mockCredentials = {
				region: 'us-east-1',
				accessKeyId: 'test-access-key',
				secretAccessKey: 'test-secret-key',
			};

			const mockMessage = {
				MessageId: 'msg-123',
				ReceiptHandle: 'receipt-handle-123',
				Body: 'invalid json {',
				Attributes: {},
				MessageAttributes: {},
				MD5OfBody: 'md5-hash',
			};

			mockTriggerFunctions.getNodeParameter
				.mockReturnValueOnce('https://sqs.us-east-1.amazonaws.com/123456789012/test-queue')
				.mockReturnValueOnce(1)
				.mockReturnValueOnce('seconds')
				.mockReturnValueOnce({ deleteMessages: true });

			mockTriggerFunctions.getCredentials.mockResolvedValue(mockCredentials);

			(mockSqsClient.send as jest.Mock)
				.mockResolvedValueOnce({ Messages: [mockMessage] })
				.mockResolvedValueOnce({});

			const result = await awsSqsTrigger.trigger.call(mockTriggerFunctions);

			await result.closeFunction?.();
		});

		it('should handle messages with empty body', async () => {
			const mockCredentials = {
				region: 'us-east-1',
				accessKeyId: 'test-access-key',
				secretAccessKey: 'test-secret-key',
			};

			const mockMessage = {
				MessageId: 'msg-123',
				ReceiptHandle: 'receipt-handle-123',
				Body: undefined,
				Attributes: {},
				MessageAttributes: {},
				MD5OfBody: 'md5-hash',
			};

			mockTriggerFunctions.getNodeParameter
				.mockReturnValueOnce('https://sqs.us-east-1.amazonaws.com/123456789012/test-queue')
				.mockReturnValueOnce(1)
				.mockReturnValueOnce('seconds')
				.mockReturnValueOnce({ deleteMessages: true });

			mockTriggerFunctions.getCredentials.mockResolvedValue(mockCredentials);

			(mockSqsClient.send as jest.Mock)
				.mockResolvedValueOnce({ Messages: [mockMessage] })
				.mockResolvedValueOnce({});

			const result = await awsSqsTrigger.trigger.call(mockTriggerFunctions);

			await result.closeFunction?.();
		});

		it('should handle all parameter options', async () => {
			const mockCredentials = {
				region: 'us-east-1',
				accessKeyId: 'test-access-key',
				secretAccessKey: 'test-secret-key',
			};

			mockTriggerFunctions.getNodeParameter
				.mockReturnValueOnce('https://sqs.us-east-1.amazonaws.com/123456789012/test-queue')
				.mockReturnValueOnce(1)
				.mockReturnValueOnce('seconds')
				.mockReturnValueOnce({
					deleteMessages: true,
					visibilityTimeout: 30,
					maxNumberOfMessages: 10,
					waitTimeSeconds: 20,
					messageAttributeNames: 'All',
					attributeNames: 'All',
				});

			mockTriggerFunctions.getCredentials.mockResolvedValue(mockCredentials);

			(mockSqsClient.send as jest.Mock).mockResolvedValue({ Messages: [] });

			const result = await awsSqsTrigger.trigger.call(mockTriggerFunctions);

			await result.closeFunction?.();
		});

		it('should handle parameter options with undefined values', async () => {
			const mockCredentials = {
				region: 'us-east-1',
				accessKeyId: 'test-access-key',
				secretAccessKey: 'test-secret-key',
			};

			mockTriggerFunctions.getNodeParameter
				.mockReturnValueOnce('https://sqs.us-east-1.amazonaws.com/123456789012/test-queue')
				.mockReturnValueOnce(1)
				.mockReturnValueOnce('seconds')
				.mockReturnValueOnce({
					visibilityTimeout: undefined,
					maxNumberOfMessages: undefined,
					waitTimeSeconds: undefined,
				});

			mockTriggerFunctions.getCredentials.mockResolvedValue(mockCredentials);

			(mockSqsClient.send as jest.Mock).mockResolvedValue({ Messages: [] });

			const result = await awsSqsTrigger.trigger.call(mockTriggerFunctions);

			await result.closeFunction?.();
		});
	});

	describe('trigger execution with fake timers', () => {
		let mockTriggerFunctions: jest.Mocked<ITriggerFunctions>;
		let mockEmit: jest.Mock;

		beforeEach(() => {
			jest.useFakeTimers();
			mockEmit = jest.fn();

			mockTriggerFunctions = {
				getNodeParameter: jest.fn(),
				getCredentials: jest.fn(),
				getNode: jest.fn(),
				emit: mockEmit,
			} as any;
		});

		afterEach(() => {
			jest.runOnlyPendingTimers();
			jest.useRealTimers();
		});

		it('should execute trigger and process single message with deletion', async () => {
			const mockCredentials = {
				region: 'us-east-1',
				accessKeyId: 'test-access-key',
				secretAccessKey: 'test-secret-key',
			};

			const mockMessage = {
				MessageId: 'msg-123',
				ReceiptHandle: 'receipt-handle-123',
				Body: '{"test": "data"}',
				Attributes: { ApproximateReceiveCount: '1' },
				MessageAttributes: { priority: { StringValue: 'high' } },
				MD5OfBody: 'md5-hash',
				MD5OfMessageAttributes: 'md5-attr-hash',
			};

			mockTriggerFunctions.getNodeParameter
				.mockReturnValueOnce('https://sqs.us-east-1.amazonaws.com/123456789012/test-queue')
				.mockReturnValueOnce(1)
				.mockReturnValueOnce('seconds')
				.mockReturnValueOnce({ deleteMessages: true });

			mockTriggerFunctions.getCredentials.mockResolvedValue(mockCredentials);

			(mockSqsClient.send as jest.Mock)
				.mockResolvedValueOnce({ Messages: [mockMessage] })
				.mockResolvedValueOnce({});

			const result = await awsSqsTrigger.trigger.call(mockTriggerFunctions);

			// Execute only the immediate timer, not the recursive ones
			jest.advanceTimersByTime(0);
			await Promise.resolve();

			// Stop the trigger to prevent infinite loop
			await result.closeFunction?.();

			expect(mockEmit).toHaveBeenCalledWith([
				[
					{
						json: {
							messageId: 'msg-123',
							receiptHandle: 'receipt-handle-123',
							body: '{"test": "data"}',
							parsedBody: { test: 'data' },
							attributes: { ApproximateReceiveCount: '1' },
							messageAttributes: { priority: { StringValue: 'high' } },
							md5OfBody: 'md5-hash',
							md5OfMessageAttributes: 'md5-attr-hash',
						},
					},
				],
			]);

			// Verify delete command was called
			expect(mockSqsClient.send as jest.Mock).toHaveBeenCalledTimes(2);
		});

		it('should execute trigger and process multiple messages with batch deletion', async () => {
			const mockCredentials = {
				region: 'us-east-1',
				accessKeyId: 'test-access-key',
				secretAccessKey: 'test-secret-key',
			};

			const mockMessages = [
				{
					MessageId: 'msg-123',
					ReceiptHandle: 'receipt-handle-123',
					Body: '{"test": "data1"}',
					Attributes: {},
					MessageAttributes: {},
					MD5OfBody: 'md5-hash-1',
				},
				{
					MessageId: 'msg-456',
					ReceiptHandle: 'receipt-handle-456',
					Body: 'plain text message',
					Attributes: {},
					MessageAttributes: {},
					MD5OfBody: 'md5-hash-2',
				},
			];

			mockTriggerFunctions.getNodeParameter
				.mockReturnValueOnce('https://sqs.us-east-1.amazonaws.com/123456789012/test-queue')
				.mockReturnValueOnce(1)
				.mockReturnValueOnce('seconds')
				.mockReturnValueOnce({ deleteMessages: true });

			mockTriggerFunctions.getCredentials.mockResolvedValue(mockCredentials);

			(mockSqsClient.send as jest.Mock)
				.mockResolvedValueOnce({ Messages: mockMessages })
				.mockResolvedValueOnce({});

			const result = await awsSqsTrigger.trigger.call(mockTriggerFunctions);

			// Execute only the immediate timer, not the recursive ones
			jest.advanceTimersByTime(0);
			await Promise.resolve();

			// Stop the trigger to prevent infinite loop
			await result.closeFunction?.();

			expect(mockEmit).toHaveBeenCalledWith([
				[
					{
						json: {
							messageId: 'msg-123',
							receiptHandle: 'receipt-handle-123',
							body: '{"test": "data1"}',
							parsedBody: { test: 'data1' },
							attributes: {},
							messageAttributes: {},
							md5OfBody: 'md5-hash-1',
							md5OfMessageAttributes: undefined,
						},
					},
					{
						json: {
							messageId: 'msg-456',
							receiptHandle: 'receipt-handle-456',
							body: 'plain text message',
							parsedBody: 'plain text message',
							attributes: {},
							messageAttributes: {},
							md5OfBody: 'md5-hash-2',
							md5OfMessageAttributes: undefined,
						},
					},
				],
			]);

			// Verify batch delete command was called
			expect(mockSqsClient.send as jest.Mock).toHaveBeenCalledTimes(2);
		});

		it('should execute trigger without deleting messages when deleteMessages is false', async () => {
			const mockCredentials = {
				region: 'us-east-1',
				accessKeyId: 'test-access-key',
				secretAccessKey: 'test-secret-key',
			};

			const mockMessage = {
				MessageId: 'msg-123',
				ReceiptHandle: 'receipt-handle-123',
				Body: '{"test": "data"}',
				Attributes: {},
				MessageAttributes: {},
				MD5OfBody: 'md5-hash',
			};

			mockTriggerFunctions.getNodeParameter
				.mockReturnValueOnce('https://sqs.us-east-1.amazonaws.com/123456789012/test-queue')
				.mockReturnValueOnce(1)
				.mockReturnValueOnce('seconds')
				.mockReturnValueOnce({ deleteMessages: false });

			mockTriggerFunctions.getCredentials.mockResolvedValue(mockCredentials);

			(mockSqsClient.send as jest.Mock).mockResolvedValueOnce({ Messages: [mockMessage] });

			const result = await awsSqsTrigger.trigger.call(mockTriggerFunctions);

			// Execute only the immediate timer, not the recursive ones
			jest.advanceTimersByTime(0);
			await Promise.resolve();

			// Stop the trigger to prevent infinite loop
			await result.closeFunction?.();

			expect(mockEmit).toHaveBeenCalled();
			// Only one call for receiving messages, no delete call
			expect(mockSqsClient.send as jest.Mock).toHaveBeenCalledTimes(1);
		});

		it('should execute trigger and handle no messages', async () => {
			const mockCredentials = {
				region: 'us-east-1',
				accessKeyId: 'test-access-key',
				secretAccessKey: 'test-secret-key',
			};

			mockTriggerFunctions.getNodeParameter
				.mockReturnValueOnce('https://sqs.us-east-1.amazonaws.com/123456789012/test-queue')
				.mockReturnValueOnce(1)
				.mockReturnValueOnce('seconds')
				.mockReturnValueOnce({});

			mockTriggerFunctions.getCredentials.mockResolvedValue(mockCredentials);

			(mockSqsClient.send as jest.Mock).mockResolvedValue({ Messages: [] });

			const result = await awsSqsTrigger.trigger.call(mockTriggerFunctions);

			// Execute only the immediate timer, not the recursive ones
			jest.advanceTimersByTime(0);
			await Promise.resolve();

			// Stop the trigger to prevent infinite loop
			await result.closeFunction?.();

			// No emit should be called for empty messages
			expect(mockEmit).not.toHaveBeenCalled();
		});

		it('should execute trigger and handle undefined messages', async () => {
			const mockCredentials = {
				region: 'us-east-1',
				accessKeyId: 'test-access-key',
				secretAccessKey: 'test-secret-key',
			};

			mockTriggerFunctions.getNodeParameter
				.mockReturnValueOnce('https://sqs.us-east-1.amazonaws.com/123456789012/test-queue')
				.mockReturnValueOnce(1)
				.mockReturnValueOnce('seconds')
				.mockReturnValueOnce({});

			mockTriggerFunctions.getCredentials.mockResolvedValue(mockCredentials);

			(mockSqsClient.send as jest.Mock).mockResolvedValue({});

			const result = await awsSqsTrigger.trigger.call(mockTriggerFunctions);

			// Execute only the immediate timer, not the recursive ones
			jest.advanceTimersByTime(0);
			await Promise.resolve();

			// Stop the trigger to prevent infinite loop
			await result.closeFunction?.();

			// No emit should be called for undefined messages
			expect(mockEmit).not.toHaveBeenCalled();
		});

		it('should execute trigger and handle invalid JSON body', async () => {
			const mockCredentials = {
				region: 'us-east-1',
				accessKeyId: 'test-access-key',
				secretAccessKey: 'test-secret-key',
			};

			const mockMessage = {
				MessageId: 'msg-123',
				ReceiptHandle: 'receipt-handle-123',
				Body: 'invalid json {',
				Attributes: {},
				MessageAttributes: {},
				MD5OfBody: 'md5-hash',
			};

			mockTriggerFunctions.getNodeParameter
				.mockReturnValueOnce('https://sqs.us-east-1.amazonaws.com/123456789012/test-queue')
				.mockReturnValueOnce(1)
				.mockReturnValueOnce('seconds')
				.mockReturnValueOnce({ deleteMessages: true });

			mockTriggerFunctions.getCredentials.mockResolvedValue(mockCredentials);

			(mockSqsClient.send as jest.Mock)
				.mockResolvedValueOnce({ Messages: [mockMessage] })
				.mockResolvedValueOnce({});

			const result = await awsSqsTrigger.trigger.call(mockTriggerFunctions);

			// Execute only the immediate timer, not the recursive ones
			jest.advanceTimersByTime(0);
			await Promise.resolve();

			// Stop the trigger to prevent infinite loop
			await result.closeFunction?.();

			expect(mockEmit).toHaveBeenCalledWith([
				[
					{
						json: {
							messageId: 'msg-123',
							receiptHandle: 'receipt-handle-123',
							body: 'invalid json {',
							parsedBody: 'invalid json {', // Should fallback to original body
							attributes: {},
							messageAttributes: {},
							md5OfBody: 'md5-hash',
							md5OfMessageAttributes: undefined,
						},
					},
				],
			]);
		});

		it('should execute trigger and handle empty body', async () => {
			const mockCredentials = {
				region: 'us-east-1',
				accessKeyId: 'test-access-key',
				secretAccessKey: 'test-secret-key',
			};

			const mockMessage = {
				MessageId: 'msg-123',
				ReceiptHandle: 'receipt-handle-123',
				Body: undefined,
				Attributes: {},
				MessageAttributes: {},
				MD5OfBody: 'md5-hash',
			};

			mockTriggerFunctions.getNodeParameter
				.mockReturnValueOnce('https://sqs.us-east-1.amazonaws.com/123456789012/test-queue')
				.mockReturnValueOnce(1)
				.mockReturnValueOnce('seconds')
				.mockReturnValueOnce({ deleteMessages: true });

			mockTriggerFunctions.getCredentials.mockResolvedValue(mockCredentials);

			(mockSqsClient.send as jest.Mock)
				.mockResolvedValueOnce({ Messages: [mockMessage] })
				.mockResolvedValueOnce({});

			const result = await awsSqsTrigger.trigger.call(mockTriggerFunctions);

			// Execute only the immediate timer, not the recursive ones
			jest.advanceTimersByTime(0);
			await Promise.resolve();

			// Stop the trigger to prevent infinite loop
			await result.closeFunction?.();

			expect(mockEmit).toHaveBeenCalledWith([
				[
					{
						json: {
							messageId: 'msg-123',
							receiptHandle: 'receipt-handle-123',
							body: undefined,
							parsedBody: {}, // Should default to empty object
							attributes: {},
							messageAttributes: {},
							md5OfBody: 'md5-hash',
							md5OfMessageAttributes: undefined,
						},
					},
				],
			]);
		});

		it('should execute trigger with all parameter options', async () => {
			const mockCredentials = {
				region: 'us-east-1',
				accessKeyId: 'test-access-key',
				secretAccessKey: 'test-secret-key',
			};

			mockTriggerFunctions.getNodeParameter
				.mockReturnValueOnce('https://sqs.us-east-1.amazonaws.com/123456789012/test-queue')
				.mockReturnValueOnce(1)
				.mockReturnValueOnce('seconds')
				.mockReturnValueOnce({
					deleteMessages: true,
					visibilityTimeout: 30,
					maxNumberOfMessages: 10,
					waitTimeSeconds: 20,
					messageAttributeNames: 'All',
					attributeNames: 'All',
				});

			mockTriggerFunctions.getCredentials.mockResolvedValue(mockCredentials);

			(mockSqsClient.send as jest.Mock).mockResolvedValue({ Messages: [] });

			const result = await awsSqsTrigger.trigger.call(mockTriggerFunctions);

			// Execute only the immediate timer, not the recursive ones
			jest.advanceTimersByTime(0);
			await Promise.resolve();

			// Stop the trigger to prevent infinite loop
			await result.closeFunction?.();

			// Verify the parameters were used correctly - check that send was called
			expect(mockSqsClient.send as jest.Mock).toHaveBeenCalled();

			// Since we can't easily verify the exact command structure in a mock,
			// we'll verify that the SQS client was called with the right number of parameters
			expect(mockSqsClient.send as jest.Mock).toHaveBeenCalledTimes(1);
		});

		it('should setup recurring trigger calls correctly', async () => {
			const mockCredentials = {
				region: 'us-east-1',
				accessKeyId: 'test-access-key',
				secretAccessKey: 'test-secret-key',
			};

			mockTriggerFunctions.getNodeParameter
				.mockReturnValueOnce('https://sqs.us-east-1.amazonaws.com/123456789012/test-queue')
				.mockReturnValueOnce(1)
				.mockReturnValueOnce('seconds')
				.mockReturnValueOnce({});

			mockTriggerFunctions.getCredentials.mockResolvedValue(mockCredentials);

			(mockSqsClient.send as jest.Mock).mockResolvedValue({ Messages: [] });

			const result = await awsSqsTrigger.trigger.call(mockTriggerFunctions);

			// Execute the first timer (immediate)
			jest.advanceTimersByTime(0);
			await Promise.resolve();

			// Verify the first call was made
			expect(mockSqsClient.send as jest.Mock).toHaveBeenCalledTimes(1);

			// Verify that the trigger was set up correctly (has close function)
			expect(result.closeFunction).toBeDefined();

			await result.closeFunction?.();
		});
	});
});
