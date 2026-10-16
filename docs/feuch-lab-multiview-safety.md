# Multi-view Feuch Lab GLB — safe rollout

Branch: `feature/creature-sync-multiview-safety`. This is **not deployed**.

## What changed
- `POST /generate` accepts either `{ "intent": "..." }` (existing text-to-3D) or `{ "intent": "Creature-Sync Console", "imageUrls": ["data:image/png;base64,...", "..."] }`.
- Images mode calls **Meshy multi-image-to-3d v1**, using the first reference as front view; 1–4 views. Other providers are rejected explicitly (mock permitted for tests).
- Responses still carry a job id, and the same /jobs API streams GLB after completion; the provider id `meshy-multi` prevents accidental use of text-to-3D polling.
- The cockpit lets you select 1–4 images (PNG/JPEG/WebP, max 5MB each), records intent, and downloads a GLB with authorization.

## Security and budget: fail-closed
1. `GENERATION_ENABLED=false` by default. Enable only after reviewing the Worker.
2. Supply a strong `GENERATION_API_TOKEN` (minimum 24 characters) through Wrangler secrets. All generation, job lookup and GLB downloads require `Authorization: Bearer <token>`. Cockpit keeps this token in sessionStorage, not URL or localStorage.
3. `THREE_D_PROVIDER=mock` by default. Real multi-view mode needs `THREE_D_PROVIDER=meshy` plus `THREE_D_API_KEY` stored as Wrangler secret.
4. `PAID_GENERATION_ENABLED=false` by default. Enabling it also requires the `PAID_GENERATION_GUARD` Durable Object binding; otherwise calls fail closed.
5. `MAX_PAID_JOBS_PER_DAY=1` by default, capped in code to 10. The Durable Object atomically reserves tasks per UTC day. Failed jobs count. **This is a task limit, not a precise financial spending cap:** credit prices may vary.
6. The image path bypasses Octopus `content.generate`, which currently needs an external executor. The existing text path remains unchanged when explicitly enabled.

## No-cost local smoke test
- `npm ci && npm run typecheck && npm test`
- `npm run dev` with `.dev.vars` configured as: `GENERATION_ENABLED=true`, a strong local token, `THREE_D_PROVIDER=mock`, `OCTOPUS_ENGINE_MOCK=true`, `PAID_GENERATION_ENABLED=false`.
- In cockpit Settings, set Worker base URL and token. Choose "Multi-view image-to-3D", add a front image (and up to 3 other views), then generate. The mock GLB is a small triangle **only**, not the console.
- Do not enable Meshy or paid generation until you are ready to spend credits.

## Creature-Sync reference preparation
Use **individual isolated object views** (front first, back, left, right) rather than uploading an entire multi-panel sheet as one image. The current generation illustrations are concept references, not perfectly consistent orthographic photographs. The generated GLB will need geometry/material/texture inspection before importing into a game engine.

## Deliberate limits
- No automatic paid runs, no deployment, no external image hosting, no changes to other repos.
- No permanent storage of the resulting GLB in this patch; download promptly after completion.
- No real provider smoke test without explicit separate approval and verified secrets.
- Scene persistence and Unity bridge hardening remain future work.
