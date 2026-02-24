# Stock Images for Effect/Transition Previews

## Required Images

Download these professional stock photos and place them in this directory:

### 1. city-sunset.jpg
- **Subject**: City skyline at golden hour/sunset
- **Recommended source**: Unsplash photo by [Jared Erondu](https://unsplash.com/photos/j4PaE7E2_Ws)
- **Direct URL**: https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=400&h=300&fit=crop&q=80
- **Dimensions**: 400x300px (4:3 aspect ratio)
- **Description**: Urban cityscape with buildings, warm sunset colors

### 2. mountain-landscape.jpg
- **Subject**: Mountain landscape with dramatic scenery
- **Recommended source**: Unsplash photo by [Qingbao Meng](https://unsplash.com/photos/01_igFr7hd4)
- **Direct URL**: https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=300&fit=crop&q=80
- **Dimensions**: 400x300px (4:3 aspect ratio)
- **Description**: Natural landscape with mountains, contrasting with city scene

### 3. portrait.jpg (optional - for future use)
- **Subject**: Professional portrait
- **Recommended source**: Unsplash photo by [Brooke Cagle](https://unsplash.com/photos/g1Kr4Ozfoac)
- **Direct URL**: https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=300&fit=crop&q=80
- **Dimensions**: 400x300px (4:3 aspect ratio)
- **Description**: Professional headshot/portrait for model-based effects

## Download Instructions

```bash
# Using curl (macOS/Linux)
curl -o city-sunset.jpg "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=400&h=300&fit=crop&q=80"
curl -o mountain-landscape.jpg "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=300&fit=crop&q=80"
curl -o portrait.jpg "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=300&fit=crop&q=80"
```

```powershell
# Using PowerShell (Windows)
Invoke-WebRequest -Uri "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=400&h=300&fit=crop&q=80" -OutFile "city-sunset.jpg"
Invoke-WebRequest -Uri "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=300&fit=crop&q=80" -OutFile "mountain-landscape.jpg"
Invoke-WebRequest -Uri "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=300&fit=crop&q=80" -OutFile "portrait.jpg"
```

## License

All images from Unsplash are free to use under the [Unsplash License](https://unsplash.com/license):
- Free to use for commercial and non-commercial purposes
- No permission needed
- Attribution appreciated but not required

## Why Local Images?

1. **No CORS issues** - Works in Tauri production builds
2. **No network dependency** - Works offline
3. **Instant loading** - No HTTP requests
4. **No rate limiting** - Unsplash API has rate limits
5. **Production reliability** - Guaranteed to work
