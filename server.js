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
    exec('yt-dlp --version', (error) => {
      resolve(!error);
    });
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
    
    // Try ytdl-core first (this should work on Render)
    console.log('Trying ytdl-core...');
    try {
      // Get video info
      console.log('Getting video info...');
      const info = await ytdl.getInfo(url);
      console.log('Video info retrieved successfully');
      
      const title = info.videoDetails.title.replace(/[^\w\s\-\.]/g, ''); // Sanitize title
      // Limit title length to prevent filesystem issues
      const limitedTitle = title.substring(0, 50);
      const filename = `${limitedTitle}_${Date.now()}.mp3`;
      const filepath = path.join(downloadsDir, filename);
      
      console.log('Creating audio stream...');
      // Create audio stream
      const audioStream = ytdl(url, {
        filter: 'audioonly',
        quality: 'highestaudio',
        highWaterMark: 1 << 25 // Increase buffer size for better performance
      });
      
      // Handle audio stream errors
      audioStream.on('error', (err) => {
        console.error('Audio stream error:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to download audio: ' + err.message });
        }
      });
      
      console.log('Creating file stream...');
      // Create write stream
      const fileStream = fs.createWriteStream(filepath);
      
      // Handle file stream errors
      fileStream.on('error', (err) => {
        console.error('File stream error:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to save file: ' + err.message });
        }
      });
      
      // Pipe audio to file
      audioStream.pipe(fileStream);
      
      fileStream.on('finish', () => {
        console.log('File saved successfully:', filepath);
        fileStream.end();
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
      });
      
      // Add timeout to prevent hanging
      setTimeout(() => {
        if (!res.headersSent) {
          console.log('Conversion timeout');
          // Clean up potentially incomplete file
          if (fs.existsSync(filepath)) {
            fs.unlinkSync(filepath);
          }
          res.status(500).json({ error: 'Conversion timed out' });
        }
      }, 120000); // 120 second timeout (2 minutes)
      
    } catch (ytdlError) {
      console.error('ytdl-core failed:', ytdlError);
      
      // Check if yt-dlp is available before trying to use it
      const ytDlpAvailable = await isYtDlpAvailable();
      if (!ytDlpAvailable) {
        console.log('yt-dlp is not available on this system');
        if (!res.headersSent) {
          return res.status(500).json({ 
            error: 'Conversion failed: Neither ytdl-core nor yt-dlp are working properly on this server. This is a server configuration issue.' 
          });
        }
        return;
      }
      
      // If ytdl-core fails and yt-dlp is available, try yt-dlp as fallback
      console.log('Trying yt-dlp as fallback...');
      
      // First, get video info to extract the title
      const infoCommand = `yt-dlp --print-json --skip-download "${url}"`;
      exec(infoCommand, (infoError, infoStdout, infoStderr) => {
        let title = 'video_' + Date.now(); // Default title
        
        if (!infoError && infoStdout) {
          try {
            const info = JSON.parse(infoStdout);
            title = info.title.replace(/[^\w\s\-\.]/g, ''); // Sanitize title
            // Limit title length to prevent filesystem issues
            title = title.substring(0, 50);
          } catch (parseError) {
            console.error('Error parsing video info:', parseError);
          }
        }
        
        const filename = `${title}_${Date.now()}.mp3`;
        const filepath = path.join(downloadsDir, filename);
        
        // Use yt-dlp to download and convert with higher quality
        // Using 0 to get the best available quality (usually 256-320kbps)
        const command = `yt-dlp -f bestaudio -x --audio-format mp3 --audio-quality 0 --output "${filepath}" "${url}"`;
        console.log('Executing command:', command);
        
        const ytDlpProcess = exec(command, (error, stdout, stderr) => {
          if (error) {
            console.error('yt-dlp error:', error);
            console.error('stderr:', stderr);
            if (!res.headersSent) {
              // Clean up potentially incomplete file
              if (fs.existsSync(filepath)) {
                fs.unlinkSync(filepath);
              }
              return res.status(500).json({ error: 'Conversion failed: ' + (stderr || error.message) });
            }
            return;
          }
          
          console.log('yt-dlp success:', stdout);
          if (!res.headersSent) {
            try {
              // Check if file was created
              if (!fs.existsSync(filepath)) {
                return res.status(500).json({ error: 'File was not created' });
              }
              
              // Get file size
              const stats = fs.statSync(filepath);
              const fileSizeInBytes = stats.size;
              const fileSizeInMB = (fileSizeInBytes / (1024 * 1024)).toFixed(2);
              
              res.json({ 
                success: true, 
                filename: path.basename(filepath),
                downloadUrl: `/download/${encodeURIComponent(path.basename(filepath))}`,
                fileSize: fileSizeInMB
              });
            } catch (fileError) {
              console.error('Error getting file stats:', fileError);
              res.status(500).json({ error: 'Failed to get file information: ' + fileError.message });
            }
          }
        });
        
        // Add timeout for yt-dlp process
        setTimeout(() => {
          if (!res.headersSent) {
            console.log('yt-dlp conversion timeout');
            // Kill the process if it's still running
            ytDlpProcess.kill();
            // Clean up potentially incomplete file
            if (fs.existsSync(filepath)) {
              fs.unlinkSync(filepath);
            }
            res.status(500).json({ error: 'Conversion timed out with yt-dlp' });
          }
        }, 120000); // 120 second timeout (2 minutes)
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