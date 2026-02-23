# Lessons Learned

## 2026-02-23 - Partial Fix Follow-Through
- Pattern observed: resolving the primary failure mode (freeze) did not guarantee smooth post-action behavior (resize then drag jitter on macOS).
- Preventive rule:
  - For window-management bugs, validate the full interaction chain, not only the initial failure point.
  - Specifically test: resize in/out, release, immediate drag, repeated drag cycles, and maximize/restore transitions.
