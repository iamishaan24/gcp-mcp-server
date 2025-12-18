/**
 * Mock implementations for Google Cloud services
 */
import { vi } from 'vitest';
import { createMockLogEntries, createMockIamPolicy, createMockSpannerSchema, createMockBillingAccount, createMockCostData } from '../utils/test-helpers.js';

// Mock @google-cloud/logging
export const mockLoggingClient = {
  getEntries: vi.fn().mockResolvedValue([createMockLogEntries(), {}, {}]),
  createSink: vi.fn().mockResolvedValue([{ name: 'test-sink' }]),
  getSinks: vi.fn().mockResolvedValue([[], {}, {}]),
};

vi.mock('@google-cloud/logging', () => ({
  Logging: vi.fn(() => mockLoggingClient),
}));

// Mock @google-cloud/monitoring
export const mockMonitoringClient = {
  listTimeSeries: vi.fn().mockResolvedValue([[], {}, {}]),
  listMetricDescriptors: vi.fn().mockResolvedValue([[], {}, {}]),
  createTimeSeries: vi.fn().mockResolvedValue([{}]),
};

vi.mock('@google-cloud/monitoring', () => ({
  default: { MetricServiceClient: vi.fn(() => mockMonitoringClient) },
  MetricServiceClient: vi.fn(() => mockMonitoringClient),
}));

// Mock @google-cloud/spanner
export const mockSpannerClient = {
  instance: vi.fn(() => ({
    database: vi.fn(() => ({
      run: vi.fn().mockResolvedValue([[], {}]),
      runStream: vi.fn().mockReturnValue({
        on: vi.fn(),
        pipe: vi.fn(),
      }),
      getSchema: vi.fn().mockResolvedValue([createMockSpannerSchema()]),
    })),
  })),
};

vi.mock('@google-cloud/spanner', () => ({
  Spanner: vi.fn(() => mockSpannerClient),
}));

// Mock @google-cloud/resource-manager
export const mockResourceManagerClient = {
  getIamPolicy: vi.fn().mockResolvedValue([createMockIamPolicy()]),
  setIamPolicy: vi.fn().mockResolvedValue([createMockIamPolicy()]),
  testIamPermissions: vi.fn().mockResolvedValue([{ permissions: ['test.permission'] }]),
};

vi.mock('@google-cloud/resource-manager', () => ({
  ProjectsClient: vi.fn(() => mockResourceManagerClient),
}));

// Mock google-auth-library
export const mockAuthClient = {
  getAccessToken: vi.fn().mockResolvedValue({ token: 'mock-token' }),
  getProjectId: vi.fn().mockResolvedValue('test-project'),
  authorize: vi.fn().mockResolvedValue(undefined),
};

vi.mock('google-auth-library', () => ({
  GoogleAuth: vi.fn(() => mockAuthClient),
}));

// Mock @modelcontextprotocol/sdk
export const mockMcpServer = {
  registerTool: vi.fn(),
  tool: vi.fn(),
  resource: vi.fn(),
  prompt: vi.fn(),
  registerPrompt: vi.fn(),
  connect: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
};

vi.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: vi.fn(() => mockMcpServer),
  ResourceTemplate: vi.fn(),
}));

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: vi.fn(),
}));

// Mock @google-cloud/billing
export const mockBillingClient = {
  listBillingAccounts: vi.fn().mockResolvedValue([[createMockBillingAccount()], null]),
  getBillingAccount: vi.fn().mockResolvedValue([createMockBillingAccount()]),
  listProjectBillingInfo: vi.fn().mockResolvedValue([[], null]),
  getProjectBillingInfo: vi.fn().mockResolvedValue([{
    name: 'projects/test-project',
    billingEnabled: true,
    billingAccountName: 'billingAccounts/123456-789ABC-DEF012'
  }]),
};

export const mockCatalogClient = {
  listServices: vi.fn().mockResolvedValue([[
    {
      name: 'services/compute',
      serviceId: 'compute.googleapis.com',
      displayName: 'Compute Engine API',
      businessEntityName: 'Google LLC'
    }
  ], null]),
  listSkus: vi.fn().mockResolvedValue([[
    {
      name: 'services/compute/skus/test-sku',
      skuId: 'test-sku-id',
      description: 'Test SKU',
      category: {
        serviceDisplayName: 'Compute Engine',
        resourceFamily: 'Compute',
        resourceGroup: 'Standard',
        usageType: 'OnDemand'
      },
      serviceRegions: ['us-central1'],
      pricingInfo: [],
      serviceProviderName: 'Google'
    }
  ], null]),
};

// Mock @google-cloud/compute (InstancesClient, ZonesClient)
export const mockComputeClient = {
  list: vi.fn().mockResolvedValue([[ { name: 'vm-1', status: 'RUNNING', zone: 'projects/test-project/zones/us-central1-a', machineType: 'zones/us-central1-a/machineTypes/e2-medium', networkInterfaces: [{ network: 'global/networks/default', accessConfigs: [{ natIP: '1.2.3.4' }] }] } ]]),
  delete: vi.fn().mockResolvedValue([{}]),
  insert: vi.fn().mockResolvedValue([{}]),
  get: vi.fn().mockResolvedValue([ { name: 'vm-1', status: 'RUNNING', networkInterfaces: [{ accessConfigs: [{ natIP: '1.2.3.4' }] }] } ]),
};

// Mock @google-cloud/storage
export const mockStorageClient = {
  createBucket: vi.fn().mockResolvedValue([{}]),
  bucket: vi.fn((name: string) => ({
    file: vi.fn((fileName: string) => ({
      save: vi.fn().mockResolvedValue([{}]),
      makePublic: vi.fn().mockResolvedValue([{}]),
    })),
    delete: vi.fn().mockResolvedValue([{}]),
    getFiles: vi.fn().mockResolvedValue([[]]),
  })),
  getBuckets: vi.fn().mockResolvedValue([[]]),
};

vi.mock('@google-cloud/storage', () => ({
  Storage: vi.fn(() => mockStorageClient),
}));

export const mockZonesClient = {
  // The real ZonesClient.list returns an array of zones as the first element
  list: vi.fn().mockResolvedValue([[{ name: 'us-central1-a' }]]),
};

vi.mock('@google-cloud/billing', () => ({
  CloudBillingClient: vi.fn(() => mockBillingClient),
  CloudCatalogClient: vi.fn(() => mockCatalogClient),
}));

vi.mock('@google-cloud/compute', () => ({
  InstancesClient: vi.fn(() => mockComputeClient),
  ZonesClient: vi.fn(() => mockZonesClient),
}));

