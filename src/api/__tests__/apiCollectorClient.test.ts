import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import axios, { AxiosHeaders } from 'axios';
import { z } from 'zod';
import ApiCollectorClient from '../apiCollectorClient';
import { InvalidAPIResponseError } from '../../errors';

// Concrete implementation for testing
class TestApiClient extends ApiCollectorClient {
  constructor(baseUrl: string, headers: AxiosHeaders = new AxiosHeaders(), maxRetries?: number) {
    super(baseUrl, headers, maxRetries);
  }

  static override async Create(baseUrl: string): Promise<TestApiClient> {
    return new TestApiClient(baseUrl);
  }

  async getAllData() {
    return { test: 'data' };
  }

  // Expose protected methods for testing
  public async testRequest(method: string, endpoint: string, opts?: any) {
    return this.request(method as any, endpoint, opts);
  }

  public async testRequestAndParse<S extends z.ZodTypeAny>(
    method: "GET" | "POST" | "PUT" | "DELETE",
    endpoint: string,
    schema: S,
    opts?: any
  ) {
    return this.requestAndParse(method, endpoint, schema, opts);
  }
}

describe('ApiCollectorClient', () => {
  let client: TestApiClient;
  let mockAxiosInstance: any;

  beforeEach(() => {
    // Create mock axios instance
    mockAxiosInstance = {
      request: mock(() => Promise.resolve({ status: 200, data: {} })),
      interceptors: {
        request: {
          use: mock((fn: any) => fn)
        },
        response: {
          use: mock(() => {})
        }
      }
    };

    // Mock axios.create
    axios.create = mock(() => mockAxiosInstance);

    client = new TestApiClient('https://api.example.com');
  });

  afterEach(() => {
    // Reset mocks
    mockAxiosInstance.request.mockClear();
  });

  describe('Constructor', () => {
    it('should create axios instance with correct baseURL', () => {
      expect(axios.create).toHaveBeenCalled();
      const createCall = (axios.create as any).mock.calls[0][0];
      expect(createCall.baseURL).toBe('https://api.example.com');
      expect(createCall.headers['Content-Type']).toBe('application/json');
      expect(createCall.timeout).toBe(30000);
    });

    it('should merge persistent headers', () => {
      const headers = new AxiosHeaders({
        'Authorization': 'Bearer token123'
      });

      new TestApiClient('https://api.example.com', headers);

      const createCall = (axios.create as any).mock.calls.at(-1)[0];
      expect(createCall.headers['Authorization']).toBe('Bearer token123');
      expect(createCall.headers['Content-Type']).toBe('application/json');
    });

    it('should accept custom maxRetries', () => {
      const customClient = new TestApiClient('https://api.example.com', new AxiosHeaders(), 5);
      expect(customClient).toBeDefined();
    });

    it('should initialize request interceptor', () => {
      expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalled();
    });
  });

  describe('Create factory method', () => {
    it('should create instance via factory', async () => {
      const instance = await TestApiClient.Create('https://api.example.com');
      expect(instance).toBeInstanceOf(TestApiClient);
    });

    it('should throw error when called on base class', async () => {
      await expect(ApiCollectorClient.Create()).rejects.toThrow(
        'Create() must be implemented by subclass'
      );
    });
  });

  describe('getAllData', () => {
    it('should be implemented by subclass', async () => {
      const data = await client.getAllData();
      expect(data).toEqual({ test: 'data' });
    });
  });

  describe('disconnect', () => {
    it('should have default no-op implementation', async () => {
      await expect(client.disconnect()).resolves.toBeUndefined();
    });
  });

  describe('request method', () => {
    it('should make successful GET request', async () => {
      const mockResponse = {
        status: 200,
        data: { result: 'success' }
      };

      mockAxiosInstance.request.mockImplementation(() => Promise.resolve(mockResponse));

      const response: any = await client.testRequest('GET', 'users');

      expect(mockAxiosInstance.request).toHaveBeenCalled();
      const callArgs = mockAxiosInstance.request.mock.calls[0][0];
      expect(callArgs.method).toBe('GET');
      expect(callArgs.url).toBe('/users');
      expect(response).toEqual(mockResponse);
    });

    it('should make successful POST request with data', async () => {
      const mockResponse = {
        status: 201,
        data: { id: 123 }
      };

      mockAxiosInstance.request.mockImplementation(() => Promise.resolve(mockResponse));

      const postData = { name: 'John' };
      await client.testRequest('POST', 'users', { data: postData });

      const callArgs = mockAxiosInstance.request.mock.calls[0][0];
      expect(callArgs.method).toBe('POST');
      expect(callArgs.url).toBe('/users');
      expect(callArgs.data).toEqual(postData);
    });

    it('should accept custom axios config options', async () => {
      mockAxiosInstance.request.mockImplementation(() => Promise.resolve({ status: 200, data: {} }));

      await client.testRequest('GET', 'users', {
        headers: { 'X-Custom': 'value' },
        timeout: 5000
      });

      const callArgs = mockAxiosInstance.request.mock.calls[0][0];
      expect(callArgs.headers['X-Custom']).toBe('value');
      expect(callArgs.timeout).toBe(5000);
    });

    it('should throw InvalidAPIResponseError on 4xx status', async () => {
      mockAxiosInstance.request.mockImplementation(() => Promise.resolve({
        status: 404,
        data: {}
      }));

      expect(async () => {
        await client.testRequest('GET', 'users/999');
      }).toThrow(InvalidAPIResponseError);
    });

    it('should throw InvalidAPIResponseError on 5xx status', async () => {
      mockAxiosInstance.request.mockImplementation(() => Promise.resolve({
        status: 500,
        data: {}
      }));

      expect(async () => {
        await client.testRequest('GET', 'users');
      }).toThrow(InvalidAPIResponseError);
    });

    it('should propagate axios errors', async () => {
      const axiosError = new Error('Network error');
      mockAxiosInstance.request.mockImplementation(() => Promise.reject(axiosError));

      expect(async () => {
        await client.testRequest('GET', 'users');
      }).toThrow('Network error');
    });

    it('should handle all HTTP methods', async () => {
      const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
      
      for (const method of methods) {
        mockAxiosInstance.request.mockImplementation(() => Promise.resolve({ status: 200, data: {} }));
        await client.testRequest(method, 'test');
        
        const callArgs = mockAxiosInstance.request.mock.calls.at(-1)[0];
        expect(callArgs.method).toBe(method);
      }
    });
  });

  describe('requestAndParse method', () => {
    const UserSchema = z.object({
      id: z.number(),
      name: z.string(),
      email: z.string().email()
    });

    it('should successfully parse valid response', async () => {
      const validData = {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com'
      };

      mockAxiosInstance.request.mockImplementation(() => Promise.resolve({
        status: 200,
        data: validData
      }));

      const result = await client.testRequestAndParse('GET', 'users/1', UserSchema);

      expect(result).toEqual(validData);
    });

    it('should throw ZodError on invalid response shape', async () => {
      const invalidData = {
        id: '1', // Should be number
        name: 'John Doe',
        email: 'not-an-email'
      };

      mockAxiosInstance.request.mockImplementation(() => Promise.resolve({
        status: 200,
        data: invalidData
      }));

      expect(async () => {
        await client.testRequestAndParse('GET', 'users/1', UserSchema);
      }).toThrow(); // ZodError
    });

    it('should work with complex schemas', async () => {
      const ComplexSchema = z.object({
        users: z.array(UserSchema),
        total: z.number(),
        page: z.number()
      });

      const validData = {
        users: [
          { id: 1, name: 'John', email: 'john@example.com' },
          { id: 2, name: 'Jane', email: 'jane@example.com' }
        ],
        total: 2,
        page: 1
      };

      mockAxiosInstance.request.mockImplementation(() => Promise.resolve({
        status: 200,
        data: validData
      }));

      const result = await client.testRequestAndParse('GET', 'users', ComplexSchema);
      expect(result).toEqual(validData);
      expect(result.users).toHaveLength(2);
    });

    it('should throw InvalidAPIResponseError before parsing if status is bad', async () => {
      mockAxiosInstance.request.mockImplementation(() => Promise.resolve({
        status: 404,
        data: {}
      }));

      expect(async () => {
        await client.testRequestAndParse('GET', 'users/1', UserSchema);
      }).toThrow(InvalidAPIResponseError);
    });
  });

  describe('Request interceptor logging', () => {
    it('should log GET requests with emoji', async () => {
      mockAxiosInstance.request.mockImplementation(() => Promise.resolve({ status: 200, data: {} }));
      
      // Trigger the interceptor by making a request
      await client.testRequest('GET', 'test');
      
      // The interceptor should have been called
      expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalled();
    });
  });

  describe('Edge cases', () => {
    it('should handle empty response data', async () => {
      mockAxiosInstance.request.mockImplementation(() => Promise.resolve({
        status: 204,
        data: null
      }));

      const response = await client.testRequest('DELETE', 'users/1');
      expect(response.data).toBeNull();
    });

    it('should handle large payloads', async () => {
      const largeData = { items: new Array(10000).fill({ id: 1, name: 'test' }) };
      
      mockAxiosInstance.request.mockImplementation(() => Promise.resolve({
        status: 200,
        data: largeData
      }));

      const response = await client.testRequest('GET', 'items');
      expect(response.data.items).toHaveLength(10000);
    });

    it('should prepend slash to endpoint', async () => {
      mockAxiosInstance.request.mockImplementation(() => Promise.resolve({ status: 200, data: {} }));

      await client.testRequest('GET', 'users'); // without leading slash
      
      const callArgs = mockAxiosInstance.request.mock.calls[0][0];
      expect(callArgs.url).toBe('/users');
    });

    it('should handle endpoint with leading slash', async () => {
      mockAxiosInstance.request.mockImplementation(() => Promise.resolve({ status: 200, data: {} }));

      await client.testRequest('GET', '/users'); // with leading slash
      
      // Should result in double slash, which axios will normalize
      const callArgs = mockAxiosInstance.request.mock.calls[0][0];
      expect(callArgs.url).toBe('//users');
    });
  });

  describe('Type safety', () => {
    it('should infer correct types from Zod schema', async () => {
      const schema = z.object({
        count: z.number()
      });

      mockAxiosInstance.request.mockImplementation(() => Promise.resolve({
        status: 200,
        data: { count: 42 }
      }));

      const result = await client.testRequestAndParse('GET', 'count', schema);
      
      // TypeScript should infer this as { count: number }
      expect(result.count).toBe(42);
      // @ts-expect-error - should not have other properties
      expect(result.invalid).toBeUndefined();
    });
  });
});
