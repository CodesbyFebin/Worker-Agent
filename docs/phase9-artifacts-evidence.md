# Phase 9 — Artifacts and evidence

## What landed

- **S3-compatible object storage** via `@aws-sdk/client-s3` (MinIO/AWS) with **local filesystem fallback** when `S3_*` unset
- **Artifact versioning** (`artifacts` + `artifact_versions` with sha256 checksums)
- **Evidence snapshots** frozen from real `verifyClaim` results (+ JSON blob artifact)
- **Evidence sources** with live **freshness** decay (half-life 72h)
- **Retrieval** across claims / sources / artifacts
- Claim Ledger verify paths auto-create snapshots when tables exist
- **Evidence** / **Claim Ledger** nav → tabs: Claims · Artifacts · Snapshots · Retrieval

## Env

```bash
# Optional — omit to use .artifacts/object-store/
S3_ENDPOINT=http://127.0.0.1:9000
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin
S3_BUCKET=worker-agent-artifacts
S3_REGION=us-east-1
```

Docker Compose already includes MinIO (`:9000` / console `:9001`).

## Files

- `server/services/artifacts/{objectStore,service}.ts`
- `server/routers/artifacts.router.ts`
- `drizzle/sql/phase9_artifacts_evidence.sql`
- `client/src/features/evidence/EvidenceArtifactsWorkspace.tsx`

## How to try

1. `node --env-file=.env scripts/apply-phase9-sql.mjs`
2. Restart API (permissions)
3. **Evidence** → Artifacts → store a text file
4. Claims → verify, or Snapshots → Capture on a claim
5. Retrieval → search; Snapshots → check freshness / stale list

## Remaining limits

- Text upload UI is text-only via tRPC (no multipart browser upload yet)
- No signed URL download API (readVersion returns UTF-8 for text)
- Freshness is time-decay only — does not re-fetch pages automatically
- S3 bucket auto-create may fail on locked-down AWS accounts (create bucket manually)
