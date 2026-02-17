# Testing ApiCollectorClient with Bun Test - Complete Guide
Written by Claude

## Overview

Bun's built-in test runner provides fast, TypeScript-native testing. This guide covers testing an abstract base class like `ApiCollectorClient` using Bun's test framework.

## Setup

### Installation
```bash
# Bun comes with a built-in test runner - no extra dependencies needed!
bun add -d @types/bun

# Optional: For axios mocking helpers
bun add -d axios-mock-adapter
```

### Configuration

Create `bunfig.toml` (optional):
```toml
[test]
# Run tests in parallel
preload = ["./test-setup.ts"]
coverage = true
```

## Test Structure

```
api/
├── __tests__/
│   ├── apiCollectorClient.test.ts           # Unit tests
│   ├── apiCollectorClient.integration.test.ts # Integration tests
│   └── fixtures/
│       ├── mockResponses.ts                  # Shared test data
│       └── testClients.ts                    # Reusable test implementations
├── apiCollectorClient.ts
└── index.ts
```

## Key Differences from Vitest/Jest

### 1. Import from `bun:test`
```typescript
// Bun test
import { describe, it, expect, beforeEach, mock } from 'bun:test';

// NOT from vitest
// ❌ import { describe, it, expect, vi } from 'vitest';
```

### 2. Mock Functions
```typescript
// Bun uses mock() instead of vi.fn()
const mockFn = mock(() => 'value');

// Check calls
expect(mockFn).toHaveBeenCalled();
expect(mockFn.mock.calls.length).toBe(1);
expect(mockFn.mock.calls[0]).toEqual([arg1, arg2]);

// Clear mock
mockFn.mockClear();

// Reset implementation
mockFn.mockImplementation(() => 'new value');
```

### 3. Module Mocking

Bun handles module mocking differently:

```typescript
// ❌ Doesn't work in Bun
vi.mock('axios');

// ✅ Manual mocking
import axios from 'axios';
axios.create = mock(() => mockAxiosInstance);
```

### 4. Async Test Expectations

```typescript
// Bun uses synchronous expect with async
expect(async () => {
  await client.testRequest('GET', 'fail');
}).toThrow('Error');

// NOT await expect().rejects.toThrow()
```

## Testing Strategies for Bun

### 1. Testing Abstract Classes

Create concrete implementations:

```typescript
class TestApiClient extends ApiCollectorClient {
  async getAllData() {
    return { test: 'data' };
  }
  
  // Expose protected methods
  public async testRequest(method: string, endpoint: string, opts?: any) {
    return this.request(method as any, endpoint, opts);
  }
}
```

### 2. Mocking Axios

**Approach A: Direct Mock (Recommended for Bun)**
```typescript
import { mock } from 'bun:test';
import axios from 'axios';

const mockAxiosInstance = {
  request: mock(() => Promise.resolve({ status: 200, data: {} })),
  interceptors: {
    request: { use: mock((fn: any) => fn) },
    response: { use: mock(() => {}) }
  }
};

// Mock axios.create
axios.create = mock(() => mockAxiosInstance);
```

**Approach B: Using axios-mock-adapter**
```typescript
import MockAdapter from 'axios-mock-adapter';

const axiosMock = new MockAdapter(axios);
axiosMock.onGet('/users').reply(200, { users: [] });
```

### 3. Sequential Mock Responses

Bun doesn't have `mockResolvedValueOnce()`, use a counter:

```typescript
let callCount = 0;
mockAxiosInstance.request.mockImplementation(() => {
  callCount++;
  if (callCount === 1) {
    return Promise.resolve({ status: 200, data: [{ name: 'node1' }] });
  }
  return Promise.resolve({ status: 200, data: { cpu: 0.5 } });
});
```

### 4. Accessing Mock Call Data

```typescript
// Get number of calls
mockFn.mock.calls.length

// Get specific call arguments
mockFn.mock.calls[0] // First call
mockFn.mock.calls.at(-1) // Last call

// Get call arguments
const [arg1, arg2] = mockFn.mock.calls[0];
```

## Test Patterns

### Basic Test Structure
```typescript
import { describe, it, expect, beforeEach } from 'bun:test';

describe('Feature', () => {
  beforeEach(() => {
    // Setup before each test
  });

  it('should do something', () => {
    // Arrange
    const input = 'test';
    
    // Act
    const result = someFunction(input);
    
    // Assert
    expect(result).toBe('expected');
  });
});
```

### Async Testing
```typescript
it('should handle async operations', async () => {
  const result = await asyncFunction();
  expect(result).toBeDefined();
});
```

### Error Testing
```typescript
it('should throw on invalid input', () => {
  expect(() => {
    throwingFunction();
  }).toThrow('Error message');
});

it('should throw async errors', () => {
  expect(async () => {
    await asyncThrowingFunction();
  }).toThrow('Error message');
});
```

### Snapshot Testing
```typescript
it('should match snapshot', () => {
  const data = { complex: 'object' };
  expect(data).toMatchSnapshot();
});
```

## Running Tests

### Basic Commands
```bash
# Run all tests
bun test

# Run specific file
bun test apiCollectorClient.test.ts

# Run with coverage
bun test --coverage

# Watch mode
bun test --watch

# Bail on first failure
bun test --bail

# Run tests matching pattern
bun test --test-name-pattern="should handle"
```

### Coverage Reports
```bash
# Generate coverage
bun test --coverage

# Coverage with specific threshold
bun test --coverage --coverage-threshold=80
```

### Debugging Tests
```bash
# Verbose output
bun test --verbose

# Show console.log output
bun test --preload ./test-setup.ts
```

## Best Practices for Bun

### 1. Use Type-Safe Mocks
```typescript
// Define mock with proper typing
const mockRequest = mock<(...args: any[]) => Promise<any>>(() => 
  Promise.resolve({ status: 200, data: {} })
);
```

### 2. Clear Mocks Between Tests
```typescript
beforeEach(() => {
  mockFn.mockClear(); // Clear call history
  // Reset to default implementation if needed
  mockFn.mockImplementation(() => defaultValue);
});
```

### 3. Organize Test Data
```typescript
// __tests__/fixtures/mockResponses.ts
export const mockUserResponse = {
  status: 200,
  data: { id: 1, name: 'John' }
};

// Use in tests
import { mockUserResponse } from './fixtures/mockResponses';
mockAxiosInstance.request.mockImplementation(() => 
  Promise.resolve(mockUserResponse)
);
```

### 4. Test Isolation
```typescript
describe('Feature', () => {
  let client: TestApiClient;
  
  beforeEach(() => {
    // Fresh instance per test
    client = new TestApiClient('https://api.test');
  });
  
  it('test 1', async () => {
    // This test won't affect test 2
  });
  
  it('test 2', async () => {
    // Clean state
  });
});
```

## Common Patterns

### Testing Sequential API Calls
```typescript
it('should make multiple API calls', async () => {
  const responses = [
    { status: 200, data: { step: 1 } },
    { status: 200, data: { step: 2 } }
  ];
  
  let callCount = 0;
  mockAxiosInstance.request.mockImplementation(() => {
    return Promise.resolve(responses[callCount++]);
  });
  
  await client.getAllData();
  
  expect(mockAxiosInstance.request.mock.calls.length).toBe(2);
});
```

### Testing Error Handling
```typescript
it('should handle network errors', () => {
  mockAxiosInstance.request.mockImplementation(() => 
    Promise.reject(new Error('Network error'))
  );
  
  expect(async () => {
    await client.testRequest('GET', 'test');
  }).toThrow('Network error');
});
```

### Testing with Zod Schemas
```typescript
it('should validate with Zod', async () => {
  const schema = z.object({ id: z.number() });
  
  mockAxiosInstance.request.mockImplementation(() =>
    Promise.resolve({ status: 200, data: { id: 1 } })
  );
  
  const result = await client.testRequestAndParse('GET', 'test', schema);
  expect(result.id).toBe(1);
});
```

## Performance Testing

Bun is fast! Use this to your advantage:

```typescript
it('should handle 1000 requests quickly', async () => {
  mockAxiosInstance.request.mockImplementation(() =>
    Promise.resolve({ status: 200, data: {} })
  );
  
  const start = performance.now();
  
  const requests = Array(1000).fill(null).map(() => 
    client.testRequest('GET', 'test')
  );
  
  await Promise.all(requests);
  
  const duration = performance.now() - start;
  expect(duration).toBeLessThan(1000); // Should be fast!
});
```

## CI/CD Integration

### GitHub Actions
```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest
      - run: bun install
      - run: bun test --coverage
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

### GitLab CI
```yaml
test:
  image: oven/bun:latest
  script:
    - bun install
    - bun test --coverage
  coverage: '/Lines\s*:\s*(\d+\.\d+)%/'
  artifacts:
    reports:
      coverage_report:
        coverage_format: cobertura
        path: coverage/cobertura-coverage.xml
```

## Troubleshooting

### Mock Not Being Called
```typescript
// Check if axios.create was actually mocked
console.log('Mock calls:', (axios.create as any).mock.calls.length);

// Verify the mock is set up before creating client
expect(axios.create).toBeDefined();
const client = new TestApiClient('https://api.test');
```

### Type Errors with Mocks
```typescript
// Use type assertion
(axios.create as any).mockImplementation(() => mockAxiosInstance);

// Or define proper types
const mockCreate = mock<typeof axios.create>(() => mockAxiosInstance);
axios.create = mockCreate;
```

### Tests Hanging
```typescript
// Ensure all promises resolve
mockAxiosInstance.request.mockImplementation(() => 
  Promise.resolve({ status: 200, data: {} }) // Must return Promise
);
```

## Migration from Vitest/Jest

### Quick Reference
```typescript
// Vitest/Jest → Bun
vi.fn()           → mock()
vi.clearAllMocks() → mockFn.mockClear()
.mockResolvedValue() → .mockImplementation(() => Promise.resolve())
.mockResolvedValueOnce() → Use counter pattern
vi.mock('module') → Manual mock assignment
expect().rejects.toThrow() → expect(async () => {}).toThrow()
```

## Coverage Goals

- **Statements**: 90%+
- **Branches**: 85%+
- **Functions**: 90%+
- **Lines**: 90%+

Generate report:
```bash
bun test --coverage --coverage-reporter=html
open coverage/index.html
```

## Advanced Patterns

### Parameterized Tests
```typescript
const testCases = [
  { method: 'GET', endpoint: 'users' },
  { method: 'POST', endpoint: 'users' },
  { method: 'PUT', endpoint: 'users/1' }
];

for (const { method, endpoint } of testCases) {
  it(`should handle ${method} ${endpoint}`, async () => {
    mockAxiosInstance.request.mockImplementation(() => 
      Promise.resolve({ status: 200, data: {} })
    );
    
    await client.testRequest(method, endpoint);
    expect(mockAxiosInstance.request).toHaveBeenCalled();
  });
}
```

### Custom Matchers
```typescript
// test-setup.ts
expect.extend({
  toBeValidUser(received) {
    const pass = 
      typeof received.id === 'number' &&
      typeof received.name === 'string';
    
    return {
      pass,
      message: () => `Expected ${received} to be a valid user`
    };
  }
});

// In tests
expect(user).toBeValidUser();
```

## Resources

- [Bun Test Documentation](https://bun.sh/docs/cli/test)
- [Bun Test API Reference](https://bun.sh/docs/test/writing)
- [Bun Test Mocking Guide](https://bun.sh/docs/test/mocks)

## Quick Start Checklist

- [ ] Install Bun: `curl -fsSL https://bun.sh/install | bash`
- [ ] Create test files: `*.test.ts` or `*.spec.ts`
- [ ] Import from `bun:test`
- [ ] Use `mock()` for function mocking
- [ ] Run tests: `bun test`
- [ ] Check coverage: `bun test --coverage`
- [ ] Set up CI/CD with Bun

Happy testing! 🧪
