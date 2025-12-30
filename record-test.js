import { Output, Mp4OutputFormat, BufferTarget, CanvasSource } from './mediabunny.mjs';

// --- Global Constants (Initial/Default values) ---
let WIDTH = 720;
let HEIGHT = 1280;
let FRAME_RATE = 30;
let BITRATE = 5_000_000;

// --- DOM Elements ---
const globalDurationInput = document.getElementById('globalDurationInput');
const videoWidthInput = document.getElementById('videoWidthInput');
const videoHeightInput = document.getElementById('videoHeightInput');
const frameRateInput = document.getElementById('frameRateInput');
const bitrateInput = document.getElementById('bitrateInput');
const recordAllButton = document.getElementById('recordAllButton');
const globalStatus = document.getElementById('globalStatus');

// --- Animation Parameters ---
const particleCount = 50;
const baseSpeed = 100; // pixels per second
const textFadeDuration = 0.25; // seconds
const textStaticDuration = 0.5; // seconds
const textIdleDuration = 0.5; // seconds
const textFont = "48px Arial";

// --- AnimationInstance Class ---
class AnimationInstance {
    constructor(id, textContent) {
        this.id = id;
        this.canvas = document.getElementById(`canvas${id}`);
        this.ctx = this.canvas.getContext('2d');
        this.statusEl = document.getElementById(`status${id}`);
        this.videoContainer = document.getElementById(`video-container${id}`);
        this.videoPreview = document.getElementById(`video-preview${id}`);
        this.downloadButton = document.getElementById(`downloadButton${id}`);
        
        this.textContent = textContent;

        // Animation State
        this.particles = [];
        this.textAlpha = 0;
        this.textState = 'idle';
        this.textTimer = 0;

        // Recording State
        this.output = null;
        this.videoSource = null;
        this.isRecording = false;
        this.lastBlobUrl = null;
    }

    // This method will be called after global parameters are updated
    updateCanvasDimensions(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
    }

    initAnimation() {
        this.createParticles();
        this.textAlpha = 0;
        this.textState = 'idle';
        this.textTimer = 0;
    }

    createParticles() {
        this.particles = [];
        for (let i = 0; i < particleCount; i++) {
            this.particles.push({
                x: Math.random() * WIDTH, // Use global WIDTH/HEIGHT
                y: Math.random() * HEIGHT,
                vx: (Math.random() * 2 - 1) * baseSpeed,
                vy: (Math.random() * 3 - 1.5) * baseSpeed,
                size: Math.random() * 5 + 2,
                color: `hsl(${Math.random() * 360}, 70%, 60%)`
            });
        }
    }

    updateAnimationState(deltaTime) {
        // Update particles
        this.particles.forEach(p => {
            p.x += p.vx * deltaTime;
            p.y += p.vy * deltaTime;
            // Use global WIDTH/HEIGHT for boundary checks
            if (p.x < 0 || p.x > WIDTH) p.vx *= -1;
            if (p.y < 0 || p.y > HEIGHT) p.vy *= -1;
        });

        // Update text fade
        this.textTimer += deltaTime;
        switch (this.textState) {
            case 'idle':
                if (this.textTimer >= textIdleDuration) {
                    this.textState = 'fadingIn';
                    this.textTimer = 0;
                }
                break;
            case 'fadingIn':
                this.textAlpha = Math.min(1, this.textTimer / textFadeDuration);
                if (this.textAlpha === 1) {
                    this.textState = 'static';
                    this.textTimer = 0;
                }
                break;
            case 'static':
                if (this.textTimer >= textStaticDuration) {
                    this.textState = 'fadingOut';
                    this.textTimer = 0;
                }
                break;
            case 'fadingOut':
                this.textAlpha = Math.max(0, 1 - (this.textTimer / textFadeDuration));
                if (this.textAlpha === 0) {
                    this.textState = 'idle';
                    this.textTimer = 0;
                }
                break;
        }
    }

    drawScene() {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 1)'; // Fully opaque background
        this.ctx.fillRect(0, 0, WIDTH, HEIGHT); // Use global WIDTH/HEIGHT

        this.particles.forEach(p => {
            this.ctx.fillStyle = p.color;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            this.ctx.fill();
        });

        // Draw text
        this.ctx.font = textFont;
        this.ctx.textAlign = 'center';
        this.ctx.fillStyle = `rgba(255, 255, 255, ${this.textAlpha})`;
        this.ctx.fillText(this.textContent, WIDTH / 2, HEIGHT / 2); // Use global WIDTH/HEIGHT
    }

    async startRecording(globalConfig) { // Pass global config with all new params
        const { duration, width, height, frameRate, bitrate } = globalConfig;

        this.statusEl.textContent = 'Initializing...';
        this.downloadButton.disabled = true;

        this.videoContainer.style.display = 'none';
        if (this.lastBlobUrl) {
            URL.revokeObjectURL(this.lastBlobUrl);
            this.lastBlobUrl = null;
        }
        
        const startTime = performance.now();

        try {
            this.output = new Output({
                format: new Mp4OutputFormat(),
                target: new BufferTarget()
            });

            this.videoSource = new CanvasSource(this.canvas, {
                codec: 'avc',
                bitrate: bitrate // Use passed bitrate
            });

            this.output.addVideoTrack(this.videoSource);
            await this.output.start();
            
            this.isRecording = true;
            this.statusEl.textContent = `Processing...`;
            
            // Reset animation state for deterministic rendering
            this.initAnimation();

            const totalFrames = duration * frameRate; // Use passed duration and frameRate
            const durationOfFrame = 1 / frameRate; // DeltaTime for each frame in offline render

            for (let i = 0; i < totalFrames; i++) {
                this.updateAnimationState(durationOfFrame);
                this.drawScene();
                
                const timestampInSeconds = i / frameRate;
                await this.videoSource.add(timestampInSeconds, durationOfFrame);

                if (i % 30 === 0) { // Update status every second
                    this.statusEl.textContent = `Processing... ${Math.round((i / totalFrames) * 100)}%`;
                }
            }

            this.statusEl.textContent = 'Finalizing video...';
            await this.output.finalize();
            const buffer = this.output.target.buffer;
            const blob = new Blob([buffer], { type: 'video/mp4' });
            
            const endTime = performance.now();
            const processingTime = ((endTime - startTime) / 1000).toFixed(2);
            this.statusEl.textContent = `Video created in ${processingTime}s.`;
            
            this.lastBlobUrl = URL.createObjectURL(blob);
            this.videoPreview.src = this.lastBlobUrl;
            this.videoContainer.style.display = 'block';
            this.videoPreview.width = width; // Update preview size
            this.videoPreview.height = height;

            this.downloadButton.onclick = () => {
                downloadBlob(blob, `video-${this.id}.mp4`);
            };

        } catch (error) {
            console.error(`Error during offline rendering for Canvas ${this.id}:`, error);
            this.statusEl.textContent = `Error: ${error.message}`;
        } finally {
            this.isRecording = false;
            this.downloadButton.disabled = false;
        }
    }
}

// --- Helper Functions ---
function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// --- Global Animation Management ---
const animationInstances = [];
let animationRunning = true; // Global flag for live animation loop

// The real-time animation loop for display
let lastFrameTime = 0;
let accumulator = 0; // Accumulate time in milliseconds
let frameDurationMs = 1000 / FRAME_RATE; // Duration of one frame in milliseconds (will be updated)

function liveAnimationLoop(timestamp) {
    if (!animationRunning) return;
    requestAnimationFrame(liveAnimationLoop);
    
    // Calculate time elapsed since last visual frame
    if (lastFrameTime === 0) lastFrameTime = timestamp;
    const elapsed = timestamp - lastFrameTime;
    lastFrameTime = timestamp;

    accumulator += elapsed;

    // Update animation state in fixed steps
    while (accumulator >= frameDurationMs) {
        animationInstances.forEach(instance => {
            instance.updateAnimationState(frameDurationMs / 1000);
        });
        accumulator -= frameDurationMs;
    }
    
    // Draw all scenes
    animationInstances.forEach(instance => {
        instance.drawScene();
    });
}

// --- Main Initialization ---
const texts = [
    "Hello 1", "World 2", "Gemini 3", "Canvas 4", "Video 5"
];

for (let i = 1; i <= 5; i++) {
    const instance = new AnimationInstance(i, texts[i - 1]);
    animationInstances.push(instance);
    instance.initAnimation(); // Initialize particles and text state
}

recordAllButton.addEventListener('click', async () => {
    const recordingDurationSeconds = parseInt(globalDurationInput.value, 10);
    const videoWidth = parseInt(videoWidthInput.value, 10);
    const videoHeight = parseInt(videoHeightInput.value, 10);
    const videoFrameRate = parseInt(frameRateInput.value, 10);
    const videoBitrate = parseInt(bitrateInput.value, 10);

    // --- Input Validation ---
    if (isNaN(recordingDurationSeconds) || recordingDurationSeconds <= 0) {
        globalStatus.textContent = 'Please enter a valid recording duration.';
        return;
    }
    if (isNaN(videoWidth) || videoWidth <= 0 || isNaN(videoHeight) || videoHeight <= 0) {
        globalStatus.textContent = 'Please enter valid video dimensions.';
        return;
    }
    if (isNaN(videoFrameRate) || videoFrameRate <= 0) {
        globalStatus.textContent = 'Please enter a valid frame rate.';
        return;
    }
    if (isNaN(videoBitrate) || videoBitrate <= 0) {
        globalStatus.textContent = 'Please enter a valid bitrate.';
        return;
    }

    // --- Update Global Parameters ---
    WIDTH = videoWidth;
    HEIGHT = videoHeight;
    FRAME_RATE = videoFrameRate;
    BITRATE = videoBitrate;
    frameDurationMs = 1000 / FRAME_RATE; // Update for live loop
    
    // --- Update Canvas Dimensions ---
    animationInstances.forEach(instance => {
        instance.updateCanvasDimensions(WIDTH, HEIGHT);
    });

    recordAllButton.disabled = true;
    globalDurationInput.disabled = true;
    videoWidthInput.disabled = true;
    videoHeightInput.disabled = true;
    frameRateInput.disabled = true;
    bitrateInput.disabled = true;
    globalStatus.textContent = 'Starting all recordings...';

    animationRunning = false; // Pause live animation for all canvases

    const recordPromises = animationInstances.map(instance => 
        instance.startRecording({
            duration: recordingDurationSeconds,
            width: WIDTH,
            height: HEIGHT,
            frameRate: FRAME_RATE,
            bitrate: BITRATE
        })
    );

    await Promise.all(recordPromises);

    globalStatus.textContent = 'All videos created!';
    recordAllButton.disabled = false;
    globalDurationInput.disabled = false;
    videoWidthInput.disabled = false;
    videoHeightInput.disabled = false;
    frameRateInput.disabled = false;
    bitrateInput.disabled = false;
    
    animationRunning = true; // Resume live animation
    animationInstances.forEach(instance => instance.initAnimation()); // Reset state for live loop
    lastFrameTime = 0; // Reset for smooth restart
    accumulator = 0;
    requestAnimationFrame(liveAnimationLoop);
});

globalStatus.textContent = 'Ready to record all videos.';
requestAnimationFrame(liveAnimationLoop);