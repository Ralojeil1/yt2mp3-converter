const express = require('express');
const ytdl = require('ytdl-core');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware with CORS configuration for Chrome extension
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://yt2mp3-converter-auum.onrender.com',
    'chrome-extension://*'  // Allow all Chrome extensions
  ],
  credentials: true
}));
app.use(express.json());

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Ensure downloads directory exists
const downloadsDir = path.join(__dirname, 'downloads');
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir);
}

// Function to check if yt-dlp is available
function isYtDlpAvailable() {
  return new Promise((resolve) => {
    exec('yt-dlp --version', (error, stdout, stderr) => {
      console.log('yt-dlp check - error:', error, 'stdout:', stdout, 'stderr:', stderr);
      resolve(!error);
    });
  });
}

// Function to check if youtube-dl is available
function isYoutubeDlAvailable() {
  return new Promise((resolve) => {
    exec('youtube-dl --version', (error, stdout, stderr) => {
      console.log('youtube-dl check - error:', error, 'stdout:', stdout, 'stderr:', stderr);
      resolve(!error);
    });
  });
}

// Function to convert using a simple approach with better error handling
async function convertVideo(url, filepath) {
  return new Promise((resolve, reject) => {
    console.log('Converting video with fallback approach...');
    
    // Try a simpler approach first
    try {
      const videoStream = ytdl(url, {
        filter: 'audioonly',
        quality: 'highestaudio',
        highWaterMark: 1 << 25, // Increase buffer size
        requestOptions: {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        }
      });
      
      let timeoutId;
      
      // Set a timeout to prevent hanging
      timeoutId = setTimeout(() => {
        console.log('Conversion timeout - cleaning up');
        if (fs.existsSync(filepath)) {
          fs.unlinkSync(filepath);
        }
        reject(new Error('Conversion timed out - this may indicate the video requires authentication or is not accessible'));
      }, 90000); // 90 second timeout
      
      videoStream.on('error', (err) => {
        clearTimeout(timeoutId);
        console.error('Video stream error:', err.message);
        
        // Check for specific error conditions
        if (err.message.includes('Status code: 410') || err.message.includes('410')) {
          reject(new Error('This video may require authentication or is not publicly accessible. YouTube often restricts automated access to certain content.'));
        } else if (err.message.includes('Sign in to confirm you') || 
                   err.message.includes('bot') ||
                   err.message.includes('authenticate')) {
          reject(new Error('This video requires authentication/sign-in. YouTube restricts automated downloading of protected content.'));
        } else {
          reject(new Error('Failed to access video: ' + err.message));
        }
      });
      
      const fileStream = fs.createWriteStream(filepath);
      
      fileStream.on('error', (err) => {
        clearTimeout(timeoutId);
        console.error('File stream error:', err);
        reject(new Error('Failed to save file: ' + err.message));
      });
      
      fileStream.on('finish', () => {
        clearTimeout(timeoutId);
        console.log('File saved successfully');
        resolve();
      });
      
      videoStream.pipe(fileStream);
      
    } catch (error) {
      console.error('Conversion error:', error);
      reject(new Error('Conversion failed: ' + error.message));
    }
  });
}

// API Routes
app.post('/convert', async (req, res) => {
  try {
    const { url } = req.body;
    console.log('Received conversion request for URL:', url);
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    
    if (!ytdl.validateURL(url)) {
      console.log('Invalid YouTube URL provided:', url);
      return res.status(400).json({ error: 'Invalid YouTube URL' });
    }
    
    // Generate filename
    const timestamp = Date.now();
    const filename = `video_${timestamp}.mp3`;
    const filepath = path.join(downloadsDir, filename);
    
    // Try conversion with improved error handling
    console.log('Trying conversion...');
    try {
      await convertVideo(url, filepath);
      
      // If successful, return response
      if (!res.headersSent) {
        try {
          // Get file size
          const stats = fs.statSync(filepath);
          const fileSizeInBytes = stats.size;
          const fileSizeInMB = (fileSizeInBytes / (1024 * 1024)).toFixed(2);
          
          res.json({ 
            success: true, 
            filename: filename,
            downloadUrl: `/download/${encodeURIComponent(filename)}`,
            fileSize: fileSizeInMB
          });
        } catch (fileError) {
          console.error('Error getting file stats:', fileError);
          res.status(500).json({ error: 'Failed to get file information: ' + fileError.message });
        }
      }
      return;
    } catch (conversionError) {
      console.error('Conversion failed:', conversionError.message);
      
      // Clean up failed file if it exists
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
      
      // Return appropriate error message
      return res.status(403).json({ 
        error: conversionError.message 
      });
    }
  } catch (error) {
    console.error('Conversion error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Conversion failed: ' + error.message });
    }
  }
});

app.get('/download/:filename', (req, res) => {
  try {
    const filename = decodeURIComponent(req.params.filename);
    const filepath = path.join(downloadsDir, filename);
    
    console.log('Download request for:', filename);
    
    if (!fs.existsSync(filepath)) {
      console.log('File not found:', filepath);
      return res.status(404).json({ error: 'File not found' });
    }
    
    console.log('Sending file:', filepath);
    res.download(filepath, filename, (err) => {
      if (err) {
        console.error('Download error:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Download failed: ' + err.message });
        }
      }
    });
  } catch (error) {
    console.error('Download error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Download failed: ' + error.message });
    }
  }
});

// Serve the frontend for any non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});