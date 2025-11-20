# Pump.fun Livestream API Reverse Engineering

## Overview
This document details the reverse engineering of Pump.fun's livestream API architecture and the complete flow for accessing live video streams.

## Key Findings

### Streaming Technology
- **LiveKit**: Pump.fun uses LiveKit, a WebRTC-based video streaming platform
- **No HLS URLs**: The system does not use traditional HTTP Live Streaming (HLS) URLs
- **WebRTC Protocol**: Streams are delivered via WebRTC for real-time, low-latency viewing
- **JWT Authentication**: Access is controlled via JSON Web Tokens

### API Architecture
- RESTful API for stream discovery and authentication
- WebSocket connections via LiveKit for actual video streaming
- Geographically distributed servers for optimal performance

## Complete API Flow

### Step 1: Get Livestream Information
**Endpoint**: `GET https://livestream-api.pump.fun/livestream?mintId={COIN_MINT_ID}`

**Purpose**: Retrieve basic stream information including live status, creator info, and metadata

**Response Structure**:
```json
{
  "id": 1624631,
  "supabaseId": 1624631,
  "mintId": "NnUbTWuHsLLaG4AE4MzYNxMRt3D5Zzn5d36boEPpump",
  "creatorAddress": "2KMR4YqX7QWf8LK9AGVBzg2hiYJQZxnCfCRtSwpFs3P1",
  "streamStartTimestamp": 1763604956911,
  "numParticipants": 26,
  "maxParticipants": 0,
  "isLive": true,
  "thumbnail": "https://thumbnails.pump.fun/1624631/1763606368815.jpeg",
  "thumbnailUpdatedAt": 1763606368815,
  "downrankScore": 0,
  "mode": "view-only"
}
```

### Step 2: Join Livestream (Get JWT Token)
**Endpoint**: `POST https://livestream-api.pump.fun/livestream/join`

**Purpose**: Authenticate with the stream and obtain a JWT token for LiveKit access

**Request Body**:
```json
{
  "mintId": "NnUbTWuHsLLaG4AE4MzYNxMRt3D5Zzn5d36boEPpump",
  "viewer": true
}
```

**Response Structure**:
```json
{
  "token": "eyJhbGciOiJIUzI1NiJ9.eyJ2aWRlbyI6eyJyb29tSm9pbiI6dHJ1ZSwicm9vbUNyZWF0ZSI6ZmFsc2UsImNhblB1Ymxpc2giOnRydWUsImNhblN1YnNjcmliYmVEYXRhIjp0cnVlLCJyb29tIjoibGl2ZXN0cmVhbTpOblViVFd1SHNMTGFHNEFFNM2ZYXhNU1J0M0Q1WnpuNWQzNmJvRVBwdW1wOjE2MjQ2MzEiLCJoaWRkZW4iOmZhbHNlfSwiaXNzIjoiQVBJZFVSVmZSSmpWTzlzUCIsImV4cCI6MTc2MjU2NDUwMDg5ODg3M2wibmJmIjowLCJzdWIiOiJlYjI5ZDYxZSJ9.MudTb7VH2kY3RDK0_--WpPwxLAXZcGmsse1Mx_5Xrlg",
  "role": "viewer"
}
```

### Step 3: Get LiveKit Server Regions
**Endpoint**: `GET https://pump-prod-tg2x8veh.livekit.cloud/settings/regions`

**Headers**: `Authorization: Bearer {JWT_TOKEN_FROM_STEP_2}`

**Purpose**: Retrieve optimal server regions based on geographical location

**Response Structure**:
```json
{
  "regions": [
    {
      "region": "osanjose1a",
      "url": "https://pump-prod-tg2x8veh.osanjose1a.production.livekit.cloud",
      "distance": "911231"
    },
    {
      "region": "ophoenix1a",
      "url": "https://pump-prod-tg2x8veh.ophoenix1a.production.livekit.cloud",
      "distance": "1618733"
    },
    // ... more regions
  ]
}
```

### Step 4: Connect to LiveKit Room
**Connection**: WebSocket to `wss://{REGION_URL}/rtc?room={ROOM_NAME}&token={JWT_TOKEN}`

**Room Name Format**: Extracted from JWT token: `livestream:{MINT_ID}:{STREAM_ID}`

**Example**: `livestream:NnUbTWuHsLLaG4AE4MzYNxMRt3D5Zzn5d36boEPpump:1624631`

## JWT Token Structure

The JWT token contains the following payload:
```json
{
  "video": {
    "roomJoin": true,
    "roomCreate": false,
    "canPublish": false,
    "canSubscribe": true,
    "canPublishData": true,
    "room": "livestream:NnUbTWuHsLLaG4AE4MzYNxMRt3D5Zzn5d36boEPpump:1624631",
    "hidden": false
  },
  "iss": "APIIdURVfRJjV9sP",
  "exp": 1763692828,
  "nbf": 0,
  "sub": "eb29d61e"
}
```

## Important Notes

### Security Considerations
- **JWT Expiration**: Tokens expire in approximately 7 days from issuance
- **Viewer-Only Access**: Cannot publish video without additional permissions
- **Room-Based Access**: Each stream has a unique room identifier
- **IP Restrictions**: Tokens may be bound to specific IP addresses

### Technical Limitations
- **No Direct Video Downloads**: No HLS or MP4 URLs available for download
- **Real-time Only**: System designed for live viewing, not recording/archive access
- **WebRTC Dependencies**: Requires LiveKit client SDK implementation
- **Bandwidth Requirements**: WebRTC streams require stable internet connections

## Integration Approach

To build a client that can access Pump.fun livestreams, you would need to:

1. **Implement LiveKit Client SDK**
   - Use official LiveKit SDK or implement WebRTC client
   - Handle WebSocket connections and WebRTC signaling

2. **Authentication Flow**
   - Make POST request to join endpoint
   - Store and refresh JWT tokens as needed
   - Include proper authorization headers

3. **Connection Management**
   - Select optimal server region based on distance
   - Establish WebSocket connection with proper parameters
   - Handle connection failures and retries

4. **Video Processing**
   - Decode WebRTC video streams
   - Handle audio/video synchronization
   - Manage participant tracks and screen sharing

## API Error Handling

### Common HTTP Status Codes
- `200`: Success
- `201`: Created (successful join)
- `401`: Unauthorized (invalid/expired JWT)
- `403`: Forbidden (insufficient permissions)
- `404`: Not found (invalid stream ID)
- `429`: Too many requests (rate limited)

### LiveKit Connection Errors
- Connection refused: Invalid JWT or room name
- Authentication failed: Expired or malformed token
- Server unavailable: Region offline or overloaded

## Performance Considerations

### Optimal Region Selection
- Choose the server with the smallest distance value
- Consider server load and availability
- Fall back to alternative regions if primary fails

### Connection Optimization
- Use WebSocket compression where available
- Implement adaptive bitrate streaming
- Handle network interruptions gracefully

## Security Recommendations

### Token Management
- Store JWT tokens securely (not in localStorage)
- Implement token refresh before expiration
- Validate token signatures server-side when possible

### Access Control
- Implement proper permission checks
- Rate limit API calls to prevent abuse
- Monitor for suspicious connection patterns

## Conclusion

Pump.fun's livestream API uses a modern, WebRTC-based architecture that prioritizes low-latency real-time viewing over traditional video download capabilities. While this makes the system excellent for live trading streams where timing is critical, it also means that straightforward video downloading or recording is not possible through the official API.

The authentication system is robust with JWT-based access control, and the distributed server architecture ensures good performance globally. For developers looking to integrate with this system, implementing a full LiveKit client would be necessary to access the video streams.

This reverse engineering was conducted through analysis of web browser network requests and DOM inspection to identify the streaming technology and API endpoints used by the official Pump.fun website.