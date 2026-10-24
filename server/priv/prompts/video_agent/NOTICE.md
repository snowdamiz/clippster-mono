# Third-party material

`system.md` adapts the method and creative laws of /brag and /brag-slim. `skills/` holds files vendored unchanged from:

| Source | Commit | Licence | Files |
|---|---|---|---|
| [latent-spaces/brag](https://github.com/latent-spaces/brag) | `069432cac935ed1895859df201c31436c07fb74e` | MIT (`licenses/brag-MIT.txt`) | `skills/brag/tones.md` |
| [heygen-com/hyperframes](https://github.com/heygen-com/hyperframes) v0.8.174 | `1d631bf98a2f702b6b1c4469f529523b51dc465a` | Apache 2.0 (`licenses/hyperframes-Apache-2.0.txt`) | `skills/hyperframes-core`, `skills/hyperframes-keyframes`, `skills/hyperframes-animation` (curated subset), `skills/music-to-video` (SKILL, montage, planning) |

The agent loads skills on demand by path without `.md` (for example `hyperframes-core/references/sub-compositions`). When upgrading the `hyperframes` sidecar dependency, re-copy the same files from the matching upstream tag and update the commit above.
