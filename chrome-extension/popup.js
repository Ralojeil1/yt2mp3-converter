// API service for YouTube to MP3 conversion
class YouTubeConverter {
    // Base URL for your deployed server
    static BASE_URL = 'https://yt2mp3-converter-auum.onrender.com';
    
    // Extract YouTube video ID from URL
    static extractVideoId(url) {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    }
    
    // Convert YouTube video to MP3
    static async convertToMp3(youtubeUrl) {
        try {
            const response = await fetch(`${this.BASE_URL}/convert`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url: youtubeUrl })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            return data;
        } catch (error) {
            throw new Error('Conversion failed: ' + error.message);
        }
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const videoUrlInput = document.getElementById('videoUrl');
    const convertButton = document.getElementById('convertButton');
    const getCurrentTabButton = document.getElementById('getCurrentTabButton');
    const loadingBox = document.getElementById('loadingBox');
    const resultBox = document.getElementById('resultBox');
    const videoThumbnail = document.getElementById('videoThumbnail');
    const videoTitle = document.getElementById('videoTitle');
    const videoDuration = document.getElementById('videoDuration');
    const downloadButton = document.getElementById('downloadButton');
    const fileSizeElement = document.querySelector('.file-size');

    // Get current tab URL
    getCurrentTabButton.addEventListener('click', async function() {
        try {
            const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
            if (tab && tab.url) {
                videoUrlInput.value = tab.url;
            }
        } catch (error) {
            console.error('Error getting current tab:', error);
        }
    });

    // Convert button click handler
    convertButton.addEventListener('click', async function() {
        const url = videoUrlInput.value.trim();
        
        if (!url) {
            alert('Please enter a YouTube URL');
            return;
        }

        // Validate YouTube URL
        const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+$/;
        if (!youtubeRegex.test(url)) {
            alert('Please enter a valid YouTube URL');
            return;
        }

        // Show loading state
        loadingBox.style.display = 'block';
        resultBox.style.display = 'none';

        try {
            // Extract video ID from URL
            const videoId = YouTubeConverter.extractVideoId(url);
            if (!videoId) {
                throw new Error('Invalid YouTube URL');
            }

            // Set placeholder video info while converting
            videoTitle.textContent = "Converting video...";
            videoDuration.textContent = "Please wait";
            videoThumbnail.src = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
            videoThumbnail.onerror = function() {
                this.src = 'https://placehold.co/160x90/000000/00ff41?text=Converting...';
            };

            // Convert to MP3 using your deployed server
            const conversionResult = await YouTubeConverter.convertToMp3(url);

            if (conversionResult.success) {
                // Update with actual video info (we'll use placeholder since we don't have the actual title)
                videoTitle.textContent = "YouTube Video";
                videoDuration.textContent = "3:45"; // Placeholder
                
                // Update file size
                if (conversionResult.fileSize) {
                    fileSizeElement.textContent = `File size: ~${conversionResult.fileSize} MB`;
                } else {
                    fileSizeElement.textContent = `File size: ~5.2 MB`; // Default placeholder
                }
                
                // Add download URL to button
                downloadButton.onclick = function() {
                    // Use the full download URL from your server
                    chrome.tabs.create({url: YouTubeConverter.BASE_URL + conversionResult.downloadUrl});
                };
                
                // Show result
                loadingBox.style.display = 'none';
                resultBox.style.display = 'block';
            } else {
                throw new Error(conversionResult.error || 'Conversion failed');
            }
        } catch (error) {
            alert('Conversion failed: ' + error.message);
            console.error('Conversion error:', error);
            loadingBox.style.display = 'none';
        }
    });
});