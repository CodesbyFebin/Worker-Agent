# Workers

Background workers process long-running tasks using BullMQ + Redis.

## Worker Process

The worker is a separate Node.js process that registers BullMQ processors:

- **god-machine-chain** — Agent chain execution
- **campaign-day** — Scheduled daily campaign processing
- **scheduled-publish** — YouTube/video publishing
- **workflow-step** — Workflow step execution
- **youtube-analytics** — YouTube analytics processing
- **python-transcription** — Audio transcription (Python)
- **python-audio-analysis** — Audio analysis (Python)
- **python-thumbnail-score** — Thumbnail analysis (Python)

## Job Model

Each job has:

- Unique ID
- Organization scoping
- Input payload
- Status tracking
- Result storage
- Error/retry handling
- Dead letter queue routing

## Starting the Worker

```bash
npm --prefix server run dev:worker
```

## Health

Worker health is monitored via:

- Process status in `/ready`
- Job completion metrics
- Dead letter queue monitoring