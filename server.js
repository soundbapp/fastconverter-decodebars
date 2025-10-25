const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');

const execAsync = promisify(exec);
const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.json({ 
    name: 'Fast YouTube to MP3 Converter API',
    version: '2.0.0',
    status: 'running',
    method: 'yt-dlp',
    endpoints: {
      convert: '/api/convert?url={youtube_url}',
      download: '/download/{id}'
    },
    note: 'Optimized for DecodeBars transcription system - Now using yt-dlp!'
  });
});

// Simple URL validation
function isValidYouTubeURL(url) {
  const ytRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/|v\/)|youtu\.be\/)[\w-]+/;
  return ytRegex.test(url);
}

// Extract video ID from YouTube URL
function extractVideoId(url) {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

// Convert YouTube to MP3 using yt-dlp
app.get('/api/convert', async (req, res) => {
  let tempFile = null;
  
  try {
    const { url } = req.query;
    
    if (!url) {
      return res.status(400).json({ 
        success: false,
        error: 'YouTube URL parameter is required' 
      });
    }

    if (!isValidYouTubeURL(url)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid YouTube URL format' 
      });
    }

    const videoId = extractVideoId(url);
    if (!videoId) {
      return res.status(400).json({ 
        success: false,
        error: 'Could not extract video ID from URL' 
      });
    }

    console.log(`[Converter] Processing: ${url}`);
    console.log(`[Converter] Video ID: ${videoId}`);
    
    // Create temp file path
    const timestamp = Date.now();
    tempFile = `/tmp/ytdlp_${videoId}_${timestamp}.%(ext)s`;
    
    // Use yt-dlp to extract audio directly to MP3 with enhanced options
    const ytdlpCommand = [
      'yt-dlp',
      '--extract-audio',
      '--audio-format', 'mp3',
      '--audio-quality', '128K',
      '--no-playlist',
      '--no-warnings',
      '--cookies-from-browser', 'chrome',
      '--user-agent', '"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"',
      '--add-header', '"Accept-Language:en-US,en;q=0.9"',
      '--add-header', '"Accept:text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"',
      '--add-header', '"Referer:https://www.youtube.com/"',
      '--format', 'bestaudio/best',
      '--output', `"${tempFile}"`,
      `"${url}"`
    ].join(' ');
    
    console.log(`[Converter] Running: ${ytdlpCommand}`);
    
    const { stdout, stderr } = await execAsync(ytdlpCommand, { 
      timeout: 60000, // 60 second timeout
      maxBuffer: 1024 * 1024 * 50 // 50MB buffer
    });
    
    console.log(`[Converter] yt-dlp output:`, stdout);
    if (stderr) console.log(`[Converter] yt-dlp stderr:`, stderr);
    
    // Find the actual output file (yt-dlp replaces %(ext)s with mp3)
    const actualFile = tempFile.replace('.%(ext)s', '.mp3');
    
    if (!fs.existsSync(actualFile)) {
      throw new Error('yt-dlp did not create expected output file');
    }
    
    // Get file info
    const stats = fs.statSync(actualFile);
    const fileSizeMB = (stats.size / 1024 / 1024).toFixed(1);
    
    console.log(`[Converter] ✅ Success: ${fileSizeMB}MB MP3 created`);
    
    // Get basic video info from yt-dlp
    const infoCommand = `yt-dlp --print title --print duration_string "${url}"`;
    let title = 'YouTube Audio';
    let duration = null;
    
    try {
      const { stdout: infoOutput } = await execAsync(infoCommand, { timeout: 10000 });
      const lines = infoOutput.trim().split('\n');
      title = lines[0] || 'YouTube Audio';
      duration = lines[1] || null;
      console.log(`[Converter] Video info - Title: ${title}, Duration: ${duration}`);
    } catch (infoError) {
      console.log(`[Converter] Could not get video info:`, infoError.message);
    }
    
    // Generate download URL
    const downloadUrl = `${req.protocol}://${req.get('host')}/download/${videoId}_${timestamp}`;
    
    res.json({
      success: true,
      title: title,
      duration: duration,
      downloadUrl: downloadUrl,
      videoId: videoId,
      fileSizeMB: parseFloat(fileSizeMB),
      status: 'ready',
      method: 'yt-dlp'
    });

  } catch (error) {
    console.error('[Converter] Error:', error.message);
    
    // Clean up temp file on error
    if (tempFile) {
      const actualFile = tempFile.replace('.%(ext)s', '.mp3');
      if (fs.existsSync(actualFile)) {
        try {
          fs.unlinkSync(actualFile);
          console.log(`[Converter] Cleaned up temp file: ${actualFile}`);
        } catch (cleanupError) {
          console.error(`[Converter] Failed to cleanup: ${cleanupError.message}`);
        }
      }
    }
    
    // Provide helpful error messages
    let errorMessage = 'Failed to process YouTube video';
    if (error.message.includes('unavailable')) {
      errorMessage = 'Video is unavailable or private';
    } else if (error.message.includes('age')) {
      errorMessage = 'Video requires age verification';
    } else if (error.message.includes('timeout')) {
      errorMessage = 'Processing timeout - video may be too long';
    } else if (error.message.includes('network')) {
      errorMessage = 'Network error accessing YouTube';
    }
    
    res.status(500).json({ 
      success: false,
      error: errorMessage,
      details: error.message.substring(0, 200),
      method: 'yt-dlp'
    });
  }
});

// Download MP3 file
app.get('/download/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    
    // Find the file in /tmp
    const tempFiles = fs.readdirSync('/tmp').filter(file => 
      file.includes(fileId) && file.endsWith('.mp3')
    );
    
    if (tempFiles.length === 0) {
      return res.status(404).json({ 
        error: 'File not found or expired',
        note: 'Files are automatically cleaned up after download'
      });
    }
    
    const filePath = path.join('/tmp', tempFiles[0]);
    const stats = fs.statSync(filePath);
    
    console.log(`[Converter] Streaming download: ${filePath} (${(stats.size/1024/1024).toFixed(1)}MB)`);
    
    // Set headers for MP3 download
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', stats.size);
    res.setHeader('Content-Disposition', `attachment; filename="${fileId.split('_')[0]}.mp3"`);
    
    // Stream the file
    const stream = fs.createReadStream(filePath);
    
    stream.on('end', () => {
      console.log(`[Converter] ✅ Download completed: ${fileId}`);
      
      // Clean up file after successful download
      setTimeout(() => {
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`[Converter] Cleaned up file: ${filePath}`);
          }
        } catch (cleanupError) {
          console.error(`[Converter] Cleanup failed: ${cleanupError.message}`);
        }
      }, 1000); // 1 second delay to ensure download completes
    });
    
    stream.on('error', (err) => {
      console.error('[Converter] Stream error:', err.message);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to stream file' });
      }
    });
    
    stream.pipe(res);

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
    available: ['/', '/api/convert', '/download/:fileId']
  });
});

// Cleanup old temp files on startup
function cleanupTempFiles() {
  try {
    const tempFiles = fs.readdirSync('/tmp').filter(file => 
      file.startsWith('ytdlp_') && file.endsWith('.mp3')
    );
    
    tempFiles.forEach(file => {
      const filePath = path.join('/tmp', file);
      const stats = fs.statSync(filePath);
      const ageHours = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60);
      
      if (ageHours > 1) { // Delete files older than 1 hour
        fs.unlinkSync(filePath);
        console.log(`[Converter] Cleaned up old temp file: ${file}`);
      }
    });
  } catch (error) {
    console.error('[Converter] Cleanup error:', error.message);
  }
}

app.listen(PORT, () => {
  console.log(`🚀 Fast YouTube MP3 Converter API v2.0 running on port ${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/`);
  console.log(`🔗 Convert API: http://localhost:${PORT}/api/convert?url=YOUTUBE_URL`);
  console.log('🎵 Now using yt-dlp for robust YouTube downloading!');
  
  // Clean up old temp files
  cleanupTempFiles();
});