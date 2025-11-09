# n8n-nodes-vidopi

An n8n custom node package for interacting with the Vidopi video processing API. This package provides nodes for uploading videos, cutting segments, merging videos, resizing videos, and checking task status.

## Features

- **Upload Video**: Upload video files for processing and get public links
- **Cut Video**: Cut a segment from a video by specifying start and end times
- **Merge Videos**: Merge two videos together into a single video file
- **Resize Video**: Resize video dimensions by specifying width and height
- **Task Status**: Check the status and get results of asynchronous video processing tasks

## Installation

### For n8n Users

1. In n8n, click your profile icon, choose **Settings**, then open **Community Nodes**.
2. Click **Install**, enter the npm package name `npm-package-name-placeholder`, and confirm the installation.
3. Restart your n8n instance to load the new nodes.
4. Configure your Vidopi API credentials:
   - Go to Credentials in n8n
   - Add a new "Vidopi API" credential
   - Enter your API key (get your API key from https://vidopi.com - free tier available)
   - The base URL is automatically set to https://api.vidopi.com
   - Save the credentials
5. Use the nodes in your workflows:
   - Search for "Vidopi" in the node palette
   - Select the appropriate node (Upload Video, Cut Video, Merge Videos, Resize Video, or Task Status)
   - Configure the node parameters
   - Connect to your Vidopi API credentials

## Available Nodes

### Upload Video

Upload video files for processing. Get a public link to use in other operations.

**Parameters:**
- **Video File** (required): URL or file path of the video to upload
- **Public Link** (optional): Whether to generate a public link for the uploaded video

**Endpoint:** `POST /upload-video/`

### Cut Video

Cut a segment from a video by specifying start and end times in seconds.

**Parameters:**
- **Video URL** (required): Public link or URL of the video to cut
- **Start Time** (required): Start time in seconds for the cut segment
- **End Time** (required): End time in seconds for the cut segment
- **Output Format** (optional): Output video format (mp4, avi, mov, etc.)

**Endpoint:** `POST /cut-video/`

### Merge Videos

Merge two videos together into a single video file.

**Parameters:**
- **First Video URL** (required): Public link or URL of the first video
- **Second Video URL** (required): Public link or URL of the second video
- **Output Format** (optional): Output video format (mp4, avi, mov, etc.)
- **Merge Order** (optional): How to merge the videos (sequential or side by side)

**Endpoint:** `POST /merge-video/`

### Resize Video

Resize video dimensions by specifying width and height in pixels.

**Parameters:**
- **Video URL** (required): Public link or URL of the video to resize
- **Width** (required): Width in pixels for the resized video
- **Height** (required): Height in pixels for the resized video
- **Maintain Aspect Ratio** (optional): Whether to maintain the original aspect ratio
- **Output Format** (optional): Output video format (mp4, avi, mov, etc.)

**Endpoint:** `POST /resize-video/`

### Task Status

Check the status and get results of asynchronous video processing tasks.

**Parameters:**
- **Task ID** (required): The task ID returned from a video processing operation

**Endpoint:** `GET /task-status/{task_id}`

## API Configuration

All nodes require Vidopi API credentials:

- **API Key**: Your Vidopi API key. Get your API key from [https://vidopi.com](https://vidopi.com) - they offer a free tier which works for most projects
- **Base URL**: Fixed to https://api.vidopi.com (users cannot change this)

## Usage Examples

### Example 1: Upload and Cut a Video

1. Use the **Upload Video** node to upload your video file
2. Extract the public link from the response
3. Use the **Cut Video** node with the public link, start time, and end time
4. Use the **Task Status** node to check the processing status

### Example 2: Merge Two Videos

1. Upload two videos using the **Upload Video** node
2. Extract the public links from both responses
3. Use the **Merge Videos** node with both video URLs
4. Check the task status to get the merged video

### Example 3: Resize a Video

1. Upload a video using the **Upload Video** node
2. Extract the public link from the response
3. Use the **Resize Video** node with the video URL and desired dimensions
4. Check the task status to get the resized video

## Publishing to npm

To publish this package to npm:

1. Ensure you're logged in to npm:
   ```bash
   npm login
   ```

2. Build the project:
   ```bash
   npm run build
   ```

3. Publish the package:
   ```bash
   npm publish
   ```

## License

MIT

## Support

For issues, questions, or contributions, please visit the repository or contact the maintainers.
