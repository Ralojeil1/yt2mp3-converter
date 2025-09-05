// API service for YouTube to MP3 conversion
class YouTubeConverter {
    // Extract YouTube video ID from URL
    static extractVideoId(url) {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    }
    
    // Get video info using YouTube oEmbed API
    static async getVideoInfo(videoId) {
        try {
            // In a real implementation, you would use the YouTube Data API
            // For now, we'll return mock data
            return {
                title: "Sample YouTube Video",
                duration: "3:45",
                thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
            };
        } catch (error) {
            throw new Error('Failed to get video info');
        }
    }
    
    // Convert YouTube video to MP3
    static async convertToMp3(videoId) {
        try {
            // In a real implementation, you would call a conversion API
            // For demonstration, we'll simulate the conversion
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Return mock conversion result
            return {
                success: true,
                downloadUrl: `https://example.com/download/${videoId}.mp3`,
                fileSize: (Math.random() * 10 + 2).toFixed(1) // Random file size between 2-12 MB
            };
        } catch (error) {
            throw new Error('Conversion failed');
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

            // Get video info
            const videoInfo = await YouTubeConverter.getVideoInfo(videoId);
            
            // Update UI with video info
            videoTitle.textContent = videoInfo.title;
            videoDuration.textContent = videoInfo.duration;
            videoThumbnail.src = videoInfo.thumbnail;
            videoThumbnail.onerror = function() {
                this.src = 'https://placehold.co/160x90/000000/00ff41?text=No+Thumbnail';
            };

            // Convert to MP3
            const conversionResult = await YouTubeConverter.convertToMp3(videoId);

            if (conversionResult.success) {
                // Update file size
                if (conversionResult.fileSize) {
                    fileSizeElement.textContent = `File size: ~${conversionResult.fileSize} MB`;
                }
                
                // Add download URL to button
                downloadButton.onclick = function() {
                    chrome.tabs.create({url: conversionResult.downloadUrl});
                };
                
                // Show result
                loadingBox.style.display = 'none';
                resultBox.style.display = 'block';
            }
        } catch (error) {
            alert('Conversion failed: ' + error.message);
            console.error('Conversion error:', error);
            loadingBox.style.display = 'none';
        }
    });
});