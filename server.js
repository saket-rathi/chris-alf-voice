require('dotenv').config();
const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const archiver = require('archiver');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Create generated-audio folder if it doesn't exist
const audioDir = path.join(__dirname, 'generated-audio');
if (!fs.existsSync(audioDir)) {
    fs.mkdirSync(audioDir);
}

// Configuration
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const VOICE_ID = process.env.VOICE_ID;
const MODEL_ID = process.env.MODEL_ID;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// Initialize Anthropic client
const anthropic = new Anthropic({
    apiKey: ANTHROPIC_API_KEY,
});

// TTS generation endpoint
app.post('/generate', async (req, res) => {
    try {
        const { text } = req.body;

        if (!text || text.trim().length === 0) {
            return res.status(400).json({ error: 'Text is required' });
        }

        if (!ELEVENLABS_API_KEY) {
            return res.status(500).json({ error: 'API key not configured' });
        }

        console.log(`Generating audio for ${text.length} characters...`);

        // Call 11 Labs API
        const response = await axios({
            method: 'post',
            url: `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
            headers: {
                'Accept': 'audio/mpeg',
                'Content-Type': 'application/json',
                'xi-api-key': ELEVENLABS_API_KEY
            },
            data: {
                text: text,
                model_id: MODEL_ID,
                voice_settings: {
                    stability: 0.4,
                    similarity_boost: 0.8,
                    style: 0.5,
                    use_speaker_boost: true
                }
            },
            responseType: 'arraybuffer'
        });

        // Generate unique filename with timestamp
        const timestamp = Date.now();
        const filename = `tts_${timestamp}.mp3`;
        const filepath = path.join(audioDir, filename);

        // Save audio file
        fs.writeFileSync(filepath, response.data);

        console.log(`Audio saved: ${filename}`);

        // Send file to client
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(response.data);

    } catch (error) {
        console.error('Error generating audio:', error.response?.data || error.message);

        if (error.response?.status === 401) {
            return res.status(401).json({ error: 'Invalid API key' });
        }

        if (error.response?.status === 429) {
            return res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
        }

        res.status(500).json({
            error: 'Failed to generate audio',
            details: error.response?.data?.detail || error.message
        });
    }
});

// Split text using Claude Haiku
async function splitTextWithClaude(text) {
    try {
        const message = await anthropic.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 4096,
            messages: [{
                role: 'user',
                content: `You are an expert text-to-speech script segmentation assistant. Your job is to split scripts into chunks that flow naturally when spoken aloud.

CRITICAL CONTEXT:
Each chunk you create will be spoken as a SEPARATE audio file by an AI voice. Your segmentation directly impacts how natural and coherent the final audio sounds. Poor splits create jarring transitions.

YOUR MISSION:
Create chunks based PURELY on meaning, context, and natural speech flow. Ignore line counts or character limits - focus ONLY on what makes sense to speak together.

ABSOLUTE RULES FOR SPLITTING:

1. SEMANTIC COMPLETENESS - Each chunk MUST be a complete unit of meaning:
   ✓ Complete sentences or paragraphs that express one full idea
   ✓ Dialogue exchanges (question + answer together)
   ✓ Lists or enumerated items (keep the whole list together)
   ✓ Cause and effect statements (keep together)
   ✓ Introductions with their explanations
   ✓ Examples with their context

   ✗ NEVER split mid-sentence
   ✗ NEVER separate a question from its answer
   ✗ NEVER break up a thought or explanation
   ✗ NEVER split a list across chunks

2. NATURAL SPEECH BOUNDARIES - Only split where a speaker would naturally pause:
   ✓ Between different topics or subjects
   ✓ Between paragraphs or major sections
   ✓ Between different speakers in dialogue
   ✓ After complete statements that stand alone
   ✓ At scene transitions or time shifts

   ✗ NEVER split where it would sound awkward if spoken
   ✗ NEVER break between dependent clauses
   ✗ NEVER split descriptions from what they describe

3. CONTEXTUAL AWARENESS - Think like a voice actor:
   • Would this chunk sound complete if someone only heard this part?
   • Does this chunk have enough context to understand on its own?
   • Would a pause here sound natural in speech?
   • Are related ideas grouped together?

4. SIZE FLEXIBILITY:
   • Chunks can be SHORT (1-2 sentences) if that's a complete thought
   • Chunks can be LONG (multiple paragraphs) if they belong together
   • Prioritize MEANING over size - never sacrifice flow for arbitrary length
   • Better to have fewer, longer chunks than many choppy ones

EXAMPLES:

BAD SPLIT (breaks meaning):
Chunk 1: "Scientists recently discovered that the new treatment"
Chunk 2: "can reduce symptoms by up to 80 percent in clinical trials."

GOOD SPLIT (complete thoughts):
Chunk 1: "Scientists recently discovered that the new treatment can reduce symptoms by up to 80 percent in clinical trials."
Chunk 2: "The breakthrough came after five years of research and testing."

BAD SPLIT (separates dialogue):
Chunk 1: "The reporter asked, 'What are your plans for the future?'"
Chunk 2: "The CEO responded, 'We're focusing on sustainable growth.'"

GOOD SPLIT (keeps exchange together):
Chunk 1: "The reporter asked, 'What are your plans for the future?' The CEO responded, 'We're focusing on sustainable growth.'"
Chunk 2: "This strategy represents a major shift in company policy."

OUTPUT FORMAT:
Return ONLY a raw JSON array of strings - no markdown, no code fences, no explanations.

["First complete chunk", "Second complete chunk", "Third complete chunk"]

FINAL CHECK before returning:
✓ Would each chunk sound complete and natural if spoken aloud?
✓ Are all related ideas grouped together?
✓ Are splits only at natural speech boundaries?
✓ Does each chunk have enough context to make sense?

Text to split:
${text}`
            }]
        });

        let responseText = message.content[0].text.trim();

        // Remove markdown code fences if present
        if (responseText.startsWith('```')) {
            responseText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        }

        const chunks = JSON.parse(responseText);

        // Validate that we got an array
        if (!Array.isArray(chunks)) {
            throw new Error('Claude did not return an array');
        }

        // Log chunk info for debugging
        console.log(`Created ${chunks.length} chunks with sizes:`, chunks.map((c, i) => `Chunk ${i+1}: ${c.length} chars`).join(', '));

        return chunks;
    } catch (error) {
        console.error('Error splitting text with Claude:', error);
        throw error;
    }
}

// Generate audio using 11 Labs
async function generateAudio(text) {
    const response = await axios({
        method: 'post',
        url: `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
        headers: {
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': ELEVENLABS_API_KEY
        },
        data: {
            text: text,
            model_id: MODEL_ID,
            voice_settings: {
                stability: 0.4,
                similarity_boost: 0.8,
                style: 0.5,
                use_speaker_boost: true
            }
        },
        responseType: 'arraybuffer'
    });
    return response.data;
}

// Script mode generation endpoint
app.post('/generate-script', async (req, res) => {
    try {
        const { text } = req.body;

        if (!text || text.trim().length === 0) {
            return res.status(400).json({ error: 'Text is required' });
        }

        if (!ANTHROPIC_API_KEY) {
            return res.status(500).json({ error: 'Anthropic API key not configured' });
        }

        if (!ELEVENLABS_API_KEY) {
            return res.status(500).json({ error: '11 Labs API key not configured' });
        }

        console.log(`Script mode: Splitting text (${text.length} characters)...`);

        // Split text using Claude
        const chunks = await splitTextWithClaude(text);
        console.log(`Split into ${chunks.length} chunks`);

        // Generate audio for each chunk
        const audioFiles = [];
        const timestamp = Date.now();

        for (let i = 0; i < chunks.length; i++) {
            console.log(`Generating audio for chunk ${i + 1}/${chunks.length}...`);
            const audioData = await generateAudio(chunks[i]);

            const filename = `script_${timestamp}_chunk_${i + 1}.mp3`;
            const filepath = path.join(audioDir, filename);

            fs.writeFileSync(filepath, audioData);

            audioFiles.push({
                filename: filename,
                text: chunks[i],
                chunkNumber: i + 1,
                audioData: audioData.toString('base64')
            });
        }

        console.log(`Generated ${audioFiles.length} audio files`);

        res.json({
            success: true,
            chunks: audioFiles.map(f => ({
                filename: f.filename,
                text: f.text,
                chunkNumber: f.chunkNumber,
                audioData: f.audioData
            })),
            sessionId: timestamp
        });

    } catch (error) {
        console.error('Error generating script audio:', error);
        res.status(500).json({
            error: 'Failed to generate script audio',
            details: error.message
        });
    }
});

// Download all chunks as ZIP
app.post('/download-zip', async (req, res) => {
    try {
        const { sessionId } = req.body;

        if (!sessionId) {
            return res.status(400).json({ error: 'Session ID is required' });
        }

        // Find all files for this session
        const files = fs.readdirSync(audioDir).filter(f =>
            f.startsWith(`script_${sessionId}_`)
        );

        if (files.length === 0) {
            return res.status(404).json({ error: 'No files found for this session' });
        }

        // Create ZIP archive
        const archive = archiver('zip', { zlib: { level: 9 } });

        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="script_audio_${sessionId}.zip"`);

        archive.pipe(res);

        // Add files to archive
        files.forEach(file => {
            const filepath = path.join(audioDir, file);
            archive.file(filepath, { name: file });
        });

        await archive.finalize();

    } catch (error) {
        console.error('Error creating ZIP:', error);
        res.status(500).json({
            error: 'Failed to create ZIP file',
            details: error.message
        });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: '11 Labs TTS' });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Voice ID: ${VOICE_ID}`);
    console.log(`Model: ${MODEL_ID}`);
});
