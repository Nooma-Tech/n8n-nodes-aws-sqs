# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-12-19

### Added

#### Core Features

- **AWS SQS Trigger** - Polling trigger node for monitoring SQS queues
- **Message Processing** - Automatic JSON parsing and message handling
- **Auto Delete** - Optional automatic message deletion after processing
- **Message Attributes** - Support for custom message attributes and queue attributes
- **Configurable Polling** - Adjustable polling parameters including:
  - Max messages per poll (1-10)
  - Visibility timeout (0-43200 seconds)
  - Wait time for long polling (0-20 seconds)

#### Technical Implementation

- **AWS SDK v3** - Built with the latest AWS SDK for JavaScript v3
- **TypeScript** - Full TypeScript implementation with type safety
- **Error Handling** - Robust error handling and logging
- **Polling Architecture** - Efficient polling mechanism with configurable intervals

#### Developer Experience

- **Comprehensive Tests** - Full test coverage with 14 test cases
- **Professional Icons** - AWS SQS branding and visual identity
- **Parameter Validation** - Input validation and helpful descriptions
- **Documentation** - Complete documentation with examples

#### Supported AWS Features

- **All AWS Regions** - Support for all AWS regions
- **Queue Types** - Compatible with both FIFO and standard queues
- **Authentication** - Standard AWS credentials with optional session tokens
- **Message Attributes** - Full support for message and queue attributes
- **Long Polling** - Configurable long polling for efficient message retrieval

### Technical Details

#### Dependencies

- `@aws-sdk/client-sqs: ^3.705.0` - AWS SDK v3 SQS client
- Node.js >= 20 - Modern Node.js runtime support

#### Architecture

- Polling trigger implementation using n8n's IPollFunctions
- Clean separation of concerns with proper error boundaries
- Efficient message processing with batch support
- Optional automatic cleanup with message deletion

#### Code Quality

- ESLint configuration following n8n standards
- Prettier formatting for consistent code style
- Jest testing framework with comprehensive coverage
- TypeScript strict mode for type safety

### Security

#### IAM Permissions

Required minimum IAM permissions:

- `sqs:ReceiveMessage` - Read messages from queues
- `sqs:DeleteMessage` - Delete processed messages (if auto-delete enabled)
- `sqs:GetQueueAttributes` - Retrieve queue attributes

#### Credential Handling

- Secure credential storage using n8n's credential system
- Support for temporary credentials with session tokens
- No credential exposure in logs or error messages
