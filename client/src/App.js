import React, { useState } from 'react';
import { Download, Headphones, Zap, Shield, Smartphone, CheckCircle, Copy, Play } from 'lucide-react';
import './App.css';

function App() {
  const [videoUrl, setVideoUrl] = useState('');
  const [isConverting, setIsConverting] = useState(false);
  const [isConverted, setIsConverted] = useState(false);
  const [videoInfo, setVideoInfo] = useState(null);
  const [downloadUrl, setDownloadUrl] = useState('');

  const handleConvert = async () => {
    if (!videoUrl.trim()) {
      alert('Please enter a YouTube URL');
      return;
    }

    // Validate YouTube URL
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+$/;
    if (!youtubeRegex.test(videoUrl)) {
      alert('Please enter a valid YouTube URL');
      return;
    }

    setIsConverting(true);
    setIsConverted(false);

    try {
      // Make API call to backend
      const response = await fetch('/convert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: videoUrl }),
      });

      const data = await response.json();

      if (data.error) {
        alert(data.error);
        setIsConverting(false);
        return;
      }

      if (data.success) {
        // In a real app, we would get actual video info from the backend
        setVideoInfo({
          title: "Sample YouTube Video Title",
          duration: "3:45",
          thumbnail: "https://placehold.co/320x180/000000/00ff41?text=Video+Thumbnail"
        });
        
        setDownloadUrl(data.downloadUrl);
        setIsConverted(true);
      }
    } catch (error) {
      alert('Conversion failed. Please try again.');
      console.error('Conversion error:', error);
    } finally {
      setIsConverting(false);
    }
  };

  const handleDownload = () => {
    // Redirect to download URL
    if (downloadUrl) {
      window.open(downloadUrl, '_blank');
    }
  };

  const handlePasteExample = () => {
    setVideoUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  };

  return (
    <div className="App">
      {/* Header */}
      <header>
        <div className="container">
          <div className="header-content">
            <h1 className="header-title">
              <Download className="text-green-400" size={40} />
              YT to MP3 Converter
            </h1>
            <p className="header-subtitle">Convert YouTube videos to high-quality MP3 files at 320kbps</p>
            <div className="quality-badge">
              320kbps High Quality Audio
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="main-content">
        {/* Converter Section */}
        <div className="converter-section">
          <div className="converter-box">
            <div className="converter-form">
              <input
                type="text"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="Paste YouTube URL here..."
                className="input-field"
              />
              <button
                onClick={handleConvert}
                disabled={isConverting}
                className="convert-button"
              >
                {isConverting ? (
                  <>
                    <div className="spinner"></div>
                    Converting...
                  </>
                ) : (
                  <>
                    <Download size={20} />
                    Convert
                  </>
                )}
              </button>
            </div>

            <button
              onClick={handlePasteExample}
              className="paste-button"
            >
              <Copy size={14} />
              Paste example URL
            </button>
          </div>

          {/* Loading State */}
          {isConverting && (
            <div className="loading-box">
              <div className="spinner"></div>
              <h3 className="loading-title">Converting your video...</h3>
              <p className="loading-text">This may take a moment</p>
              <div className="progress-bar">
                <div className="progress-fill"></div>
              </div>
            </div>
          )}

          {/* Result State */}
          {isConverted && videoInfo && (
            <div className="result-box">
              <div className="result-header">
                <CheckCircle className="text-green-500" size={48} />
                <h2 className="result-title">Conversion Complete!</h2>
                <p className="result-subtitle">Your MP3 file is ready for download</p>
              </div>

              <div className="video-info">
                <div className="video-content">
                  <img 
                    src={videoInfo.thumbnail} 
                    alt="Video thumbnail" 
                    className="video-thumbnail"
                  />
                  <div className="video-details">
                    <h3 className="video-title">{videoInfo.title}</h3>
                    <div className="video-meta">
                      <span className="meta-item">
                        <Play size={16} />
                        {videoInfo.duration}
                      </span>
                      <span className="meta-item">
                        <Headphones size={16} />
                        320kbps
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="text-center">
                <button
                  onClick={handleDownload}
                  className="download-button"
                >
                  <Download size={24} />
                  Download MP3
                </button>
                <p className="file-size">File size: ~5.2 MB</p>
              </div>
            </div>
          )}
        </div>

        {/* Features */}
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">
              <Headphones size={32} />
            </div>
            <h3 className="feature-title">High Quality</h3>
            <p className="feature-description">320kbps bitrate for crystal clear audio</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">
              <Zap size={32} />
            </div>
            <h3 className="feature-title">Fast Conversion</h3>
            <p className="feature-description">Convert videos in seconds</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">
              <Shield size={32} />
            </div>
            <h3 className="feature-title">Secure</h3>
            <p className="feature-description">Your data is never stored on our servers</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">
              <Smartphone size={32} />
            </div>
            <h3 className="feature-title">Mobile Friendly</h3>
            <p className="feature-description">Works on all devices and browsers</p>
          </div>
        </div>

        {/* Instructions */}
        <div className="instructions-box">
          <h2 className="instructions-title">How to Convert YouTube Videos</h2>
          <div className="instructions-grid">
            <div className="instruction-step">
              <div className="step-number">1</div>
              <h3 className="step-title">Copy URL</h3>
              <p className="step-description">Copy the YouTube video URL from your browser</p>
            </div>
            <div className="instruction-step">
              <div className="step-number">2</div>
              <h3 className="step-title">Paste URL</h3>
              <p className="step-description">Paste the URL into the input field above</p>
            </div>
            <div className="instruction-step">
              <div className="step-number">3</div>
              <h3 className="step-title">Convert</h3>
              <p className="step-description">Click the convert button and wait for processing</p>
            </div>
            <div className="instruction-step">
              <div className="step-number">4</div>
              <h3 className="step-title">Download</h3>
              <p className="step-description">Download your high-quality MP3 file</p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer>
        <div className="footer-content">
          <p className="footer-text">© 2023 YT to MP3 Converter | This is a frontend demonstration only</p>
          <p className="footer-note">Note: This is a demo interface. Actual conversion requires backend implementation.</p>
        </div>
      </footer>
    </div>
  );
}

export default App;