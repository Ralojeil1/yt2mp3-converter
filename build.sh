#!/bin/bash
# Install dependencies
npm install

# Install Python and pip if not available
echo "Checking for Python and pip..."
if ! command -v python3 &> /dev/null; then
    echo "Python3 not found"
else
    echo "Python3 found: $(python3 --version)"
fi

if ! command -v pip3 &> /dev/null; then
    echo "pip3 not found"
else
    echo "pip3 found"
fi

# Install/update yt-dlp for video conversion
echo "Installing/updating yt-dlp..."
pip3 install --upgrade yt-dlp

# Verify installation
echo "Verifying yt-dlp installation..."
if command -v yt-dlp &> /dev/null; then
    echo "yt-dlp version: $(yt-dlp --version)"
else
    echo "yt-dlp not found after installation"
fi

# Also try installing with pip if pip3 doesn't work
if ! command -v yt-dlp &> /dev/null; then
    echo "Trying to install yt-dlp with pip..."
    pip install --upgrade yt-dlp
fi

# Final check
if command -v yt-dlp &> /dev/null; then
    echo "yt-dlp is available"
else
    echo "yt-dlp is NOT available"
fi