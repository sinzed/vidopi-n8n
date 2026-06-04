# n8n-nodes-vidopi

An n8n community node package for the [Vidopi](https://vidopi.com) video processing API.

## Nodes

| Node | Type | Purpose |
|------|------|---------|
| **Vidopi** | Action | Upload and process videos (cut, merge, resize, crop, rotate, speed, compress, audio, overlays, thumbnails), file info, and task status |
| **Vidopi Trigger** | Trigger | Receive webhook callbacks when async processing completes |

## Installation

1. In n8n, open **Settings** → **Community Nodes** → **Install**.
2. Enter `n8n-nodes-vidopi` and confirm.
3. Restart n8n if prompted.
4. Create **Vidopi API** credentials with your API key from [vidopi.com](https://vidopi.com).

## Vidopi (action node)

Use **Resource** and **Operation** to choose what to run.

### Video → Upload

Upload binary video data from a previous node using the presigned upload flow (init → direct upload to Cloudflare R2 → complete). Supported formats: MP4, AVI, MOV, MKV, WMV, FLV (max 500MB).

- **Binary Property**: binary field name (default: `data`)

### Video → Async processing (Cut, Merge, Resize, Crop, Rotate, Speed, Compress, Extract Audio, Compose Audio, Image/Text Overlay, Generate Thumbnail)

These operations are asynchronous. They require a **Callback Webhook URL** from the **Vidopi Trigger** node.

1. Add **Vidopi Trigger** to the workflow and activate it.
2. Copy the trigger’s **Production URL** from the Vidopi Trigger node and paste it into **Callback Webhook URL** on the Vidopi action node.
3. Run the Vidopi action with that URL.
4. When Vidopi finishes, it POSTs to the trigger and the workflow continues.

**Crop** uses a **File ID** (from upload or **File → Get Info**), not a public URL.

### File → Get Info

Returns metadata for an uploaded file by **File ID**.

### Task → Get Status

Poll or fetch status for a task ID returned by any async video operation.

- **Wait For Completion**: poll until done or return immediately

## Example workflow (async cut)

```
[Vidopi Trigger]  ←── webhook from Vidopi API
       ↓
[Vidopi: Video / Cut]  → uses trigger webhook URL, returns task_id
```

For polling instead of webhooks, use **Task → Get Status** with **Wait For Completion** enabled.

## Breaking changes in v2.0.0

Community review requires a single action node plus one trigger:

- Removed separate nodes: Upload Video, Cut Video, Merge Videos, Resize Video, Task Status, Vidopi Wait.
- Use **Vidopi** with Resource/Operation instead.
- Use **Vidopi Trigger** instead of Vidopi Wait / `$execution.resumeUrl` for async callbacks.

## Publishing to npm

Releases are published via [GitHub Actions](.github/workflows/publish.yml) with [npm provenance](https://docs.npmjs.com/generating-provenance-statements) (required for n8n verified community nodes from May 2026).

1. Configure an npm [Trusted Publisher](https://docs.npmjs.com/trusted-publishers) for `sinzed/vidopi-n8n` workflow `publish.yml`, or set `NPM_TOKEN` in GitHub Actions secrets.
2. Bump `version` in `package.json` and commit.
3. Tag and push: `git tag 2.0.2 && git push origin main && git push origin 2.0.2`

## License

MIT
