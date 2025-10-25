# Fast YouTube to MP3 Converter API

Optimized YouTube to MP3 converter API for DecodeBars transcription system.

## Features

- ✅ Fast YouTube metadata extraction
- ✅ High-quality audio streaming
- ✅ CORS enabled for web apps
- ✅ Error handling and retry logic
- ✅ Optimized for battle rap transcription

## API Endpoints

### Convert YouTube URL
```
GET /api/convert?url={youtube_url}
```

Response:
```json
{
  "success": true,
  "title": "LOADED LUX VS RUM NITTY | URLTV",
  "duration": 3245,
  "downloadUrl": "https://api.example.com/download/GHRVUjn09Jk",
  "channel": "Ultimate Rap League",
  "videoId": "GHRVUjn09Jk"
}
```

### Download MP3
```
GET /download/{videoId}
```

Streams the audio as MP3 format.

## Deployment

### Fly.io
```bash
fly launch --name fastconverter-decodebars
fly deploy
```

### Local Development
```bash
npm install
npm start
```

## Integration with DecodeBars

Add to your `.env.local`:
```env
ENABLE_EXTERNAL_CONVERTER=true
FAST_CONVERTER_API_URL=https://your-app.fly.dev/api/convert
```

## License

MIT - Built for DecodeBars transcription system