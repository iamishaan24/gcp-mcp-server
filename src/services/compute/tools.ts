/**
 * Google Cloud Compute tools for MCP
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getProjectId } from '../../utils/auth.js';
import { getComputeClient, formatInstance } from './types.js';
import { getResourceManagerClient } from '../iam/types.js';
import { ZonesClient } from '@google-cloud/compute';
import { logger } from '../../utils/logger.js';

export function registerComputeTools(server: McpServer): void {
  // List instances (aggregated or within a zone)
  server.registerTool(
    'gcp-compute-list-instances',
    {
      title: 'List Compute Instances',
      description: 'List Compute Engine VM instances across the project or within a zone',
      inputSchema: {
        zone: z.string().optional().describe('Zone to list instances from (optional)'),
        filter: z.string().optional().describe('Optional filter for the API'),
        pageSize: z.number().min(1).max(500).default(50).describe('Maximum items'),
      },
    },
    async ({ zone, filter, pageSize }) => {
      try {
        const project = await getProjectId();
        const client = getComputeClient();

        if (zone) {
          const [instances] = await client.list({ project, zone, maxResults: pageSize, filter });
          const items = (instances || []) as any[];
          if (!items || items.length === 0) {
            return { content: [{ type: 'text', text: `No instances found in zone ${zone}` }] };
          }

          const body = items.map(formatInstance).join('\n');
          return { content: [{ type: 'text', text: `# Instances in ${zone}\n\n${body}` }] };
        }

        // No zone provided - enumerate zones and collect instances
        const zonesClient = new ZonesClient();
        const [zones] = await zonesClient.list({ project });
        const zoneNames = (zones || []).map((z: any) => z.name).filter(Boolean);

        const instances: any[] = [];
        for (const z of zoneNames) {
          const [zoneInstances] = await client.list({ project, zone: z });
          if (zoneInstances && Array.isArray(zoneInstances)) {
            instances.push(...(zoneInstances as any[]));
          }
        }

        if (instances.length === 0) {
          return { content: [{ type: 'text', text: `# Instances\n\nNo compute instances found in project ${project}` }] };
        }

        const body = instances.map(formatInstance).join('\n');
        return { content: [{ type: 'text', text: `# Instances\n\nProject: ${project}\n\n${body}` }] };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`Error listing instances: ${message}`);
        return { content: [{ type: 'text', text: `# Error Listing Instances\n\n${message}` }], isError: true };
      }
    },
  );

  // Delete an instance
  server.registerTool(
    'gcp-compute-delete-instance',
    {
      title: 'Delete Compute Instance',
      description: 'Delete a Compute Engine VM instance by name and zone',
      inputSchema: {
        name: z.string().describe('Instance name'),
        zone: z.string().describe('Zone of the instance (e.g., us-central1-a)'),
      },
    },
    async ({ name, zone }) => {
      try {
        const project = await getProjectId();
        const client = getComputeClient();

        // Attempt delete
        await client.delete({ project, zone, instance: name });

        return { content: [{ type: 'text', text: `# Delete Started\n\nDeletion request submitted for instance: ${name} in zone ${zone}` }] };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`Error deleting instance ${name}: ${message}`);
        return {
          content: [{ type: 'text', text: `# Error Deleting Instance\n\nFailed to delete instance ${name}: ${message}` }],
          isError: true,
        };
      }
    },
  );

  // Create an instance with basic specs
  server.registerTool(
    'gcp-compute-create-instance',
    {
      title: 'Create Compute Instance',
      description: 'Create a Compute Engine VM instance with simple parameters',
      inputSchema: {
        name: z.string().describe('Name for the new instance'),
        zone: z.string().describe('Zone for the instance (e.g., us-central1-a)'),
        machineType: z.string().default('e2-medium').describe('Machine type short name (e.g., e2-medium)'),
        image: z.string().default('projects/debian-cloud/global/images/family/debian-11').describe('Disk image to use'),
        network: z.string().default('global/networks/default').describe('Network resource path'),
        startupScript: z.string().optional().describe('Optional startup script to run on instance creation'),
      },
    },
    async ({ name, zone, machineType, image, network, startupScript }) => {
      try {
        const project = await getProjectId();
        const client = getComputeClient();

        const instanceResource: any = {
          name,
          machineType: `zones/${zone}/machineTypes/${machineType}`,
          disks: [
            {
              boot: true,
              autoDelete: true,
              initializeParams: {
                sourceImage: image,
              },
            },
          ],
          networkInterfaces: [
            {
              network,
            },
          ],
        };

        // Attach startup script via metadata if provided
        if (startupScript) {
          instanceResource.metadata = {
            items: [
              { key: 'startup-script', value: startupScript },
            ],
          };
        }

        await client.insert({ project, zone, instanceResource });

        return { content: [{ type: 'text', text: `# Instance Creation Started\n\nInstance ${name} is being created in zone ${zone}` }] };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`Error creating instance ${name}: ${message}`);
        return {
          content: [{ type: 'text', text: `# Error Creating Instance\n\nFailed to create instance ${name}: ${message}` }],
          isError: true,
        };
      }
    },
  );

  // Get instance IPs and suggested SSH commands
  server.registerTool(
    'gcp-compute-get-instance-ip',
    {
      title: 'Get Instance IP and SSH Command',
      description: 'Fetch external IP(s) for a VM and provide suggested SSH commands',
      inputSchema: {
        name: z.string().describe('Instance name'),
        zone: z.string().describe('Zone of the instance (e.g., us-central1-a)'),
      },
    },
    async ({ name, zone }) => {
      try {
        const project = await getProjectId();
        const client = getComputeClient();

        const [instance] = await client.get({ project, zone, instance: name });
        if (!instance) {
          return { content: [{ type: 'text', text: `# Instance Not Found\n\nNo instance named ${name} found in zone ${zone}` }], isError: true };
        }

        const externalIps = (instance.networkInterfaces || []).flatMap((n: any) => (n.accessConfigs || []).map((ac: any) => ac.natIP).filter(Boolean));
        const ipsText = externalIps.length > 0 ? externalIps.join(', ') : 'No external IPs found';

        const gcloudCmd = `gcloud compute ssh ${name} --zone ${zone} --project ${project}`;
        const directSsh = externalIps.length > 0 ? `ssh <USERNAME>@${externalIps[0]}` : 'No external IP to SSH directly';

        const body = `# Instance: ${name}\n\nStatus: ${instance.status || 'UNKNOWN'}\nExternal IPs: ${ipsText}\n\nSuggested SSH commands:\n- ${gcloudCmd}\n- ${directSsh}`;

        return { content: [{ type: 'text', text: body }] };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`Error getting instance IPs for ${name}: ${message}`);
        return { content: [{ type: 'text', text: `# Error Getting Instance IPs\n\nFailed to fetch IPs for instance ${name}: ${message}` }], isError: true };
      }
    },
  );

  // Start an instance
  server.registerTool(
    'gcp-compute-start-instance',
    {
      title: 'Start Compute Instance',
      description: 'Start a stopped Compute Engine VM instance',
      inputSchema: {
        name: z.string().describe('Instance name'),
        zone: z.string().describe('Zone of the instance (e.g., us-central1-a)'),
      },
    },
    async ({ name, zone }) => {
      try {
        const project = await getProjectId();
        const client = getComputeClient();

        await client.start({ project, zone, instance: name });

        return { content: [{ type: 'text', text: `# Start Requested\n\nStart request submitted for instance ${name} in zone ${zone}` }] };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`Error starting instance ${name}: ${message}`);
        return { content: [{ type: 'text', text: `# Error Starting Instance\n\nFailed to start instance ${name}: ${message}` }], isError: true };
      }
    },
  );

  // Stop an instance
  server.registerTool(
    'gcp-compute-stop-instance',
    {
      title: 'Stop Compute Instance',
      description: 'Stop a running Compute Engine VM instance',
      inputSchema: {
        name: z.string().describe('Instance name'),
        zone: z.string().describe('Zone of the instance (e.g., us-central1-a)'),
      },
    },
    async ({ name, zone }) => {
      try {
        const project = await getProjectId();
        const client = getComputeClient();

        await client.stop({ project, zone, instance: name });

        return { content: [{ type: 'text', text: `# Stop Requested\n\nStop request submitted for instance ${name} in zone ${zone}` }] };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`Error stopping instance ${name}: ${message}`);
        return { content: [{ type: 'text', text: `# Error Stopping Instance\n\nFailed to stop instance ${name}: ${message}` }], isError: true };
      }
    },
  );

  // Deploy a static HTML site using a startup script
  server.registerTool(
    'deploy-static-html-site',
    {
      title: 'Deploy Static HTML Site',
      description: 'Create a VM with a startup script that installs nginx and writes provided HTML to /var/www/html/index.html',
      inputSchema: {
        projectId: z.string().optional().describe('Project ID (optional, will use default if omitted)'),
        zone: z.string().describe('Zone for the instance (e.g., us-central1-a)'),
        vmName: z.string().describe('Name for the VM'),
        htmlContent: z.string().describe('HTML content to serve'),
      },
    },
    async ({ projectId, zone, vmName, htmlContent }) => {
      try {
        const project = projectId || await getProjectId();
        const client = getComputeClient();

        // Safely embed the HTML by base64 encoding it
        const base64Html = Buffer.from(htmlContent || '').toString('base64');

        const startupScript = `#!/bin/bash
          set -e
          apt-get update -y
          apt-get install -y nginx
          mkdir -p /var/www/html
          echo "${base64Html}" | base64 -d > /var/www/html/index.html
          systemctl restart nginx || service nginx restart || true
          `;

        const instanceResource: any = {
          name: vmName,
          machineType: `zones/${zone}/machineTypes/e2-micro`,
          disks: [
            {
              boot: true,
              autoDelete: true,
              initializeParams: {
                sourceImage: 'projects/debian-cloud/global/images/family/debian-12',
              },
            },
          ],
          networkInterfaces: [
            {
              network: 'global/networks/default',
              accessConfigs: [
                { name: 'External NAT', type: 'ONE_TO_ONE_NAT' },
              ],
            },
          ],
          tags: { items: ['http-server'] },
          metadata: {
            items: [
              { key: 'startup-script', value: startupScript },
            ],
          },
        };

        const res = await client.insert({ project, zone, instanceResource });

        return { content: [{ type: 'text', text: `# Deploy Started\n\nOperation: ${JSON.stringify(res[0])}` }] };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`Error deploying static site to ${vmName}: ${message}`);
        return { content: [{ type: 'text', text: `# Error Deploying Static Site\n\nFailed to deploy to ${vmName}: ${message}` }], isError: true };
      }
    },
  );

  // Get VM status
  server.registerTool(
    'get-compute-vm-status',
    {
      title: 'Get Compute VM Status',
      description: 'Retrieve the status of a Compute Engine VM instance',
      inputSchema: {
        projectId: z.string().optional().describe('Project ID (optional, will use default if omitted)'),
        zone: z.string().describe('Zone of the instance (e.g., us-central1-a)'),
        vmName: z.string().describe('VM name'),
      },
    },
    async ({ projectId, zone, vmName }) => {
      try {
        const project = projectId || await getProjectId();
        const client = getComputeClient();

        const [instance] = await client.get({ project, zone, instance: vmName });
        const status = instance?.status || 'UNKNOWN';

        return { content: [{ type: 'text', text: `# VM Status\n\nInstance ${vmName} status: ${status}` }] };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`Error getting VM status for ${vmName}: ${message}`);
        return { content: [{ type: 'text', text: `# Error Getting VM Status\n\nFailed to get status for ${vmName}: ${message}` }], isError: true };
      }
    },
  );

  // Get VM external IP and return an http URL
  server.registerTool(
    'get-compute-vm-ip',
    {
      title: 'Get Compute VM IP',
      description: 'Fetch the external IP of a VM and return an http URL',
      inputSchema: {
        projectId: z.string().optional().describe('Project ID (optional, will use default if omitted)'),
        zone: z.string().describe('Zone of the instance (e.g., us-central1-a)'),
        vmName: z.string().describe('VM name'),
      },
    },
    async ({ projectId, zone, vmName }) => {
      try {
        const project = projectId || await getProjectId();
        const client = getComputeClient();

        const [instance] = await client.get({ project, zone, instance: vmName });

        const externalIps = (instance.networkInterfaces || []).flatMap((n: any) => (n.accessConfigs || []).map((ac: any) => ac.natIP).filter(Boolean));
        if (!externalIps || externalIps.length === 0) {
          return { content: [{ type: 'text', text: `# No External IP\n\nInstance ${vmName} has no external IP assigned` }], isError: true };
        }

        const url = `http://${externalIps[0]}`;
        return { content: [{ type: 'text', text: `# Instance URL\n\n${url}` }] };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`Error getting VM IP for ${vmName}: ${message}`);
        return { content: [{ type: 'text', text: `# Error Getting VM IP\n\nFailed to fetch IP for ${vmName}: ${message}` }], isError: true };
      }
    },
  );

  // Storage: create a bucket for static site
  server.registerTool(
    'create-static-site-bucket',
    {
      title: 'Create Static Site Bucket',
      description: 'Create a Cloud Storage bucket configured for static site hosting (uniform bucket-level access).',
      inputSchema: {
        projectId: z.string().optional().describe('Project ID (optional, uses default if omitted)'),
        bucketName: z.string().describe('Name for the bucket'),
        location: z.string().optional().default('US').describe('Location for the bucket (default US)'),
      },
    },
    async ({ projectId, bucketName, location }) => {
      try {
        const project = projectId || await getProjectId();
        const { Storage } = await import('@google-cloud/storage');
        const storage = new Storage({ projectId: project });

        // Create bucket
        await storage.createBucket(bucketName, { location });
        // Enable uniform bucket-level access in a type-safe way
        const bucket = storage.bucket(bucketName);
        await bucket.setMetadata({ iamConfiguration: { uniformBucketLevelAccess: { enabled: true } } });

        return { content: [{ type: 'text', text: `# Bucket Created\n\nBucket ${bucketName} created in ${location}` }] };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`Error creating bucket ${bucketName}: ${message}`);
        return { content: [{ type: 'text', text: `# Error Creating Bucket\n\nFailed to create bucket ${bucketName}: ${message}` }], isError: true };
      }
    },
  );

  // Upload HTML to bucket and make object public
  server.registerTool(
    'upload-static-site-html',
    {
      title: 'Upload Static Site HTML',
      description: 'Upload an HTML file to Cloud Storage and make it publicly readable.',
      inputSchema: {
        bucketName: z.string().describe('Bucket name'),
        fileName: z.string().default('index.html').describe('File name (default index.html)'),
        htmlContent: z.string().describe('HTML content to upload'),
      },
    },
    async ({ bucketName, fileName, htmlContent }) => {
      try {
        const { Storage } = await import('@google-cloud/storage');
        const storage = new Storage();

        const bucket = storage.bucket(bucketName);
        const file = bucket.file(fileName);

        // Upload content with proper content-type
        await file.save(htmlContent, { contentType: 'text/html' });
        // Make public
        await file.makePublic();

        const publicUrl = `https://storage.googleapis.com/${bucketName}/${fileName}`;

        return { content: [{ type: 'text', text: `# Upload Successful\n\nFile uploaded and public at ${publicUrl}` }] };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`Error uploading HTML to ${bucketName}/${fileName}: ${message}`);
        return { content: [{ type: 'text', text: `# Error Uploading HTML\n\nFailed to upload ${fileName} to ${bucketName}: ${message}` }], isError: true };
      }
    },
  );

  // List buckets
  server.registerTool(
    'list-static-site-buckets',
    {
      title: 'List Storage Buckets',
      description: 'List Cloud Storage buckets in the project.',
      inputSchema: {
        projectId: z.string().optional().describe('Project ID (optional)')
      },
    },
    async ({ projectId }) => {
      try {
        const project = projectId || await getProjectId();
        const { Storage } = await import('@google-cloud/storage');
        const storage = new Storage({ projectId: project });

        const [buckets] = await storage.getBuckets({ project: project });
        const names = (buckets || []).map((b: any) => b.name).join('\n');
        return { content: [{ type: 'text', text: `# Buckets\n\n${names || '(none)'}` }] };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`Error listing buckets: ${message}`);
        return { content: [{ type: 'text', text: `# Error Listing Buckets\n\n${message}` }], isError: true };
      }
    },
  );

  // Delete bucket
  server.registerTool(
    'delete-static-site-bucket',
    {
      title: 'Delete Storage Bucket',
      description: 'Delete a Cloud Storage bucket (must be empty).',
      inputSchema: {
        bucketName: z.string().describe('Bucket name'),
      },
    },
    async ({ bucketName }) => {
      try {
        const { Storage } = await import('@google-cloud/storage');
        const storage = new Storage();

        const bucket = storage.bucket(bucketName);
        await bucket.delete();

        return { content: [{ type: 'text', text: `# Bucket Deleted\n\nBucket ${bucketName} deleted` }] };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`Error deleting bucket ${bucketName}: ${message}`);
        return { content: [{ type: 'text', text: `# Error Deleting Bucket\n\nFailed to delete bucket ${bucketName}: ${message}` }], isError: true };
      }
    },
  );

  // Deploy static site from HTML content: orchestrate bucket creation, upload and VM creation
  server.registerTool(
    'deploy-static-site-from-html',
    {
      title: 'Deploy Static Site from HTML',
      description: 'Create a bucket, upload HTML, and provision a VM that serves the bucket content via nginx.',
      inputSchema: {
        projectId: z.string().optional().describe('Project ID (optional)'),
        zone: z.string().describe('Zone for the VM (e.g., us-central1-a)'),
        vmName: z.string().describe('VM name'),
        bucketName: z.string().describe('Bucket name'),
        htmlContent: z.string().describe('HTML content to deploy'),
      },
    },
    async ({ projectId, zone, vmName, bucketName, htmlContent }) => {
      try {
        const project = projectId || await getProjectId();

        const { Storage } = await import('@google-cloud/storage');
        const storage = new Storage({ projectId: project });

        // Create bucket (idempotent in this context)
        await storage.createBucket(bucketName, { location: 'US' });
        const bucket = storage.bucket(bucketName);
        await bucket.setMetadata({ iamConfiguration: { uniformBucketLevelAccess: { enabled: true } } });

        // Upload index.html and make it public
        const file = bucket.file('index.html');
        await file.save(htmlContent, { contentType: 'text/html' });
        await file.makePublic();

        // Create VM with startup script that installs nginx, gsutil and syncs
        const client = getComputeClient();

        const startupScript = `#!/bin/bash
          set -e
          apt-get update -y
          apt-get install -y nginx google-cloud-sdk || (apt-get install -y python3-pip && pip install gsutil)
          mkdir -p /var/www/html
          if command -v gsutil >/dev/null 2>&1; then
            gsutil -m rsync -r gs://${bucketName} /var/www/html || true
          else
            echo "gsutil not found, sync skipped" >/var/log/startup-script.log
          fi
          systemctl restart nginx || service nginx restart || true
          `;

        const instanceResource: any = {
          name: vmName,
          machineType: `zones/${zone}/machineTypes/e2-micro`,
          disks: [
            {
              boot: true,
              autoDelete: true,
              initializeParams: {
                sourceImage: 'projects/debian-cloud/global/images/family/debian-12',
              },
            },
          ],
          networkInterfaces: [
            {
              network: 'global/networks/default',
              accessConfigs: [
                { name: 'External NAT', type: 'ONE_TO_ONE_NAT' },
              ],
            },
          ],
          tags: { items: ['http-server'] },
          metadata: {
            items: [
              { key: 'startup-script', value: startupScript },
            ],
          },
          // Ensure VM can read bucket objects
          serviceAccounts: [{ email: 'default', scopes: ['https://www.googleapis.com/auth/devstorage.read_only'] }],
        };

        const res = await client.insert({ project, zone, instanceResource });

        return { content: [{ type: 'text', text: `# Deploy Started\n\nOperation: ${JSON.stringify(res[0])}` }] };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`Error deploying static site from HTML: ${message}`);
        return { content: [{ type: 'text', text: `# Error Deploying Static Site\n\n${message}` }], isError: true };
      }
    },
  );

      // List all accessible project IDs
      server.registerTool(
        'gcp-list-project-ids',
        {
          title: 'List Project IDs',
          description: 'List all accessible Google Cloud project IDs',
          inputSchema: {
            filter: z.string().optional().describe('Optional filter for projects (e.g., "state:ACTIVE")'),
            pageSize: z.number().min(1).max(1000).optional().default(200),
          },
        },
        async ({ filter, pageSize }) => {
          try {
            const resourceManager = getResourceManagerClient();

            const [projects] = await resourceManager.listProjects({ pageSize, filter } as any);

            if (!projects || projects.length === 0) {
              return { content: [{ type: 'text', text: `# Projects\n\nNo projects found.` }] };
            }

            const ids = (projects || [])
              .map((p: any) => p.projectId || (p.name || '').replace('projects/', '') || '')
              .filter(Boolean)
              .join('\n');

            return { content: [{ type: 'text', text: `# Project IDs\n\n${ids}` }] };
          } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            logger.error(`Error listing projects: ${message}`);
            return { content: [{ type: 'text', text: `# Error Listing Projects\n\n${message}` }], isError: true };
          }
        },
      );
}
