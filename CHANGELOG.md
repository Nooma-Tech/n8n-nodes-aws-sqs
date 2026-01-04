# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.1] - 2026-01-04

### 🔒 Security

- **Dependency Updates** - Updated development dependencies to address security vulnerabilities
  - Updated `@types/node` to ^25.0.3
  - Updated `@typescript-eslint/parser` to ~8.51.0
  - Updated `eslint` to 8.57.1
  - Updated `eslint-plugin-n8n-nodes-base` to ^1.16.4
  - Updated `jest` to ^30.1.3
  - Updated `ts-jest` to ^29.4.6
  - Updated `@aws-sdk/client-sqs` to 3.962.0

### 🔧 Technical Improvements

- **n8n Compatibility Fix** - Updated `NodeConnectionType` to `NodeConnectionTypes` for compatibility with latest n8n versions

## [2.0.0] - 2024-12-19

### 🚀 Major Release - AWS SDK v3 Migration

#### ⚡ Breaking Changes

- **Migrated to AWS SDK v3** - Modern, faster, and more efficient AWS integration
- **Improved Performance** - Reduced bundle size and better tree-shaking
- **Enhanced Security** - Latest AWS SDK with security improvements

#### ✨ New Features

- **Complete AWS SDK v3 Integration** - Using `@aws-sdk/client-sqs` v3.705.0
- **Enhanced Message Processing** - Improved JSON parsing with fallback
- **Batch Delete Optimization** - Efficient handling of multiple messages
- **Advanced Configuration Options** - More granular control over SQS parameters
- **Better Error Handling** - More descriptive error messages and handling

#### 🧪 Quality Improvements

- **97.29% Test Coverage** - Comprehensive test suite with 34 test cases
- **100% Function Coverage** - All functions thoroughly tested
- **Fake Timer Testing** - Advanced testing of async trigger functionality
- **TypeScript Improvements** - Enhanced type safety and definitions
- **Lint Clean** - Zero linting errors with strict rules

#### 🔧 Technical Enhancements

- **Memory Leak Prevention** - Proper cleanup of timers and resources
- **Improved Timer Management** - Better handling of polling intervals
- **Resource Cleanup** - Automatic SQS client destruction
- **Modern JavaScript** - ES2022+ features and optimizations

#### 📚 Documentation

- **Updated Examples** - New examples reflecting AWS SDK v3 usage
- **Enhanced README** - Better documentation and usage instructions
- **Comprehensive Tests** - Tests serve as living documentation

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
