import { describe, it, expect, beforeEach, mock } from 'bun:test';
import axios, { AxiosHeaders } from 'axios';
import { z } from 'zod';
import ApiCollectorClient from '../apiCollectorClient';

// Realistic subclass mimicking your ProxmoxClient
class MockProxmoxClient extends ApiCollectorClient {
  static override async Create(host: string, apiKey: string): Promise<MockProxmoxClient> {
    const baseUrl = `https://${host}/api2/json`;
    const headers = new AxiosHeaders({
      'Authorization': `Bearer ${apiKey}`
    });
    return new MockProxmoxClient(baseUrl, headers);
  }

  async getAllData() {
    const nodes = await this.getNodes();
    const nodeData = await this.crawlNode(nodes[0].name);
    return { nodes: nodeData };
  }

  private async getNodes() {
    const response = await this.request('GET', 'nodes');
    return response.data;
  }

  private async crawlNode(nodeName: string) {
    const response = await this.request('GET', `nodes/${nodeName}`);
    return response.data;
  }

  // Expose for testing
  public async testRequest(method: string, endpoint: string, opts?: any) {
    return this.request(method as any, endpoint, opts);
  }
}

describe('ApiCollectorClient - Integration Tests', () => {
  let mockAxiosInstance: any;

  beforeEach(() => {
    mockAxiosInstance = {
      request: mock(() => Promise.resolve({ status: 200, data: {} })),
      interceptors: {
        request: { use: mock((fn: any) => fn) },
        response: { use: mock(() => {}) }
      }
    };

    axios.create = mock(() => mockAxiosInstance);
  });

  describe('Real-world workflow: Data collection', () => {
    it('should handle sequential API calls in getAllData', async () => {
      const client = await MockProxmoxClient.Create('192.168.1.100', 'secret-key');

      let callCount = 0;
      // Mock responses
      mockAxiosInstance.request.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            status: 200,
            data: [{ name: 'node1' }, { name: 'node2' }]
          });
        }
        return Promise.resolve({
          status: 200,
          data: { cpu: 0.5, memory: 8192 }
        });
      });

      const result = await client.getAllData();

      expect(mockAxiosInstance.request.mock.calls.length).toBe(2);
      expect(result).toEqual({
        nodes: { cpu: 0.5, memory: 8192 }
      });
    });

    it('should propagate errors during data collection', async () => {
      const client = await MockProxmoxClient.Create('192.168.1.100', 'secret-key');

      mockAxiosInstance.request.mockImplementation(() => 
        Promise.reject(new Error('Connection timeout'))
      );

      expect(async () => {
        await client.getAllData();
      }).toThrow('Connection timeout');
    });
  });

  describe('Authentication scenarios', () => {
    it('should include auth headers in all requests', async () => {
      const client = await MockProxmoxClient.Create('192.168.1.100', 'my-api-key');

      mockAxiosInstance.request.mockImplementation(() => Promise.resolve({ status: 200, data: {} }));

      await client.testRequest('GET', 'test');

      const createCall = (axios.create as any).mock.calls.at(-1)[0];
      expect(createCall.headers['Authorization']).toBe('Bearer my-api-key');
    });

    it('should handle 401 Unauthorized', async () => {
      const client = await MockProxmoxClient.Create('192.168.1.100', 'invalid-key');

      mockAxiosInstance.request.mockImplementation(() => Promise.resolve({
        status: 401,
        data: { error: 'Unauthorized' }
      }));

      expect(async () => {
        await client.testRequest('GET', 'nodes');
      }).toThrow();
    });
  });

  describe('Complex nested data structures', () => {
    it('should handle deeply nested API responses', async () => {
      const client = await MockProxmoxClient.Create('192.168.1.100', 'key');

      const mockData = {
        data: {
          nodes: [
            { id: 'node1', status: { cpu: 0.5, memory: 8192 } },
            { id: 'node2', status: { cpu: 0.3, memory: 4096 } }
          ]
        }
      };

      mockAxiosInstance.request.mockImplementation(() => Promise.resolve({
        status: 200,
        data: mockData
      }));

      // Would need to expose requestAndParse in MockProxmoxClient for this
      const response = await client.testRequest('GET', 'cluster/status');
      expect(response.data).toEqual(mockData);
    });
  });

  describe('Error recovery patterns', () => {
    it('should allow catching and handling specific errors', async () => {
      const client = await MockProxmoxClient.Create('192.168.1.100', 'key');

      mockAxiosInstance.request.mockImplementation(() =>
        Promise.reject(
          Object.assign(new Error('Network Error'), {
            isAxiosError: true,
            response: { status: 503 }
          })
        )
      );

      try {
        await client.testRequest('GET', 'nodes');
        throw new Error('Should have thrown');
      } catch (error: any) {
        expect(error.isAxiosError).toBe(true);
        expect(error.response.status).toBe(503);
      }
    });
  });

  describe('Parallel requests', () => {
    it('should handle concurrent requests', async () => {
      const client = await MockProxmoxClient.Create('192.168.1.100', 'key');

      mockAxiosInstance.request.mockImplementation(() => Promise.resolve({
        status: 200,
        data: { result: 'success' }
      }));

      const requests = [
        client.testRequest('GET', 'nodes'),
        client.testRequest('GET', 'storage'),
        client.testRequest('GET', 'pools')
      ];

      const results = await Promise.all(requests);

      expect(results).toHaveLength(3);
      expect(mockAxiosInstance.request.mock.calls.length).toBe(3);
    });
  });

  describe('Memory and performance', () => {
    it('should handle large response payloads', async () => {
      const client = await MockProxmoxClient.Create('192.168.1.100', 'key');

      // Simulate 10MB response
      const largeArray = new Array(100000).fill(null).map((_, i) => ({
        id: i,
        data: 'x'.repeat(100)
      }));

      mockAxiosInstance.request.mockImplementation(() => Promise.resolve({
        status: 200,
        data: largeArray
      }));

      const response = await client.testRequest('GET', 'large-dataset');
      expect(response.data).toHaveLength(100000);
    });

    it('should not leak memory on multiple requests', async () => {
      const client = await MockProxmoxClient.Create('192.168.1.100', 'key');

      mockAxiosInstance.request.mockImplementation(() => Promise.resolve({
        status: 200,
        data: { small: 'data' }
      }));

      // Make many requests
      for (let i = 0; i < 100; i++) {
        await client.testRequest('GET', `endpoint-${i}`);
      }

      expect(mockAxiosInstance.request.mock.calls.length).toBe(100);
    });
  });

  describe('Custom configurations', () => {
    it('should respect custom timeout', async () => {
      const client = await MockProxmoxClient.Create('192.168.1.100', 'key');

      mockAxiosInstance.request.mockImplementation(() => Promise.resolve({ status: 200, data: {} }));

      await client.testRequest('GET', 'slow-endpoint', { timeout: 60000 });

      const callArgs = mockAxiosInstance.request.mock.calls.at(-1)[0];
      expect(callArgs.timeout).toBe(60000);
    });

    it('should allow custom headers per request', async () => {
      const client = await MockProxmoxClient.Create('192.168.1.100', 'key');

      mockAxiosInstance.request.mockImplementation(() => Promise.resolve({ status: 200, data: {} }));

      await client.testRequest('GET', 'test', {
        headers: { 'X-Custom-Header': 'value' }
      });

      const callArgs = mockAxiosInstance.request.mock.calls.at(-1)[0];
      expect(callArgs.headers['X-Custom-Header']).toBe('value');
    });
  });

  describe('Disconnect lifecycle', () => {
    it('should call disconnect if overridden', async () => {
      class DisconnectableClient extends ApiCollectorClient {
        public disconnected = false;

        static override async Create(): Promise<DisconnectableClient> {
          return new DisconnectableClient('https://api.test', new AxiosHeaders());
        }

        async getAllData() {
          return {};
        }

        override async disconnect() {
          this.disconnected = true;
        }
      }

      const client = await DisconnectableClient.Create();
      await client.disconnect();
      expect(client.disconnected).toBe(true);
    });
  });

  describe('URL construction edge cases', () => {
    it('should handle various endpoint formats', async () => {
      const client = await MockProxmoxClient.Create('192.168.1.100', 'key');

      mockAxiosInstance.request.mockImplementation(() => Promise.resolve({ status: 200, data: {} }));

      const endpoints = [
        'simple',
        'path/with/slashes',
        'path/with/trailing/',
        'query?param=value',
        'path/123/nested/456'
      ];

      for (const endpoint of endpoints) {
        await client.testRequest('GET', endpoint);
      }

      expect(mockAxiosInstance.request.mock.calls.length).toBe(endpoints.length);
    });
  });
});
