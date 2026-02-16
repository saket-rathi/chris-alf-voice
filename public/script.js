// ===== DOM Elements =====
// Mode selector
const modeSelector = document.getElementById('modeSelector');
const simpleMode = document.getElementById('simpleMode');
const scriptMode = document.getElementById('scriptMode');

// Simple mode
const textInput = document.getElementById('textInput');
const charCount = document.getElementById('charCount');
const generateBtn = document.getElementById('generateBtn');
const downloadBtn = document.getElementById('downloadBtn');
const resultSection = document.getElementById('resultSection');
const errorSection = document.getElementById('errorSection');
const errorText = document.getElementById('errorText');
const audioPlayer = document.getElementById('audioPlayer');
const btnText = document.querySelector('.btn-text');
const loader = document.querySelector('.loader');

// Script mode
const scriptInput = document.getElementById('scriptInput');
const scriptCharCount = document.getElementById('scriptCharCount');
const lineCount = document.getElementById('lineCount');
const generateScriptBtn = document.getElementById('generateScriptBtn');
const scriptProgress = document.getElementById('scriptProgress');
const progressText = document.getElementById('progressText');
const scriptResultSection = document.getElementById('scriptResultSection');
const scriptSuccessText = document.getElementById('scriptSuccessText');
const scriptErrorSection = document.getElementById('scriptErrorSection');
const scriptErrorText = document.getElementById('scriptErrorText');
const chunksContainer = document.getElementById('chunksContainer');
const downloadAllZipBtn = document.getElementById('downloadAllZipBtn');

let currentAudioBlob = null;
let currentSessionId = null;

// ===== Mode Selection Functions =====
function selectMode(mode) {
    modeSelector.style.display = 'none';
    if (mode === 'simple') {
        simpleMode.style.display = 'block';
    } else if (mode === 'script') {
        scriptMode.style.display = 'block';
    }
}

function backToModeSelector() {
    modeSelector.style.display = 'block';
    simpleMode.style.display = 'none';
    scriptMode.style.display = 'none';

    // Reset forms
    textInput.value = '';
    scriptInput.value = '';
    resultSection.style.display = 'none';
    errorSection.style.display = 'none';
    scriptResultSection.style.display = 'none';
    scriptErrorSection.style.display = 'none';
    scriptProgress.style.display = 'none';
}

// Make functions globally available
window.selectMode = selectMode;
window.backToModeSelector = backToModeSelector;

// ===== Simple Mode =====

// Character counter
textInput.addEventListener('input', () => {
    const length = textInput.value.length;
    charCount.textContent = length;
});

// Generate audio
generateBtn.addEventListener('click', async () => {
    const text = textInput.value.trim();

    if (!text) {
        showError('Please enter some text to convert to speech');
        return;
    }

    // Hide previous results/errors
    resultSection.style.display = 'none';
    errorSection.style.display = 'none';

    // Show loading state
    generateBtn.disabled = true;
    btnText.textContent = 'Generating...';
    loader.style.display = 'block';

    try {
        const response = await fetch('/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to generate audio');
        }

        // Get audio blob
        const blob = await response.blob();
        currentAudioBlob = blob;

        // Create URL for audio player
        const audioUrl = URL.createObjectURL(blob);
        audioPlayer.src = audioUrl;

        // Show success
        resultSection.style.display = 'block';

    } catch (error) {
        console.error('Error:', error);
        showError(error.message);
    } finally {
        // Reset button state
        generateBtn.disabled = false;
        btnText.textContent = 'Generate Audio';
        loader.style.display = 'none';
    }
});

// Download audio
downloadBtn.addEventListener('click', () => {
    if (!currentAudioBlob) {
        showError('No audio to download');
        return;
    }

    const url = URL.createObjectURL(currentAudioBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tts_${Date.now()}.mp3`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});

// Show error message
function showError(message) {
    errorText.textContent = message;
    errorSection.style.display = 'block';
    resultSection.style.display = 'none';
}

// ===== Script Mode =====

// Character and line counter
scriptInput.addEventListener('input', () => {
    const text = scriptInput.value;
    const length = text.length;
    const lines = text.split('\n').length;

    scriptCharCount.textContent = length;
    lineCount.textContent = lines;
});

// Generate script audio
generateScriptBtn.addEventListener('click', async () => {
    const text = scriptInput.value.trim();

    if (!text) {
        showScriptError('Please enter a script to convert to speech');
        return;
    }

    // Hide previous results/errors
    scriptResultSection.style.display = 'none';
    scriptErrorSection.style.display = 'none';
    scriptProgress.style.display = 'none';

    // Show loading state
    generateScriptBtn.disabled = true;
    const scriptBtnText = generateScriptBtn.querySelector('.btn-text');
    const scriptLoader = generateScriptBtn.querySelector('.loader');
    scriptBtnText.textContent = 'Processing...';
    scriptLoader.style.display = 'block';

    // Show progress
    scriptProgress.style.display = 'block';
    progressText.textContent = 'Splitting text with Claude Haiku...';

    try {
        const response = await fetch('/generate-script', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to generate script audio');
        }

        progressText.textContent = 'Generating audio chunks...';

        const result = await response.json();
        currentSessionId = result.sessionId;

        // Hide progress
        scriptProgress.style.display = 'none';

        // Display results
        displayScriptResults(result);

    } catch (error) {
        console.error('Error:', error);
        scriptProgress.style.display = 'none';
        showScriptError(error.message);
    } finally {
        // Reset button state
        generateScriptBtn.disabled = false;
        scriptBtnText.textContent = 'Generate Script Audio';
        scriptLoader.style.display = 'none';
    }
});

// Display script results
function displayScriptResults(result) {
    // Clear previous chunks
    chunksContainer.innerHTML = '';

    // Update success message
    scriptSuccessText.textContent = `Generated ${result.chunks.length} audio chunks successfully!`;

    // Create chunk items
    result.chunks.forEach((chunk, index) => {
        const chunkItem = createChunkItem(chunk, index);
        chunksContainer.appendChild(chunkItem);
    });

    // Show results
    scriptResultSection.style.display = 'block';
}

// Create chunk item HTML
function createChunkItem(chunk, index) {
    const div = document.createElement('div');
    div.className = 'chunk-item';

    // Convert base64 audio to blob
    const audioData = atob(chunk.audioData);
    const audioArray = new Uint8Array(audioData.length);
    for (let i = 0; i < audioData.length; i++) {
        audioArray[i] = audioData.charCodeAt(i);
    }
    const audioBlob = new Blob([audioArray], { type: 'audio/mpeg' });
    const audioUrl = URL.createObjectURL(audioBlob);

    div.innerHTML = `
        <div class="chunk-header">
            <span class="chunk-number">Chunk ${chunk.chunkNumber}</span>
        </div>
        <div class="chunk-text">${chunk.text}</div>
        <div class="chunk-audio">
            <audio controls>
                <source src="${audioUrl}" type="audio/mpeg">
            </audio>
        </div>
        <button class="chunk-download" onclick="downloadChunk('${chunk.filename}', '${audioUrl}')">
            Download Chunk ${chunk.chunkNumber}
        </button>
    `;

    return div;
}

// Download individual chunk
function downloadChunk(filename, audioUrl) {
    const a = document.createElement('a');
    a.href = audioUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// Make downloadChunk globally available
window.downloadChunk = downloadChunk;

// Download all chunks as ZIP
downloadAllZipBtn.addEventListener('click', async () => {
    if (!currentSessionId) {
        showScriptError('No session ID available');
        return;
    }

    try {
        downloadAllZipBtn.disabled = true;
        downloadAllZipBtn.textContent = '📦 Creating ZIP...';

        const response = await fetch('/download-zip', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ sessionId: currentSessionId })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to create ZIP');
        }

        // Download the ZIP file
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `script_audio_${currentSessionId}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

    } catch (error) {
        console.error('Error downloading ZIP:', error);
        showScriptError(error.message);
    } finally {
        downloadAllZipBtn.disabled = false;
        downloadAllZipBtn.textContent = '📦 Download All as ZIP';
    }
});

// Show script error message
function showScriptError(message) {
    scriptErrorText.textContent = message;
    scriptErrorSection.style.display = 'block';
    scriptResultSection.style.display = 'none';
}
