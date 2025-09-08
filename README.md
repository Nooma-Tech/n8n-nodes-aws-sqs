# n8n-nodes-aws-sqs

This is an n8n community node. It lets you use AWS SQS in your n8n workflows.

AWS SQS (Simple Queue Service) is a fully managed message queuing service that enables you to decouple and scale microservices, distributed systems, and serverless applications.

## Table of Contents

- [Installation](#installation)
- [Operations](#operations)
- [Credentials](#credentials)
- [Usage](#usage)
- [Examples](#examples)
- [Resources](#resources)
- [Version History](#version-history)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

### Community Nodes (Recommended)

Install directly from n8n:

1. Go to **Settings** > **Community Nodes**
2. Select **Install** and enter `@nooma-tech/n8n-nodes-aws-sqs`

### Manual Installation

```bash
npm install @nooma-tech/n8n-nodes-aws-sqs
```

The package is published to the public npm registry for easy installation.

## Operations

This package provides 1 node for AWS SQS integration:

### Trigger Nodes

**AWS SQS Trigger**

- Monitor SQS queues for new messages using polling
- Automatically process and optionally delete messages
- Support for message attributes and queue attributes

## Credentials

You need to authenticate with AWS using standard AWS credentials. Prerequisites and setup:

### Prerequisites

1. AWS Account with SQS access
2. IAM user with appropriate SQS permissions

### Credential Setup

1. In n8n, create new credentials of type "AWS"
2. Fill in the required fields:
   - **Region**: Your AWS region (e.g., us-east-1)
   - **Access Key ID**: Your AWS access key
   - **Secret Access Key**: Your AWS secret key
   - **Session Token** (optional): For temporary credentials

### Required IAM Permissions

```json
{
	"Version": "2012-10-17",
	"Statement": [
		{
			"Effect": "Allow",
			"Action": ["sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes"],
			"Resource": "arn:aws:sqs:*:*:*"
		}
	]
}
```

## Usage

### AWS SQS Trigger

The trigger node polls SQS queues at regular intervals and processes new messages.

**Configuration:**

- **Queue URL**: Full SQS queue URL
- **Max Messages**: Number of messages to receive per poll (1-10)
- **Visibility Timeout**: Duration messages are hidden from other consumers
- **Wait Time**: Long polling wait time
- **Auto Delete**: Whether to automatically delete processed messages

**Output:**
Each message becomes a separate workflow execution with:

- `messageId`: Unique message identifier
- `body`: Message body (string)
- `parsedBody`: Parsed JSON body (if valid JSON)
- `receiptHandle`: Handle for message deletion
- `attributes`: Message attributes
- `messageAttributes`: Custom message attributes

## Examples

### Basic Message Processing

```json
{
	"nodes": [
		{
			"parameters": {
				"queueUrl": "https://sqs.us-east-1.amazonaws.com/123456789012/my-queue",
				"maxNumberOfMessages": 10,
				"autoDelete": true
			},
			"type": "awsSqsTrigger",
			"position": [200, 300]
		}
	]
}
```

### Advanced Configuration with Message Attributes

```json
{
	"nodes": [
		{
			"parameters": {
				"queueUrl": "https://sqs.us-east-1.amazonaws.com/123456789012/my-queue",
				"maxNumberOfMessages": 5,
				"visibilityTimeout": 30,
				"waitTimeSeconds": 10,
				"autoDelete": false,
				"includeMessageAttributes": true,
				"options": {
					"attributeNames": ["All"],
					"messageAttributeNames": "priority,source,timestamp"
				}
			},
			"type": "awsSqsTrigger",
			"position": [200, 300]
		}
	]
}
```

## Resources

- [AWS SQS Documentation](https://docs.aws.amazon.com/sqs/)
- [n8n Documentation](https://docs.n8n.io/)
- [AWS SDK for JavaScript v3](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/)

## Version History

### 1.0.0 (2024-12-19)

#### Features

- **AWS SQS Trigger** - Polling trigger for SQS queues with message processing
- **Message Processing** - Automatic JSON parsing and attribute handling
- **Auto Delete** - Optional automatic message deletion after processing
- **Configurable Polling** - Adjustable polling parameters and timeouts
- **Error Handling** - Robust error handling and logging

#### Technical Details

- Built with AWS SDK v3 for optimal performance
- TypeScript implementation with full type safety
- Comprehensive test coverage
- Follows n8n best practices and conventions

#### Developer Experience

- Professional AWS SQS branding and icons
- Detailed parameter descriptions and validation
- Example workflows and documentation
- Linting and formatting standards

#### Supported Features

- Supports all AWS regions
- Compatible with FIFO and standard queues
- Message attributes and queue attributes
- Long polling and short polling
- Temporary credentials support
