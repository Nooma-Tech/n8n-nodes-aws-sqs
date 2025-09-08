# Examples - AWS SQS n8n Nodes

This document provides practical examples of using the AWS SQS n8n nodes.

## Prerequisites

1. AWS Account with SQS access
2. Create new "AWS" credential in n8n with your AWS access keys
3. SQS queue(s) created in your AWS account

## Basic Examples

### 1. Simple Message Processing

Process all messages from an SQS queue with automatic deletion:

```json
{
	"nodes": [
		{
			"parameters": {
				"queueUrl": "https://sqs.us-east-1.amazonaws.com/123456789012/my-simple-queue",
				"maxNumberOfMessages": 10,
				"autoDelete": true
			},
			"type": "awsSqsTrigger",
			"position": [200, 300],
			"name": "SQS Trigger"
		},
		{
			"parameters": {
				"jsCode": "// Process the message\nconst message = $input.item.json;\nconsole.log('Received message:', message.body);\n\nreturn {\n  processed: true,\n  messageId: message.messageId,\n  processedAt: new Date().toISOString()\n};"
			},
			"type": "n8n-nodes-base.code",
			"position": [400, 300],
			"name": "Process Message"
		}
	]
}
```

### 2. Message Processing with Manual Deletion

Process messages but keep them in the queue for manual deletion:

```json
{
	"nodes": [
		{
			"parameters": {
				"queueUrl": "https://sqs.us-east-1.amazonaws.com/123456789012/my-queue",
				"maxNumberOfMessages": 5,
				"autoDelete": false,
				"visibilityTimeout": 60
			},
			"type": "awsSqsTrigger",
			"position": [200, 300],
			"name": "SQS Trigger"
		},
		{
			"parameters": {
				"conditions": {
					"string": [
						{
							"value1": "={{$json.parsedBody.status}}",
							"value2": "success"
						}
					]
				}
			},
			"type": "n8n-nodes-base.if",
			"position": [400, 300],
			"name": "Check Status"
		}
	]
}
```

### 3. Advanced Configuration with Message Attributes

Monitor queue with custom message attributes and long polling:

```json
{
	"nodes": [
		{
			"parameters": {
				"queueUrl": "https://sqs.us-east-1.amazonaws.com/123456789012/priority-queue",
				"maxNumberOfMessages": 3,
				"visibilityTimeout": 30,
				"waitTimeSeconds": 20,
				"autoDelete": true,
				"includeMessageAttributes": true,
				"options": {
					"attributeNames": ["ApproximateReceiveCount", "SentTimestamp"],
					"messageAttributeNames": "priority,source,correlationId"
				}
			},
			"type": "awsSqsTrigger",
			"position": [200, 300],
			"name": "Priority Queue Monitor"
		},
		{
			"parameters": {
				"conditions": {
					"string": [
						{
							"value1": "={{$json.messageAttributes.priority?.StringValue}}",
							"value2": "high"
						}
					]
				}
			},
			"type": "n8n-nodes-base.if",
			"position": [400, 300],
			"name": "Filter High Priority"
		}
	]
}
```

## Advanced Use Cases

### 4. Multi-Queue Processing

Process messages from multiple queues using different trigger nodes:

```json
{
	"nodes": [
		{
			"parameters": {
				"queueUrl": "https://sqs.us-east-1.amazonaws.com/123456789012/orders-queue",
				"maxNumberOfMessages": 10,
				"autoDelete": true
			},
			"type": "awsSqsTrigger",
			"position": [200, 200],
			"name": "Orders Queue"
		},
		{
			"parameters": {
				"queueUrl": "https://sqs.us-east-1.amazonaws.com/123456789012/notifications-queue",
				"maxNumberOfMessages": 5,
				"autoDelete": true
			},
			"type": "awsSqsTrigger",
			"position": [200, 400],
			"name": "Notifications Queue"
		},
		{
			"parameters": {
				"mode": "mergeByPosition"
			},
			"type": "n8n-nodes-base.merge",
			"position": [400, 300],
			"name": "Merge Messages"
		}
	]
}
```

### 5. Error Handling and Dead Letter Queue

Process messages with error handling:

```json
{
	"nodes": [
		{
			"parameters": {
				"queueUrl": "https://sqs.us-east-1.amazonaws.com/123456789012/main-queue",
				"maxNumberOfMessages": 5,
				"autoDelete": false,
				"options": {
					"attributeNames": ["ApproximateReceiveCount"]
				}
			},
			"type": "awsSqsTrigger",
			"position": [200, 300],
			"name": "Main Queue"
		},
		{
			"parameters": {
				"conditions": {
					"number": [
						{
							"value1": "={{parseInt($json.attributes.ApproximateReceiveCount)}}",
							"operation": "largerEqual",
							"value2": 3
						}
					]
				}
			},
			"type": "n8n-nodes-base.if",
			"position": [400, 300],
			"name": "Check Retry Count"
		},
		{
			"parameters": {
				"jsCode": "// Send to dead letter queue or log error\nconsole.error('Message failed after 3 attempts:', $json.messageId);\nreturn { error: 'Max retries exceeded', messageId: $json.messageId };"
			},
			"type": "n8n-nodes-base.code",
			"position": [600, 200],
			"name": "Handle Failed Message"
		},
		{
			"parameters": {
				"jsCode": "// Process message normally\nreturn { processed: true, data: $json.parsedBody };"
			},
			"type": "n8n-nodes-base.code",
			"position": [600, 400],
			"name": "Process Message"
		}
	]
}
```

### 6. FIFO Queue Processing

Handle FIFO queue messages with message groups:

```json
{
	"nodes": [
		{
			"parameters": {
				"queueUrl": "https://sqs.us-east-1.amazonaws.com/123456789012/orders.fifo",
				"maxNumberOfMessages": 1,
				"autoDelete": true,
				"options": {
					"attributeNames": ["MessageGroupId", "MessageDeduplicationId", "SequenceNumber"]
				}
			},
			"type": "awsSqsTrigger",
			"position": [200, 300],
			"name": "FIFO Queue"
		},
		{
			"parameters": {
				"jsCode": "// Process FIFO message in order\nconst message = $json;\nconsole.log(`Processing message ${message.messageId} from group ${message.attributes.MessageGroupId}`);\n\nreturn {\n  messageGroup: message.attributes.MessageGroupId,\n  sequenceNumber: message.attributes.SequenceNumber,\n  data: message.parsedBody\n};"
			},
			"type": "n8n-nodes-base.code",
			"position": [400, 300],
			"name": "Process in Order"
		}
	]
}
```

## Configuration Tips

### Queue URL Format

- **Standard Queue**: `https://sqs.{region}.amazonaws.com/{account-id}/{queue-name}`
- **FIFO Queue**: `https://sqs.{region}.amazonaws.com/{account-id}/{queue-name}.fifo`

### Polling Configuration

- **Short Polling**: Set `waitTimeSeconds` to 0
- **Long Polling**: Set `waitTimeSeconds` to 1-20 seconds
- **Batch Processing**: Set `maxNumberOfMessages` to 2-10 for better throughput

### Message Attributes

- Use `messageAttributeNames: "All"` to receive all custom attributes
- Specify specific attributes: `"priority,source,timestamp"`
- Access in workflow: `$json.messageAttributes.attributeName.StringValue`

### Error Handling

- Set `autoDelete: false` for critical messages
- Use `visibilityTimeout` to control retry timing
- Monitor `ApproximateReceiveCount` for retry logic

## Common Patterns

### Message Filtering

```javascript
// Filter messages by content
if ($json.parsedBody.type === 'order') {
	return $json;
}
return null; // Skip this message
```

### Batch Processing

```javascript
// Collect messages for batch processing
const messages = $input.all();
return {
	batch: messages.map((msg) => msg.json.parsedBody),
	count: messages.length,
};
```

### Message Transformation

```javascript
// Transform message format
const original = $json.parsedBody;
return {
	id: original.orderId,
	customer: original.customerInfo.name,
	amount: parseFloat(original.total),
	timestamp: new Date(original.createdAt).toISOString(),
};
```
