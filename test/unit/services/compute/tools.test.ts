/**
 * Tests for Compute service tools
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Import mocks first
import '../../../mocks/google-cloud-mocks.js';
import { mockComputeClient, mockZonesClient, mockStorageClient } from '../../../mocks/google-cloud-mocks.js';
import { createMockMcpServer } from '../../../utils/test-helpers.js';

describe('Compute Tools', () => {
  let mockServer: ReturnType<typeof createMockMcpServer>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockServer = createMockMcpServer();
  });

  it('should register compute tools with MCP server', async () => {
    const { registerComputeTools } = await import('../../../../src/services/compute/tools.js');

    registerComputeTools(mockServer as any);

    expect(mockServer.registerTool).toHaveBeenCalledWith(
      'gcp-compute-list-instances',
      expect.any(Object),
      expect.any(Function),
    );

    expect(mockServer.registerTool).toHaveBeenCalledWith(
      'gcp-compute-delete-instance',
      expect.any(Object),
      expect.any(Function),
    );

    expect(mockServer.registerTool).toHaveBeenCalledWith(
      'gcp-compute-create-instance',
      expect.any(Object),
      expect.any(Function),
    );
  });

  it('should list instances', async () => {
    const { registerComputeTools } = await import('../../../../src/services/compute/tools.js');
    registerComputeTools(mockServer as any);

    const call = mockServer.registerTool.mock.calls.find((c) => c[0] === 'gcp-compute-list-instances');
    expect(call).toBeDefined();
    const handler = call![2];

    const res = await handler({});
    expect(res.content[0].text).toContain('Instances');
    // Should have enumerated zones and called list for zones
    expect(mockZonesClient.list).toHaveBeenCalled();
    expect(mockComputeClient.list).toHaveBeenCalled();
  });

  it('should delete instance', async () => {
    const { registerComputeTools } = await import('../../../../src/services/compute/tools.js');
    registerComputeTools(mockServer as any);

    const call = mockServer.registerTool.mock.calls.find((c) => c[0] === 'gcp-compute-delete-instance');
    const handler = call![2];

    const res = await handler({ name: 'vm-1', zone: 'us-central1-a' });
    expect(res.content[0].text).toContain('Deletion request submitted');
    expect(mockComputeClient.delete).toHaveBeenCalledWith(expect.objectContaining({ instance: 'vm-1', zone: 'us-central1-a' }));
  });

  it('should create instance', async () => {
    const { registerComputeTools } = await import('../../../../src/services/compute/tools.js');
    registerComputeTools(mockServer as any);

    const call = mockServer.registerTool.mock.calls.find((c) => c[0] === 'gcp-compute-create-instance');
    const handler = call![2];

    const res = await handler({ name: 'new-vm', zone: 'us-central1-a', machineType: 'e2-medium' });
    expect(res.content[0].text).toContain('Instance new-vm is being created');
    expect(mockComputeClient.insert).toHaveBeenCalled();
  });

  it('should deploy static html site', async () => {
    const { registerComputeTools } = await import('../../../../src/services/compute/tools.js');
    registerComputeTools(mockServer as any);

    const call = mockServer.registerTool.mock.calls.find((c) => c[0] === 'deploy-static-html-site');
    expect(call).toBeDefined();
    const handler = call![2];

    const html = '<h1>Hello World</h1>';
    const res = await handler({ projectId: 'test-project', zone: 'us-central1-a', vmName: 'site-vm', htmlContent: html });
    expect(res.content[0].text).toContain('Deploy Started');
    // Should have created instance with metadata startup-script
    expect(mockComputeClient.insert).toHaveBeenCalled();
    const calledWith = mockComputeClient.insert.mock.calls[0][0];

    expect(calledWith).toHaveProperty('instanceResource');
    expect(calledWith.instanceResource).toHaveProperty('metadata');
    const items = calledWith.instanceResource.metadata.items;
    expect(items.some((it: any) => it.key === 'startup-script')).toBe(true);

    // Verify the instance will have external NAT
    expect(calledWith.instanceResource.networkInterfaces[0]).toHaveProperty('accessConfigs');
  });

  it('should get vm status and ip', async () => {
    const { registerComputeTools } = await import('../../../../src/services/compute/tools.js');
    registerComputeTools(mockServer as any);

    const statusCall = mockServer.registerTool.mock.calls.find((c) => c[0] === 'get-compute-vm-status');
    const statusHandler = statusCall![2];
    const statusRes = await statusHandler({ projectId: 'test-project', zone: 'us-central1-a', vmName: 'vm-1' });
    expect(statusRes.content[0].text).toContain('status');

    const ipCall = mockServer.registerTool.mock.calls.find((c) => c[0] === 'get-compute-vm-ip');
    const ipHandler = ipCall![2];
    const ipRes = await ipHandler({ projectId: 'test-project', zone: 'us-central1-a', vmName: 'vm-1' });
    expect(ipRes.content[0].text).toContain('http://1.2.3.4');
  });

  it('should manage storage buckets and orchestrate deploy', async () => {
    const { registerComputeTools } = await import('../../../../src/services/compute/tools.js');
    registerComputeTools(mockServer as any);

    // create bucket
    const createCall = mockServer.registerTool.mock.calls.find((c) => c[0] === 'create-static-site-bucket');
    const createHandler = createCall![2];
    const createRes = await createHandler({ projectId: 'test-project', bucketName: 'site-bucket', location: 'US' });
    expect(createRes.content[0].text).toContain('Bucket site-bucket created');
    expect(mockStorageClient.createBucket).toHaveBeenCalledWith('site-bucket', expect.objectContaining({ location: 'US' }));

    // upload
    const uploadCall = mockServer.registerTool.mock.calls.find((c) => c[0] === 'upload-static-site-html');
    const uploadHandler = uploadCall![2];
    const uploadRes = await uploadHandler({ bucketName: 'site-bucket', fileName: 'index.html', htmlContent: '<h1>Hi</h1>' });
    expect(uploadRes.content[0].text).toContain('Upload Successful');

    // list buckets
    const listCall = mockServer.registerTool.mock.calls.find((c) => c[0] === 'list-static-site-buckets');
    const listHandler = listCall![2];
    const listRes = await listHandler({ projectId: 'test-project' });
    expect(listRes.content[0].text).toContain('Buckets');

    // delete bucket
    const delCall = mockServer.registerTool.mock.calls.find((c) => c[0] === 'delete-static-site-bucket');
    const delHandler = delCall![2];
    const delRes = await delHandler({ bucketName: 'site-bucket' });
    expect(delRes.content[0].text).toContain('Bucket site-bucket deleted');

    // Orchestrate deploy static site from html
    const deployCall = mockServer.registerTool.mock.calls.find((c) => c[0] === 'deploy-static-site-from-html');
    const deployHandler = deployCall![2];
    const deployRes = await deployHandler({ projectId: 'test-project', zone: 'us-central1-a', vmName: 'site-vm', bucketName: 'site-bucket', htmlContent: '<h1>Deployed</h1>' });
    expect(deployRes.content[0].text).toContain('Deploy Started');

    // Ensure VM insert called and included service account scopes and startup-script
    const calledWith = mockComputeClient.insert.mock.calls[0][0];
    expect(calledWith.instanceResource).toHaveProperty('metadata');
    const items = calledWith.instanceResource.metadata.items;
    expect(items.some((it: any) => it.key === 'startup-script')).toBe(true);
    expect(calledWith.instanceResource.serviceAccounts[0].scopes).toContain('https://www.googleapis.com/auth/devstorage.read_only');
  });
});
