import { AwsSqsTrigger } from '../../nodes/Aws/SQS/AwsSqsTrigger.node';
import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';

jest.mock('@aws-sdk/client-sqs');

const mockSQSClient = SQSClient as jest.MockedClass<typeof SQSClient>;
const mockReceiveMessageCommand = ReceiveMessageCommand as jest.MockedClass<
	typeof ReceiveMessageCommand
>;
const mockDeleteMessageCommand = DeleteMessageCommand as jest.MockedClass<
	typeof DeleteMessageCommand
>;

describe('AwsSqsTrigger', () => {
	let node: AwsSqsTrigger;
	let mockSend: jest.Mock;

	beforeEach(() => {
		node = new AwsSqsTrigger();
		mockSend = jest.fn();
		mockSQSClient.mockImplementation(
			() =>
				({
					send: mockSend,
				}) as any,
		);
		jest.clearAllMocks();
	});

	describe('Node Structure', () => {
		it('should be instantiable', () => {
			expect(node).toBeInstanceOf(AwsSqsTrigger);
		});

		it('should have correct basic properties', () => {
			expect(node.description.displayName).toBe('AWS SQS Trigger');
			expect(node.description.name).toBe('awsSqsTrigger');
			expect(node.description.group).toEqual(['trigger']);
			expect(node.description.version).toBe(1);
		});

		it('should be a polling trigger node', () => {
			expect(node.description.inputs).toEqual([]);
			expect(node.description.outputs).toEqual(['main']);
			expect(node.description.polling).toBe(true);
		});

		it('should have poll method', () => {
			expect(typeof node.poll).toBe('function');
		});

		it('should require AWS credentials', () => {
			expect(node.description.credentials).toBeDefined();
			expect(node.description.credentials).toHaveLength(1);
			expect(node.description.credentials![0].name).toBe('aws');
			expect(node.description.credentials![0].required).toBe(true);
		});
	});

	describe('poll method', () => {
		const mockPollFunctions = {
			getNodeParameter: jest.fn(),
			getCredentials: jest.fn(),
			getNode: jest.fn().mockReturnValue({ name: 'AWS SQS Trigger' }),
		};

		beforeEach(() => {
			mockPollFunctions.getNodeParameter
				.mockReturnValueOnce('https://sqs.us-east-1.amazonaws.com/123456789012/test-queue')
				.mockReturnValueOnce(10)
				.mockReturnValueOnce(20)
				.mockReturnValueOnce(0)
				.mockReturnValueOnce(true)
				.mockReturnValueOnce(true)
				.mockReturnValueOnce({});

			mockPollFunctions.getCredentials.mockResolvedValue({
				region: 'us-east-1',
				accessKeyId: 'test-access-key',
				secretAccessKey: 'test-secret-key',
			});
		});

		it('should return empty array when no messages are received', async () => {
			mockSend.mockResolvedValue({ Messages: [] });

			const result = await node.poll.call(mockPollFunctions as any);

			expect(result).toEqual([]);
		});

		it('should process messages correctly', async () => {
			const mockMessages = [
				{
					MessageId: 'msg-1',
					Body: '{"test": "data"}',
					ReceiptHandle: 'receipt-1',
					MD5OfBody: 'hash1',
					Attributes: { SenderId: 'sender1' },
					MessageAttributes: { attr1: { StringValue: 'value1' } },
				},
			];

			mockSend.mockResolvedValue({ Messages: mockMessages });

			const result = await node.poll.call(mockPollFunctions as any);

			expect(result).toHaveLength(1);
			expect(result[0]).toHaveLength(1);
			expect(result[0][0].json).toMatchObject({
				messageId: 'msg-1',
				body: '{"test": "data"}',
				receiptHandle: 'receipt-1',
				md5OfBody: 'hash1',
				attributes: { SenderId: 'sender1' },
				messageAttributes: { attr1: { StringValue: 'value1' } },
				parsedBody: { test: 'data' },
			});
		});

		it('should handle messages with invalid JSON body', async () => {
			const mockMessages = [
				{
					MessageId: 'msg-1',
					Body: 'invalid json',
					ReceiptHandle: 'receipt-1',
				},
			];

			mockSend.mockResolvedValue({ Messages: mockMessages });

			const result = await node.poll.call(mockPollFunctions as any);

			expect(result[0][0].json.parsedBody).toBeNull();
		});

		it('should delete messages when autoDelete is enabled', async () => {
			const mockMessages = [
				{
					MessageId: 'msg-1',
					Body: 'test',
					ReceiptHandle: 'receipt-1',
				},
			];

			mockSend.mockResolvedValueOnce({ Messages: mockMessages }).mockResolvedValueOnce({});

			await node.poll.call(mockPollFunctions as any);

			expect(mockSend).toHaveBeenCalledTimes(2);
			expect(mockDeleteMessageCommand).toHaveBeenCalledWith({
				QueueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/test-queue',
				ReceiptHandle: 'receipt-1',
			});
		});

		it('should not delete messages when autoDelete is disabled', async () => {
			mockPollFunctions.getNodeParameter
				.mockReset()
				.mockReturnValueOnce('https://sqs.us-east-1.amazonaws.com/123456789012/test-queue')
				.mockReturnValueOnce(10)
				.mockReturnValueOnce(20)
				.mockReturnValueOnce(0)
				.mockReturnValueOnce(false)
				.mockReturnValueOnce(true)
				.mockReturnValueOnce({});

			const mockMessages = [
				{
					MessageId: 'msg-1',
					Body: 'test',
					ReceiptHandle: 'receipt-1',
				},
			];

			mockSend.mockResolvedValue({ Messages: mockMessages });

			await node.poll.call(mockPollFunctions as any);

			expect(mockSend).toHaveBeenCalledTimes(1);
			expect(mockDeleteMessageCommand).not.toHaveBeenCalled();
		});

		it('should handle SQS client errors', async () => {
			mockSend.mockRejectedValue(new Error('SQS Error'));

			await expect(node.poll.call(mockPollFunctions as any)).rejects.toThrow(
				'Failed to receive messages from SQS queue: SQS Error',
			);
		});

		it('should configure SQS client with session token when provided', async () => {
			mockPollFunctions.getCredentials.mockResolvedValue({
				region: 'us-east-1',
				accessKeyId: 'test-access-key',
				secretAccessKey: 'test-secret-key',
				sessionToken: 'test-session-token',
			});

			mockSend.mockResolvedValue({ Messages: [] });

			await node.poll.call(mockPollFunctions as any);

			expect(mockSQSClient).toHaveBeenCalledWith({
				region: 'us-east-1',
				credentials: {
					accessKeyId: 'test-access-key',
					secretAccessKey: 'test-secret-key',
					sessionToken: 'test-session-token',
				},
			});
		});

		it('should include message attributes when enabled', async () => {
			mockPollFunctions.getNodeParameter
				.mockReset()
				.mockReturnValueOnce('https://sqs.us-east-1.amazonaws.com/123456789012/test-queue')
				.mockReturnValueOnce(10)
				.mockReturnValueOnce(20)
				.mockReturnValueOnce(0)
				.mockReturnValueOnce(true)
				.mockReturnValueOnce(true)
				.mockReturnValueOnce({ messageAttributeNames: 'attr1,attr2' });

			mockSend.mockResolvedValue({ Messages: [] });

			await node.poll.call(mockPollFunctions as any);

			expect(mockReceiveMessageCommand).toHaveBeenCalledWith({
				QueueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/test-queue',
				MaxNumberOfMessages: 10,
				VisibilityTimeout: 20,
				WaitTimeSeconds: 0,
				MessageAttributeNames: ['attr1', 'attr2'],
			});
		});

		it('should handle delete message errors gracefully', async () => {
			const mockMessages = [
				{
					MessageId: 'msg-1',
					Body: 'test',
					ReceiptHandle: 'receipt-1',
				},
			];

			const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

			mockSend
				.mockResolvedValueOnce({ Messages: mockMessages })
				.mockRejectedValueOnce(new Error('Delete failed'));

			const result = await node.poll.call(mockPollFunctions as any);

			expect(result).toHaveLength(1);
			expect(consoleSpy).toHaveBeenCalledWith('Failed to delete message msg-1:', expect.any(Error));

			consoleSpy.mockRestore();
		});

		it('should include attribute names when specified in options', async () => {
			mockPollFunctions.getNodeParameter
				.mockReset()
				.mockReturnValueOnce('https://sqs.us-east-1.amazonaws.com/123456789012/test-queue')
				.mockReturnValueOnce(10)
				.mockReturnValueOnce(20)
				.mockReturnValueOnce(0)
				.mockReturnValueOnce(true)
				.mockReturnValueOnce(true)
				.mockReturnValueOnce({ attributeNames: ['ApproximateReceiveCount', 'SentTimestamp'] });

			mockSend.mockResolvedValue({ Messages: [] });

			await node.poll.call(mockPollFunctions as any);

			expect(mockReceiveMessageCommand).toHaveBeenCalledWith({
				QueueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/test-queue',
				MaxNumberOfMessages: 10,
				VisibilityTimeout: 20,
				WaitTimeSeconds: 0,
				AttributeNames: ['ApproximateReceiveCount', 'SentTimestamp'],
				MessageAttributeNames: ['All'],
			});
		});
	});
});
