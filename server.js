const express = require('express');
const cors = require('cors');
const ytdl = require('ytdl-core');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.json({ 
    name: 'Fast YouTube to MP3 Converter API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      convert: '/api/convert?url={youtube_url}',
      download: '/download/{id}'
    },
    note: 'Optimized for DecodeBars transcription system'
  });
});

// Convert YouTube to MP3
app.get('/api/convert', async (req, res) => {
  try {
    const { url } = req.query;
    
    if (!url) {
      return res.status(400).json({ 
        success: false,
        error: 'YouTube URL parameter is required' 
      });
    }

    if (!ytdl.validateURL(url)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid YouTube URL format' 
      });
    }

    console.log(`[Converter] Processing: ${url}`);
    
    // Get video info with enhanced options
    const info = await ytdl.getInfo(url, {
      requestOptions: {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        }
      }
    });
    
    const title = info.videoDetails.title;
    const duration = parseInt(info.videoDetails.lengthSeconds);
    const channel = info.videoDetails.author.name;
    
    // Generate download URL
    const videoId = info.videoDetails.videoId;
    const downloadUrl = `${req.protocol}://${req.get('host')}/download/${videoId}`;
    
    console.log(`[Converter] ✅ Success: ${title} (${Math.floor(duration/60)}:${(duration%60).toString().padStart(2,'0')})`);
    
    res.json({
      success: true,
      title: title,
      duration: duration,
      downloadUrl: downloadUrl,
      channel: channel,
      videoId: videoId,
      status: 'ready'
    });

  } catch (error) {
    console.error('[Converter] Error:', error.message);
    
    // Provide helpful error messages
    let errorMessage = 'Failed to process YouTube video';
    if (error.message.includes('403')) {
      errorMessage = 'YouTube blocked the request (403 Forbidden)';
    } else if (error.message.includes('404')) {
      errorMessage = 'Video not found or private';
    } else if (error.message.includes('Sign in to confirm')) {
      errorMessage = 'Video requires age verification';
    }
    
    res.status(500).json({ 
      success: false,
      error: errorMessage,
      details: error.message.substring(0, 200)
    });
  }
});

// Download MP3 stream
app.get('/download/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    
    if (!ytdl.validateURL(url)) {
      return res.status(400).json({ error: 'Invalid video ID' });
    }

    console.log(`[Converter] Streaming download for: ${videoId}`);
    
    // Get video info for filename
    const info = await ytdl.getInfo(url);
    const title = info.videoDetails.title.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
    
    // Set headers for MP3 download
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', `attachment; filename="${title}.mp3"`);
    res.setHeader('Transfer-Encoding', 'chunked');
    
    // Stream highest quality audio
    const audioStream = ytdl(url, { 
      quality: 'highestaudio',
      filter: 'audioonly',
      requestOptions: {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        }
      }
    });
    
    audioStream.on('error', (err) => {
      console.error('[Converter] Stream error:', err.message);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to stream audio' });
      }
    });
    
    audioStream.on('end', () => {
      console.log(`[Converter] ✅ Stream completed: ${title}`);
    });
    
    // Pipe audio stream to response
    audioStream.pipe(res);

  } catch (error) {
    console.error('[Converter] Download error:', error.message);
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Download failed',
        details: error.message.substring(0, 200)
      });
    }
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('[Converter] Unhandled error:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    message: 'Something went wrong on the server'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found',
    available: ['/', '/api/convert', '/download/:videoId']
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Fast YouTube MP3 Converter API running on port ${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/`);
  console.log(`🔗 Convert API: http://localhost:${PORT}/api/convert?url=YOUTUBE_URL`);
  console.log('🎵 Ready to serve DecodeBars transcription requests!');
});