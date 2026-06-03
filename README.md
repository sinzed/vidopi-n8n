# n8n-nodes-vidopi

An n8n community node package for the [Vidopi](https://vidopi.com) video processing API.

## Nodes

| Node | Type | Purpose |
|------|------|---------|
| **Vidopi** | Action | Upload, cut, merge, resize videos, and check task status |
| **Vidopi Trigger** | Trigger | Receive webhook callbacks when async processing completes |

## Installation

1. In n8n, open **Settings** → **Community Nodes** → **Install**.
2. Enter `n8n-nodes-vidopi` and confirm.
3. Restart n8n if prompted.
4. Create **Vidopi API** credentials with your API key from [vidopi.com](https://vidopi.com).

## Vidopi (action node)

Use **Resource** and **Operation** to choose what to run.

### Video → Upload

Upload binary video data from a previous node.

- **Binary Property**: binary field name (default: `data`)

### Video → Cut / Merge / Resize

These operations are asynchronous. They require a **Callback Webhook URL** from the **Vidopi Trigger** node.

1. Add **Vidopi Trigger** to the workflow and activate it.
2. Copy the trigger’s production webhook URL (or use the default expression `={{ $node["Vidopi Trigger"].webhookUrl }}`).
3. Run the Vidopi action (cut, merge, or resize) with that URL.
4. When Vidopi finishes, it POSTs to the trigger and the workflow continues.

### Task → Get Status

Poll or fetch status for a task ID returned by cut, merge, or resize.

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

## License

MIT
