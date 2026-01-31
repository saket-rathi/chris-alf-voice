const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(__dirname));

// Pulled from Render Environment Variables
const MINIMAX_KEY = process.env.MINIMAX_KEY;
const GEMINI_KEY = process.env.GEMINI_KEY;

// ROUTE: Shred Script with Gemini 3 Pro Preview
app.post('/shred-script', async (req, res) => {
    try {
        const { script } = req.body;
        const prompt = `Divide the following marketing script into chunks. Each chunk MUST have EXACTLY 3 lines. Never 1 line, never 2 lines—always 3 lines per chunk.
        RULES:
        1. EVERY chunk must contain exactly 3 lines of the script. Do not create any chunk with 1 or 2 lines.
        2. No line in the script should be repeated into another chunk.
        3. DO NOT change the script at all. Not even a single word. Not even a single comma. 
        4. Keep the text EXACTLY as it is, just sliced into parts.
        5. If the script has leftover lines at the end, append them to the previous chunk so it has 3+ lines—never leave a chunk with fewer than 3 lines.
        6. Return ONLY a JSON array of strings.
        
        Script to slice: ${script}`;

        // TARGET: Gemini 3 Pro Preview
        const response = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent?key=${GEMINI_KEY}`, {
            contents: [{ parts: [{ text: prompt }] }]
        });

        let rawText = response.data.candidates[0].content.parts[0].text;
        
        // Strip markdown backticks if present
        const cleanJson = rawText.replace(/```json|```/g, "").trim();
        
        res.json(JSON.parse(cleanJson));
    } catch (error) {
        console.error("SHRED ERROR:", error.response ? JSON.stringify(error.response.data) : error.message);
        res.status(500).json({ error: "Gemini 3 Preview failed to shred script." });
    }
});

// ROUTE: MiniMax TTS (V2)
app.post('/generate-audio', async (req, res) => {
    const { text, model, voice_id } = req.body;
    const payload = {
        model: model || "speech-2.8-hd",
        text: text,
        stream: false,
        voice_setting: { 
            voice_id: voice_id || "English_expressive_narrator", 
            speed: 1.0, 
            vol: 1.0, 
            pitch: 0 
        },
        audio_setting: { 
            sample_rate: 32000, 
            bitrate: 128000, 
            format: "mp3", 
            channel: 1 
        },
        voice_modify: { pitch: 0, intensity: 0, timbre: 0 }
    };

    try {
        const response = await axios.post('https://api.minimax.io/v1/t2a_v2', payload, {
            headers: { 
                'Authorization': `Bearer ${MINIMAX_KEY}`, 
                'Content-Type': 'application/json' 
            }
        });
        res.json(response.data);
    } catch (error) {
        console.error("MINIMAX ERROR:", error.response ? JSON.stringify(error.response.data) : error.message);
        res.status(500).json({ error: error.message });
    }
});

// Port handling for Render
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server live on port ${PORT}`));
