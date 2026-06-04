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

4. **Start n8n with Vidopi nodes loaded:**
   ```bash
   ./scripts/start-n8n-with-vidopi.sh
   ```
   Or `npm run dev`. The script uses the repo's local `n8n` (devDependency), stages only `package.json` + `dist` for `N8N_CUSTOM_EXTENSIONS` (avoids loading the repo's heavy `node_modules`), and refuses n8n 1.x.

   If `npm install -g n8n@latest` did not change the version you see, your global install may be on a different Node than your shell (`which n8n` vs `npm root -g`). Prefer `./scripts/start-n8n-with-vidopi.sh` or set `N8N_BIN` explicitly.

5. **Verify nodes in the palette:**
   - **Vidopi** (action): Video → Upload, Cut, Merge, Resize, Crop, Rotate, Speed, Compress, Extract Audio, Compose Audio, Image/Text Overlay, Generate Thumbnail; File → Get Info; Task → Get Status
   - **Vidopi Trigger** (trigger): webhook for async completion

6. **Test async flow:**
   - Create a workflow with **Vidopi Trigger** and activate it
   - Add **Vidopi** with Resource **Video**, Operation **Cut**
   - Paste the Vidopi Trigger **Production URL** into **Callback Webhook URL**
   - Run the workflow and confirm Vidopi receives the webhook URL

## After Making Changes

```bash
npm run build
npm link --force
cd ~/.n8n/nodes && npm link n8n-nodes-vidopi --force
# restart n8n
```
