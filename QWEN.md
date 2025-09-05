# QWEN.md - Project Context for YT2MP3 Converter

## Project Overview

This is a YouTube to MP3 converter application that allows users to convert YouTube videos to MP3 audio files. The project consists of:

1. **Backend Server** - A Node.js/Express server that handles YouTube video processing
2. **Frontend Interface** - A web-based user interface for submitting YouTube URLs
3. **Chrome Extension** - A browser extension for easy access to the converter

### Technologies Used

- **Backend**: Node.js, Express.js
- **YouTube Processing**: ytdl-core, youtube-dl-exec, yt-dlp
- **Frontend**: HTML, CSS, JavaScript
- **Deployment**: Render.com
- **Browser Extension**: Chrome Extension (Manifest V3)

## Project Structure

```
yt2mp3-converter/
├── server.js              # Main server application
├── package.json           # Node.js dependencies and scripts
├── render.yaml            # Render deployment configuration
├── build.sh               # Build script for installing dependencies
├── public/                # Frontend static files
│   └── index.html         # Main frontend interface
├── chrome-extension/      # Chrome extension files
│   ├── manifest.json      # Extension manifest
│   ├── popup.html         # Extension popup interface
│   ├── popup.css          # Extension styling
│   └── popup.js           # Extension functionality
├── downloads/             # Directory for converted MP3 files
├── node_modules/          # Node.js dependencies (gitignored)
└── .gitignore             # Git ignore rules
```

## Building and Running

### Local Development

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Start Development Server**:
   ```bash
   npm run dev
   ```

3. **Start Production Server**:
   ```bash
   npm start
   ```

### Deployment

The application is configured for deployment on Render.com:

1. **Build Process**: 
   - Executes `chmod +x build.sh && ./build.sh`
   - Installs Node.js dependencies
   - Installs Python and pip
   - Installs/updates yt-dlp for video conversion

2. **Start Command**: 
   ```bash
   npm start
   ```

3. **System Dependencies**:
   - Python3
   - ffmpeg

## Key Components

### Backend (server.js)

The server handles:
- YouTube video validation
- Video-to-MP3 conversion using ytdl-core
- File download management
- Error handling for various YouTube restrictions
- CORS configuration for Chrome extension support

### Frontend (public/index.html)

A web interface that allows users to:
- Submit YouTube URLs for conversion
- View conversion progress
- Download converted MP3 files
- See file information (size, title, etc.)

### Chrome Extension

A browser extension that:
- Provides quick access to the converter
- Works with the web interface
- Has proper permissions for cross-origin requests

## Known Limitations

### YouTube Restrictions

1. **Status Code 410 Errors**: YouTube often returns 410 errors for automated access attempts, indicating the video is no longer available or requires authentication.

2. **Authentication Requirements**: Many videos require sign-in to confirm human access, which the service cannot bypass due to YouTube's Terms of Service.

3. **Regional Restrictions**: Some content may be geo-restricted or age-restricted.

### Error Handling

The service provides clear error messages for different scenarios:
- Videos requiring authentication
- Videos no longer available (410 errors)
- Invalid URLs
- Processing timeouts

## Development Notes

### Architecture Decisions

1. **Multi-Library Approach**: The service uses multiple libraries (ytdl-core, youtube-dl-exec, yt-dlp) as fallbacks to maximize compatibility.

2. **Timeout Protection**: Implements timeouts to prevent hanging requests.

3. **CORS Configuration**: Properly configured to support both web interface and Chrome extension access.

4. **Error Transparency**: Provides detailed error messages to help users understand why certain videos can't be converted.

### Future Improvements

1. **Better Video Detection**: Improved detection of video availability before attempting conversion.
2. **Enhanced Error Reporting**: More detailed error categorization and user guidance.
3. **Performance Optimization**: Better resource management for concurrent conversions.
4. **Alternative Sources**: Support for other video platforms beyond YouTube.

## Usage Guidelines

### For End Users

1. **Public Videos Only**: The service works best with publicly accessible YouTube videos.
2. **Avoid Protected Content**: Videos requiring sign-in, age verification, or regional restrictions cannot be processed.
3. **Patience Required**: Conversion may take time depending on video length and server load.
4. **Legal Compliance**: Use in accordance with YouTube's Terms of Service and local copyright laws.

### For Developers

1. **Environment Setup**: Ensure Node.js, Python, and ffmpeg are installed.
2. **Dependency Management**: Regular updates to ytdl-core and yt-dlp may be necessary.
3. **Testing**: Test with various video types to ensure compatibility.
4. **Error Monitoring**: Monitor logs for recurring error patterns to improve handling.