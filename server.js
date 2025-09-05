const express = require('express');
const ytdl = require('ytdl-core');
const { exec } = require('child_process');
const { youtubeDl } = require('youtube-dl-exec');
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

// Function to convert using ytdl-core with fallback options
function convertWithYtdl(url, filepath, res) {
  return new Promise((resolve, reject) => {
    console.log('Converting with ytdl-core...');
    
    // Try different ytdl-core configurations as fallbacks
    const configs = [
      { filter: 'audioonly', quality: 'highestaudio' },
      { filter: 'audioonly', quality: 'lowestaudio' },
      { quality: 'highest' },
      { quality: 'lowest' }
    ];
    
    let attempt = 0;
    
    const tryConfig = () => {
      if (attempt >= configs.length) {
        reject(new Error('All ytdl-core configurations failed'));
        return;
      }
      
      const config = configs[attempt];
      console.log(`Trying ytdl-core config ${attempt + 1}:`, config);
      
      // Clean up previous attempt if it exists
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
      
      // Create audio stream
      const audioStream = ytdl(url, {
        ...config,
        highWaterMark: 1 << 25, // Increase buffer size for better performance
        requestOptions: {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        }
      });
      
      // Handle audio stream errors
      audioStream.on('error', (err) => {
        console.error(`ytdl-core config ${attempt + 1} error:`, err.message);
        attempt++;
        tryConfig(); // Try next config
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
        console.log('File saved successfully with ytdl-core config:', attempt + 1);
        fileStream.end();
        resolve();
      });
      
      // Add timeout to prevent hanging
      setTimeout(() => {
        console.log(`ytdl-core config ${attempt + 1} timeout`);
        // Clean up potentially incomplete file
        if (fs.existsSync(filepath)) {
          fs.unlinkSync(filepath);
        }
        attempt++;
        tryConfig(); // Try next config
      }, 60000); // 60 second timeout
    };
    
    tryConfig(); // Start with first config
  });
}

// Function to convert using youtube-dl-exec
async function convertWithYoutubeDlExec(url, filepath) {
  try {
    console.log('Converting with youtube-dl-exec...');
    
    // Remove .mp3 extension as youtube-dl will add it
    const outputPath = filepath.replace('.mp3', '');
    
    // Try different configurations
    const configs = [
      {
        extractAudio: true,
        audioFormat: 'mp3',
        output: outputPath,
        preferFreeFormats: true
      },
      {
        extractAudio: true,
        audioFormat: 'mp3',
        output: outputPath,
        preferFreeFormats: true,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      {
        extractAudio: true,
        audioFormat: 'mp3',
        output: outputPath,
        preferFreeFormats: true,
        noCheckCertificates: true
      }
    ];
    
    let lastError = null;
    
    for (let i = 0; i < configs.length; i++) {
      try {
        console.log(`Trying youtube-dl-exec config ${i + 1}:`, configs[i]);
        await youtubeDl(url, configs[i]);
        
        // Check if file was created with .mp3 extension
        if (!fs.existsSync(filepath)) {
          // Sometimes youtube-dl creates files with different extensions
          const possibleFiles = [
            `${outputPath}.mp3`,
            `${outputPath}.webm`,
            `${outputPath}.m4a`
          ];
          
          for (const file of possibleFiles) {
            if (fs.existsSync(file)) {
              // Rename to .mp3 if needed
              fs.renameSync(file, filepath);
              break;
            }
          }
        }
        
        if (fs.existsSync(filepath)) {
          console.log('File saved successfully with youtube-dl-exec config:', i + 1);
          return;
        }
      } catch (error) {
        console.error(`youtube-dl-exec config ${i + 1} error:`, error.message);
        lastError = error;
      }
    }
    
    if (!fs.existsSync(filepath)) {
      throw new Error('File was not created with youtube-dl-exec. Last error: ' + (lastError?.message || 'Unknown error'));
    }
  } catch (error) {
    console.error('youtube-dl-exec error:', error);
    throw new Error('Failed with youtube-dl-exec: ' + error.message);
  }
}

// Function to convert using youtube-dl (original tool)
function convertWithYoutubeDl(url, filepath, res) {
  return new Promise((resolve, reject) => {
    console.log('Converting with youtube-dl...');
    
    // Try different youtube-dl configurations as fallbacks
    const commands = [
      `youtube-dl -f bestaudio -x --audio-format mp3 --audio-quality 0 --output "${filepath}" "${url}"`,
      `youtube-dl -f worstaudio -x --audio-format mp3 --output "${filepath}" "${url}"`,
      `youtube-dl -f ba -x --audio-format mp3 --output "${filepath}" "${url}"`,
      `youtube-dl -x --audio-format mp3 --output "${filepath}" "${url}"`
    ];
    
    let attempt = 0;
    
    const tryCommand = () => {
      if (attempt >= commands.length) {
        reject(new Error('All youtube-dl commands failed'));
        return;
      }
      
      const command = commands[attempt];
      console.log(`Trying youtube-dl command ${attempt + 1}:`, command);
      
      // Clean up previous attempt if it exists
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
      
      const youtubeDlProcess = exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error(`youtube-dl command ${attempt + 1} error:`, error.message);
          console.error('youtube-dl stderr:', stderr);
          
          // Check if authentication is required
          if (stderr && (stderr.includes("Sign in to confirm you're not a bot") || 
              stderr.includes("confirm you're not a bot") ||
              stderr.includes('authentication'))) {
            reject(new Error('This video requires authentication/sign-in. Unfortunately, this service cannot download protected content. Please try a different video.'));
            return;
          }
          
          attempt++;
          tryCommand(); // Try next command
          return;
        }
        
        console.log(`youtube-dl command ${attempt + 1} success:`, stdout);
        // Check if file was created
        if (!fs.existsSync(filepath)) {
          console.error(`youtube-dl command ${attempt + 1} failed: File not created`);
          attempt++;
          tryCommand(); // Try next command
          return;
        }
        
        resolve();
      });
      
      // Add timeout for youtube-dl process
      setTimeout(() => {
        console.log(`youtube-dl command ${attempt + 1} timeout`);
        // Kill the process if it's still running
        youtubeDlProcess.kill();
        // Clean up potentially incomplete file
        if (fs.existsSync(filepath)) {
          fs.unlinkSync(filepath);
        }
        attempt++;
        tryCommand(); // Try next command
      }, 60000); // 60 second timeout
    };
    
    tryCommand(); // Start with first command
  });
}

// Function to convert using yt-dlp
function convertWithYtDlp(url, filepath, res) {
  return new Promise((resolve, reject) => {
    console.log('Converting with yt-dlp...');
    
    // Try different yt-dlp configurations as fallbacks
    const commands = [
      `yt-dlp -f bestaudio -x --audio-format mp3 --audio-quality 0 --output "${filepath}" "${url}"`,
      `yt-dlp -f worstaudio -x --audio-format mp3 --output "${filepath}" "${url}"`,
      `yt-dlp -f ba -x --audio-format mp3 --output "${filepath}" "${url}"`,
      `yt-dlp -x --audio-format mp3 --output "${filepath}" "${url}"`
    ];
    
    let attempt = 0;
    
    const tryCommand = () => {
      if (attempt >= commands.length) {
        reject(new Error('All yt-dlp commands failed'));
        return;
      }
      
      const command = commands[attempt];
      console.log(`Trying yt-dlp command ${attempt + 1}:`, command);
      
      // Clean up previous attempt if it exists
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
      
      const ytDlpProcess = exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error(`yt-dlp command ${attempt + 1} error:`, error.message);
          console.error('yt-dlp stderr:', stderr);
          
          // Check if authentication is required
          if (stderr && (stderr.includes("Sign in to confirm you're not a bot") || 
              stderr.includes("confirm you're not a bot") ||
              stderr.includes('authentication'))) {
            reject(new Error('This video requires authentication/sign-in. Unfortunately, this service cannot download protected content. Please try a different video.'));
            return;
          }
          
          attempt++;
          tryCommand(); // Try next command
          return;
        }
        
        console.log(`yt-dlp command ${attempt + 1} success:`, stdout);
        // Check if file was created
        if (!fs.existsSync(filepath)) {
          console.error(`yt-dlp command ${attempt + 1} failed: File not created`);
          attempt++;
          tryCommand(); // Try next command
          return;
        }
        
        resolve();
      });
      
      // Add timeout for yt-dlp process
      setTimeout(() => {
        console.log(`yt-dlp command ${attempt + 1} timeout`);
        // Kill the process if it's still running
        ytDlpProcess.kill();
        // Clean up potentially incomplete file
        if (fs.existsSync(filepath)) {
          fs.unlinkSync(filepath);
        }
        attempt++;
        tryCommand(); // Try next command
      }, 60000); // 60 second timeout
    };
    
    tryCommand(); // Start with first command
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
      console.error('ytdl-core failed after all attempts:', ytdlError.message);
      
      // Clean up failed file if it exists
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
      
      // Try youtube-dl-exec as second fallback
      console.log('Trying youtube-dl-exec as fallback...');
      try {
        await convertWithYoutubeDlExec(url, filepath);
        
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
      } catch (youtubeDlExecError) {
        console.error('youtube-dl-exec failed:', youtubeDlExecError.message);
        
        // Clean up failed file if it exists
        if (fs.existsSync(filepath)) {
          fs.unlinkSync(filepath);
        }
        
        // Check if authentication is required
        if (youtubeDlExecError.message.includes("Sign in to confirm you're not a bot") || 
            youtubeDlExecError.message.includes("confirm you're not a bot") ||
            youtubeDlExecError.message.includes('authentication')) {
          console.log('Authentication required for this video');
          return res.status(403).json({ 
            error: 'This video requires authentication/sign-in. Unfortunately, this service cannot download protected content. Please try a different video.' 
          });
        }
        
        // Check if youtube-dl is available
        const youtubeDlAvailable = await isYoutubeDlAvailable();
        console.log('youtube-dl available:', youtubeDlAvailable);
        
        if (youtubeDlAvailable) {
          // Try youtube-dl as third fallback
          console.log('Trying youtube-dl as fallback...');
          try {
            await convertWithYoutubeDl(url, filepath, res);
            
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
          } catch (youtubeDlError) {
            console.error('youtube-dl failed after all attempts:', youtubeDlError.message);
            
            // Check if authentication is required for youtube-dl as well
            if (youtubeDlError.message.includes("Sign in to confirm you're not a bot") || 
                youtubeDlError.message.includes("confirm you're not a bot") ||
                youtubeDlError.message.includes('authentication')) {
              console.log('Authentication required for this video (youtube-dl)');
              return res.status(403).json({ 
                error: 'This video requires authentication/sign-in. Unfortunately, this service cannot download protected content. Please try a different video.' 
              });
            }
            
            // Clean up failed file if it exists
            if (fs.existsSync(filepath)) {
              fs.unlinkSync(filepath);
            }
          }
        }
        
        // Check if yt-dlp is available
        const ytDlpAvailable = await isYtDlpAvailable();
        console.log('yt-dlp available:', ytDlpAvailable);
        
        if (!ytDlpAvailable) {
          console.log('yt-dlp is not available on this system');
          return res.status(500).json({ 
            error: 'All methods failed. ytdl-core error: ' + ytdlError.message + '. youtube-dl-exec error: ' + youtubeDlExecError.message + '. youtube-dl is not available on this server.' 
          });
        }
        
        // If youtube-dl-exec fails and yt-dlp is available, try yt-dlp as final fallback
        console.log('Trying yt-dlp as final fallback...');
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
          console.error('yt-dlp failed after all attempts:', ytDlpError.message);
          
          // Check if authentication is required for yt-dlp as well
          if (ytDlpError.message.includes("Sign in to confirm you're not a bot") || 
              ytDlpError.message.includes("confirm you're not a bot") ||
              ytDlpError.message.includes('authentication')) {
            console.log('Authentication required for this video (yt-dlp)');
            return res.status(403).json({ 
              error: 'This video requires authentication/sign-in. Unfortunately, this service cannot download protected content. Please try a different video.' 
            });
          }
          
          return res.status(500).json({ 
            error: 'All methods failed. ytdl-core error: ' + ytdlError.message + '. youtube-dl-exec error: ' + youtubeDlExecError.message + '. youtube-dl error: ' + (youtubeDlError?.message || 'N/A') + '. yt-dlp error: ' + ytDlpError.message
          });
        }
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