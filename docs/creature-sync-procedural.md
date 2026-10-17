# Creature-Sync Console — first zero-credit, actually usable GLB

This branch is deliberately isolated from production, and no paid service is
invoked. It is based on the safe multi-image generation feature branch.

## Result
- Provider: `procedural` (explicit opt-in through `THREE_D_PROVIDER=procedural`).
- Body: `{"intent":"Creature-Sync Console"}` posted to `/generate`.
- Status: immediately `succeeded`, with a normal provider job id.
- Read `GET /jobs/:jobId` and download `GET /jobs/:jobId/model.glb`.
- Output: **binary glTF 2.0**, real geometry; simplified command console,
  three spectral displays, two microphones, two vials, control keys,
  sandstone legs, and the Feuch eye.
- No external HTTP request, no Mistral or provider credits.
- Existing `mock`, `meshy`, `meshy-multi`, `tripo` modes unchanged.
- Generation is still **disabled by default**. To test locally set
  `GENERATION_ENABLED=true`, `THREE_D_PROVIDER=procedural`, and
  `GENERATION_API_TOKEN` (minimum 24 characters) in local secrets.
- No deployment, no merge to `main`, no production service modification.

## Example local HTTP flow
```sh
curl -sS -X POST http://127.0.0.1:8787/generate \
  -H "Authorization: Bearer $GENERATION_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"intent":"Creature-Sync Console"}'
# Then use the returned job.id in /jobs/<id>/model.glb with the same token.
```

## Explicit truth boundary
- This deterministic built-in GLB is a **simplified procedural blockout**.
  It does not faithfully reconstruct the ornate design from reference images.
- The richer 355-node textured desktop GLB was generated offline in Python
  from the same concept and is available as a downloadable conversation artifact.
  The native Worker generator and the offline Python generator are distinct
  implementations, and their meshes are not identical.
- Publisher's draft `asset.3d.plan` capability is a *dry-run* bridge to Octopus,
  not a provider of meshes. The structured blueprint is a manually prepared
  local asset contract, not a claim that a production Octopus mission ran.
- Future step: let Publisher/Octopus deliver reviewed structured blueprint
  parameters, then accept only schema-validated changes in procedural provider.

Reference docs:
- Publisher: https://github.com/benoitlub/blacklace-publisher-ai/pull/133
- Metaverse multi-view: https://github.com/benoitlub/metaverse-creator/pull/3
