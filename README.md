# 11 Labs Text-to-Speech Web Application

A modern web application for generating natural-sounding speech from text using the 11 Labs API.

## Features

- 🎙️ High-quality text-to-speech generation
- 📝 Real-time character counter
- 💰 Estimated credit cost calculator
- 🎵 In-browser audio playback
- ⬇️ Download generated audio files
- 💾 Automatic saving to `generated-audio` folder
- 🎨 Clean, modern UI with responsive design
- ⚡ Fast generation with loading states

## Prerequisites

- Node.js (v14 or higher)
- 11 Labs API account and API key

## Installation

1. Clone or download this repository

2. Install dependencies:
```bash
npm install
```

3. The `.env` file is already configured with your API credentials:
   - API Key: `sk_2b6f3bae791b16864c1ebe4107122850ee3f1074f92a459f`
   - Voice ID: `HWR238yV9ZIg0YsvgV6b`
   - Model: `eleven_multilingual_v2`

## Usage

1. Start the server:
```bash
npm start
```

2. Open your browser and navigate to:
```
http://localhost:3000
```

3. Enter your text in the textarea
4. Click "Generate Audio" to create the speech
5. Listen to the audio in the browser player
6. Click "Download Audio" to save the file

## Configuration

The application uses the following hardcoded voice settings for optimal quality:

- **Stability**: 0.4 (balanced naturalness)
- **Similarity Boost**: 0.8 (high voice similarity)
- **Style**: 0.5 (moderate style expression)
- **Speaker Boost**: Enabled (enhanced audio quality)
- **Model**: eleven_multilingual_v2 (supports multiple languages)

## File Structure

```
.
├── server.js              # Express backend server
├── package.json           # Node.js dependencies
├── .env                   # Environment variables (API credentials)
├── README.md             # This file
├── public/               # Frontend files
│   ├── index.html        # Main HTML page
│   ├── styles.css        # Styling
│   └── script.js         # Frontend JavaScript
└── generated-audio/      # Saved audio files (auto-created)
```

## API Endpoints

### POST /generate
Generates speech from text using 11 Labs API.

**Request Body:**
```json
{
  "text": "Your text here"
}
```

**Response:**
- Success: Returns audio file (audio/mpeg)
- Error: Returns JSON with error message

### GET /health
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "service": "11 Labs TTS"
}
```

## Cost Estimation

The application estimates costs based on:
- Standard tier: ~$0.30 per 1,000 characters
- Real-time calculation as you type

## Error Handling

The application handles various error scenarios:
- Empty text input
- Missing API key
- Invalid API key (401)
- Rate limiting (429)
- Network errors
- Server errors

## Saved Files

All generated audio files are automatically saved to the `generated-audio` folder with timestamps:
- Format: `tts_[timestamp].mp3`
- Example: `tts_1708123456789.mp3`

## Browser Compatibility

Works with all modern browsers that support:
- HTML5 Audio API
- Fetch API
- ES6 JavaScript

## Security Notes

- API key is stored in `.env` file (not committed to git)
- Add `.env` to `.gitignore` before pushing to public repositories
- Consider implementing rate limiting for production use
- Add authentication for production deployments

## Troubleshooting

**Audio not generating:**
- Check that your 11 Labs API key is valid
- Verify you have sufficient credits in your account
- Check console for error messages

**Server won't start:**
- Ensure port 3000 is not already in use
- Check that all dependencies are installed (`npm install`)

**Audio quality issues:**
- Voice settings are pre-configured for optimal quality
- Try different text or punctuation for better results

## License

MIT

## Support

For issues with the 11 Labs API, visit: https://elevenlabs.io/docs
