# Installing n8n-nodes-vidopi in n8n

## Method 1: Install via n8n UI (Recommended for Production)

1. **Start n8n** (if not already running):
   ```bash
   n8n start
   ```

2. **Open n8n in your browser:**
   - Go to `http://localhost:5678`

3. **Navigate to Community Nodes:**
   - Click on **Settings** (gear icon) in the left sidebar
   - Click on **Community Nodes**
   - Click on **Install a community node**

4. **Enter the package name:**
   - Package name: `n8n-nodes-vidopi`
   - Click **Install**

5. **Wait for installation to complete**
   - n8n will download and install the package
   - You may need to refresh the page

6. **Verify installation:**
   - Create a new workflow
   - Search for "Vidopi" in the node palette
   - You should see all 5 Vidopi nodes

## Method 2: Install via Command Line (Before Starting n8n)

1. **Navigate to n8n's custom nodes directory:**
   ```bash
   mkdir -p ~/.n8n/nodes
   cd ~/.n8n/nodes
   ```

2. **Install the package:**
   ```bash
   npm install n8n-nodes-vidopi
   ```

3. **Start n8n:**
   ```bash
   n8n start
   ```

4. **Verify in n8n UI:**
   - Open `http://localhost:5678`
   - Search for "Vidopi" in the node palette

## Method 3: Using npm link (For Development/Testing)

1. **Build the package:**
   ```bash
   cd /path/to/vidopi-n8n
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

5. **The nodes should appear automatically** when you search for "Vidopi"

## After Installation

Once installed, you can use the Vidopi nodes:

1. **Create a workflow** in n8n
2. **Search for "Vidopi"** in the node palette
3. **Add a Vidopi node** to your workflow
4. **Configure credentials:**
   - Click on the node
   - In the credentials section, click "Create New Credential"
   - Select "Vidopi API"
   - Enter your API key (get it from https://vidopi.com)
   - Save

## Available Nodes

- **Vidopi Upload Video** - Upload video files for processing
- **Vidopi Cut Video** - Cut a segment from a video
- **Vidopi Merge Videos** - Merge two videos together
- **Vidopi Resize Video** - Resize video dimensions
- **Vidopi Task Status** - Check the status of video processing tasks

## Troubleshooting

### Nodes don't appear after installation

1. **Restart n8n:**
   ```bash
   # Stop n8n (Ctrl+C)
   n8n start
   ```

2. **Check installation:**
   ```bash
   ls -la ~/.n8n/nodes/node_modules/n8n-nodes-vidopi
   ```

3. **Check n8n logs** for any error messages

4. **Clear n8n cache** (if needed):
   ```bash
   rm -rf ~/.n8n/nodes/node_modules/n8n-nodes-vidopi
   # Then reinstall using one of the methods above
   ```

5. **Verify package.json structure:**
   - Make sure the `n8n` section in package.json has the correct paths

### Credentials not working

1. Make sure you've entered a valid API key from https://vidopi.com
2. Check that the base URL is correctly set to `https://api.vidopi.com` (it's fixed and shouldn't need changing)

