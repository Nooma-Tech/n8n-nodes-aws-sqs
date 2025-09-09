import { jest } from '@jest/globals';

jest.setTimeout(10000);

global.console = {
	...console,
	warn: jest.fn(),
	error: jest.fn(),
	log: jest.fn(),
};
