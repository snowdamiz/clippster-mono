# AutoFill and beat analysis

AutoFill is a deterministic, replaceable service and is independent from rendering.

Candidate evidence may include existing clip scores/reasons/tags, transcript phrase boundaries, silence/energy, scene/activity and technical quality, orientation, non-identifying subject presence, and user locks. The local baseline does not infer identity, emotion, voiceprints, biometrics, or sensitive traits.

Assignment scores semantic role, duration, technical quality, transcript evidence, orientation, and a seeded deterministic tie-breaker. It enforces media type, bounds, minimum spacing, and required slots; overlapping/repeated ranges are penalized and reused only as a declared fallback. Results preserve alternatives and reason codes such as `semantic-role-match`, `preferred-duration`, `high-technical-score`, and `creator-selected`.

Regeneration changes only unlocked slots. Explicit user choices are locked and never silently discarded.

Beat analysis consumes platform-decoded mono PCM energy frames, estimates onsets/BPM/downbeats, and stores rational positions, confidence, analyzer version, and manual-correction state. Cache keys are source SHA-256 plus analyzer version and normalized decode parameters. Low confidence must warn rather than silently snapping edits.

Optional cloud enhancement requires explicit consent, versioned provider/model/region/purpose/retention disclosure, minimized ranges/proxies, deletion, tenant isolation, and no provider training.
