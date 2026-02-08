import re

with open('client/src-tauri/src/video_server.rs', 'r') as f:
    content = f.read()

# Replace the CORS configuration
old = 'allow_headers(vec!["Content-Type", "Range"]);'
new = 'allow_headers(vec!["Content-Type", "Range", "Accept", "Origin"])\n        .expose_headers(vec!["Content-Range", "Content-Length", "Accept-Ranges"]);'

content = content.replace(old, new)

with open('client/src-tauri/src/video_server.rs', 'w') as f:
    f.write(content)

print('CORS fix applied successfully')
