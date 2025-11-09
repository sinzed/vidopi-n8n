# Testing n8n-nodes-vidopi Locally

## Quick Test Steps

1. **Build the package:**
   ```bash
   npm run build
   ```

2. **Link the package globally:**
   ```bash
   npm link
   ```

3. **Link to n8n's nodes directory:**
   ```bash
   mkdir -p ~/.n8n/nodes
   cd ~/.n8n/nodes
   npm link n8n-nodes-vidopi
   ```

4. **Start n8n:**
   ```bash
   n8n start
   ```

5. **Access n8n:**
   - Open your browser and go to `http://localhost:5678`
   - The nodes should appear automatically since the package is linked
   - If they don't appear, you can install them via the UI:
     - Go to **Settings** → **Community Nodes** → **Install a community node**
     - Enter: `n8n-nodes-vidopi`
     - Click **Install**

6. **Use the nodes:**
   - Create a new workflow
   - Search for "Vidopi" in the node palette
   - You should see all Vidopi nodes:
     - Vidopi Upload Video
     - Vidopi Cut Video
     - Vidopi Merge Videos
     - Vidopi Resize Video

7. **Test the nodes:**
   - Add a Vidopi node to your workflow
   - Click on the node to configure it
   - In the credentials section, click "Create New Credential"
   - Select "Vidopi API"
   - Enter your API key (get it from https://vidopi.com - free tier available)
   - Save and test the node functionality

## Troubleshooting

If nodes don't appear:
1. Make sure the package is properly linked: `ls -la ~/.n8n/nodes/node_modules/n8n-nodes-vidopi`
2. Check that dist files exist: `ls -la ~/.n8n/nodes/node_modules/n8n-nodes-vidopi/dist/nodes/Vidopi/`
3. Restart n8n after linking
4. Check n8n logs for any error messages

## After Making Changes

If you make changes to the code:
1. Rebuild: `npm run build`
2. Re-link: `npm link --force` (in project directory)
3. Re-link to n8n: `npm link n8n-nodes-vidopi --force` (in ~/.n8n/nodes)
4. Restart n8n

