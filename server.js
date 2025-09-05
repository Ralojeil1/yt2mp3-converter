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

// Function to get video info using ytdl-core
async function getVideoInfoWithYtdl(url) {
  try {
    console.log('Getting video info with ytdl-core...');
    const info = await ytdl.getInfo(url);
    console.log('Video info retrieved successfully with ytdl-core');
    return {
      title: info.videoDetails.title,
      duration: info.videoDetails.lengthSeconds,
      thumbnail: info.videoDetails.thumbnails[0]?.url || ''
    };
  } catch (error) {
    console.error('Error getting video info with ytdl-core:', error);
    throw error;
  }
}

// Function to convert using ytdl-core
function convertWithYtdl(url, filepath, res) {
  return new Promise((resolve, reject) => {
    console.log('Converting with ytdl-core...');
    
    // Create audio stream
    const audioStream = ytdl(url, {
      filter: 'audioonly',
      quality: 'highestaudio',
      highWaterMark: 1 << 25 // Increase buffer size for better performance
    });
    
    // Handle audio stream errors
    audioStream.on('error', (err) => {
      console.error('Audio stream error:', err);
      reject(new Error('Failed to download audio: ' + err.message));
    });
    
    // Create write stream
    const fileStream = fs.createWriteStream(filepath);
    
    // Handle file stream errors
    fileStream.on('error', (err) => {
      console.error('File stream error:', err);
      reject(new Error('Failed to save file: ' + err.message));
    });
    
    // Pipe audio to file
    audioStream.pipe(fileStream);
    
    fileStream.on('finish', () => {
      console.log('File saved successfully with ytdl-core:', filepath);
      fileStream.end();
      resolve();
    });
    
    // Add timeout to prevent hanging
    setTimeout(() => {
      console.log('ytdl-core conversion timeout');
      // Clean up potentially incomplete file
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
      reject(new Error('Conversion timed out with ytdl-core'));
    }, 120000); // 120 second timeout (2 minutes)
  });
}

// Function to convert using yt-dlp
function convertWithYtDlp(url, filepath, res) {
  return new Promise((resolve, reject) => {
    console.log('Converting with yt-dlp...');
    
    // Use yt-dlp to download and convert with higher quality
    const command = `yt-dlp -f bestaudio -x --audio-format mp3 --audio-quality 0 --output "${filepath}" "${url}"`;
    console.log('Executing yt-dlp command:', command);
    
    const ytDlpProcess = exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error('yt-dlp error:', error);
        console.error('yt-dlp stderr:', stderr);
        // Clean up potentially incomplete file
        if (fs.existsSync(filepath)) {
          fs.unlinkSync(filepath);
        }
        reject(new Error('Conversion failed with yt-dlp: ' + (stderr || error.message)));
        return;
      }
      
      console.log('yt-dlp success:', stdout);
      // Check if file was created
      if (!fs.existsSync(filepath)) {
        reject(new Error('File was not created with yt-dlp'));
        return;
      }
      
      resolve();
    });
    
    // Add timeout for yt-dlp process
    setTimeout(() => {
      console.log('yt-dlp conversion timeout');
      // Kill the process if it's still running
      ytDlpProcess.kill();
      // Clean up potentially incomplete file
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
      reject(new Error('Conversion timed out with yt-dlp'));
    }, 120000); // 120 second timeout (2 minutes)
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
    
    // Try ytdl-core first
    console.log('Trying ytdl-core...');
    try {
      await convertWithYtdl(url, filepath, res);
      
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
    } catch (ytdlError) {
      console.error('ytdl-core failed:', ytdlError.message);
      
      // Clean up failed file if it exists
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
      
      // Check if yt-dlp is available
      const ytDlpAvailable = await isYtDlpAvailable();
      console.log('yt-dlp available:', ytDlpAvailable);
      
      if (!ytDlpAvailable) {
        console.log('yt-dlp is not available on this system');
        return res.status(500).json({ 
          error: 'Both ytdl-core and yt-dlp failed. ytdl-core error: ' + ytdlError.message + '. yt-dlp is not available on this server.' 
        });
      }
      
      // If ytdl-core fails and yt-dlp is available, try yt-dlp as fallback
      console.log('Trying yt-dlp as fallback...');
      try {
        await convertWithYtDlp(url, filepath, res);
        
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
      } catch (ytDlpError) {
        console.error('yt-dlp failed:', ytDlpError.message);
        return res.status(500).json({ 
          error: 'Both ytdl-core and yt-dlp failed. ytdl-core error: ' + ytdlError.message + '. yt-dlp error: ' + ytDlpError.message
        });
      }
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
  
  // Check if yt-dlp is available on startup
  isYtDlpAvailable().then((available) => {
    if (available) {
      console.log('yt-dlp is available on this system');
    } else {
      console.log('yt-dlp is NOT available on this system - only ytdl-core will be used');
    }
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});