# Export MP4 Timing Refactor

Date: 2026-05-24

## Scope

- Reviewed the frontend MP4 capture path in `frontend/src/dataLayer/event/export.js`.
- Reviewed export API transport in `frontend/src/dataLayer/route/export.js`.
- Reviewed Layer3D deterministic WebGL export timing in `frontend/src/models/layer/3D/model.js`.
- Reviewed Export state flow through `App.vue`, `Grid.vue`, and `imageModel`.
- Reviewed backend MP4 session handling in `backend/model/export_model.py`.

## Changes

- MP4 frame planning now uses the material `Accumulator` with 60 timeline units per second.
- Timeline time and media time are separated:
  - `time` remains the keyframe/timeline domain.
  - `export_time_seconds` drives deterministic Layer3D animation during paused WebGL export.
- Loop exports omit the duplicated endpoint frame to avoid visible loop stutter.
- MP4 session metadata now includes duration, timeline start/end, and timeline units per second.
- Uploaded frames now carry media seconds in addition to timeline time.
- MP4 preview image now uses the first frame, matching the loop start state.

## Notes

- Backend files changed, so the running backend must be restarted manually before the new MP4 session arguments and preview behavior are active.

## Verification

- `python -m py_compile backend/model/export_model.py backend/config/api/parameter.py` passed.
- `npm run build` passed with the existing Sass/Browserslist/asset-size warnings.
