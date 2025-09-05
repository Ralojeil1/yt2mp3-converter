#!/bin/bash
# Install dependencies
npm install

# Install Python and pip if not available
if ! command -v python3 &> /dev/null; then
    echo "Python3 not found, attempting to install"
    # Render should have Python available, but let's check
    echo "Python3 installation skipped - should be available on Render"
fi

if ! command -v pip3 &> /dev/null; then
    echo "pip3 not found, attempting to install"
    # Render should have pip available, but let's check
    echo "pip3 installation skipped - should be available on Render"
fi

# Install yt-dlp for video conversion
echo "Installing yt-dlp..."
pip3 install yt-dlp

# Verify installation
echo "Verifying yt-dlp installation..."
yt-dlp --version