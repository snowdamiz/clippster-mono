# Template package security

Templates are declarative data and media only. JavaScript, JSX, WASM, shaders, plugins, native binaries, shell commands, and caller-supplied FFmpeg arguments are forbidden.

`inspectTemplateArchive` enforces initial limits of 100 MiB compressed, 500 MiB expanded, 250 MiB per entry, 2,000 entries, 12 path segments, and 100:1 expansion. Load testing must justify changes.

Before extraction:

- reject encrypted/nested archives, links, devices, absolute/drive/UNC/ADS paths, `..`, NULs, duplicate/confusable normalized paths, bombs, and excessive depth/count/size;
- extract into a fresh staging directory and canonicalize every destination beneath it;
- verify declared size and SHA-256, detect MIME from bytes, enforce parser limits, scan, then atomically promote;
- render untrusted media without network or broad Tauri capabilities.

Remote asset URLs are disabled by default. Any future opt-in remote import must validate HTTP(S), DNS and every redirect, block private/loopback/link-local/metadata addresses, and enforce strict time/byte limits.

Required hostile fixtures include traversal, drive/UNC/ADS, links/devices, flat/nested bombs, malformed central directories/media/fonts/LUTs, MIME spoofing, hash mismatch, unsupported schemas, and interrupted staging.
