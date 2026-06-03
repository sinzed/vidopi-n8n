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

5. **Verify nodes in the palette:**
   - **Vidopi** (action): Video → Upload / Cut / Merge / Resize; Task → Get Status
   - **Vidopi Trigger** (trigger): webhook for async completion

6. **Test async flow:**
   - Create a workflow with **Vidopi Trigger** and activate it
   - Add **Vidopi** with Resource **Video**, Operation **Cut**
   - Set **Callback Webhook URL** to the trigger URL (or use the default expression)
   - Run the workflow and confirm Vidopi receives the webhook URL

## After Making Changes

```bash
npm run build
npm link --force
cd ~/.n8n/nodes && npm link n8n-nodes-vidopi --force
# restart n8n
```
