window.Waveform = (() => {
    let canvas = null;
    let ctx = null;
    let container = null;
    let track = null; // The new moving element
    let audioDuration = 0;
    let pixelsPerSecond = 75;
    let initialOffset = 0;
    let videoPlayer = null; // To control video playback
    let audioBuffer = null; // To store the audio buffer for reprocessing
    let peaks = []; // To store the peaks for redrawing

    // --- Public Methods ---

    function init(videoPlayerElement) {
        canvas = document.getElementById('waveform-canvas');
        container = document.getElementById('waveform-container');
        track = document.getElementById('waveform-track');
        videoPlayer = videoPlayerElement; // Store reference to the video player
        if (!canvas || !track || !videoPlayer) {
            console.error('Waveform elements or video player not found!');
            return;
        }
        ctx = canvas.getContext('2d');
        initDragHandlers(); // Set up the drag-and-drop listeners
    }

    // --- Drag-to-seek Logic ---
    function initDragHandlers() {
        let isDragging = false;
        let startX;
        let startTranslateX;

        function handleStart(clientX) {
            isDragging = true;
            videoPlayer.pause();
            startX = clientX;
            const transformMatrix = new DOMMatrix(getComputedStyle(track).transform);
            startTranslateX = transformMatrix.m41;

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
            document.addEventListener('touchmove', onTouchMove, { passive: false });
            document.addEventListener('touchend', onTouchEnd);
            document.addEventListener('touchcancel', onTouchEnd);
        }

        function handleMove(clientX) {
            if (!isDragging) return;
            const dx = clientX - startX;
            const newTranslateX = startTranslateX + dx;
            const newCurrentTime = (initialOffset - newTranslateX) / pixelsPerSecond;
            const clampedTime = Math.max(0, Math.min(audioDuration, newCurrentTime));
            videoPlayer.currentTime = clampedTime;
        }

        function handleEnd() {
            if (!isDragging) return;
            isDragging = false;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            document.removeEventListener('touchmove', onTouchMove);
            document.removeEventListener('touchend', onTouchEnd);
            document.removeEventListener('touchcancel', onTouchEnd);
        }

        // --- Mouse event handlers ---
        function onMouseDown(e) {
            handleStart(e.clientX);
        }

        function onMouseMove(e) {
            e.preventDefault();
            handleMove(e.clientX);
        }

        function onMouseUp() {
            handleEnd();
        }

        // --- Touch event handlers ---
        function onTouchStart(e) {
            if (e.touches.length === 1) {
                handleStart(e.touches[0].clientX);
            }
        }

        function onTouchMove(e) {
            if (e.touches.length === 1) {
                e.preventDefault();
                handleMove(e.touches[0].clientX);
            }
        }
        
        function onTouchEnd() {
            handleEnd();
        }

        container.addEventListener('mousedown', onMouseDown);
        container.addEventListener('touchstart', onTouchStart, { passive: true });
    }


    async function loadAudio(audioFile) {
        if (!window.AudioContext) {
            drawPlaceholder('Web Audio API not supported');
            return;
        }
        container.classList.remove('hidden'); // Show the container
        const audioContext = new AudioContext();
        try {
            const buffer = await audioFile.arrayBuffer();
            audioBuffer = await audioContext.decodeAudioData(buffer);
            audioDuration = audioBuffer.duration;

            const trackWidth = Math.ceil(audioDuration * pixelsPerSecond);
            
            track.style.width = trackWidth + 'px';
            canvas.width = trackWidth;
            canvas.height = canvas.clientHeight;

            initialOffset = container.offsetWidth / 2;
            updatePosition(0); // Set initial position to 0s

            peaks = processAudioBuffer(audioBuffer);
            draw(peaks);
        } catch (error) {
            console.error('Error decoding audio data:', error);
            drawPlaceholder('Error loading audio');
        }
    }

    function updatePosition(currentTime) {
        if (!track) return;

        const targetTranslateX = initialOffset - (currentTime * pixelsPerSecond);
        const maxTranslateX = initialOffset;
        const trackWidth = parseFloat(track.style.width) || 0;
        const minTranslateX = initialOffset - trackWidth;

        let clampedTranslateX = targetTranslateX;

        if (trackWidth > container.offsetWidth) {
            clampedTranslateX = Math.max(minTranslateX, Math.min(maxTranslateX, targetTranslateX));
        }
        
        track.style.transform = `translateX(${clampedTranslateX}px)`;
    }

    function handleResize(currentTime) {
        if (!container) return;
        initialOffset = container.offsetWidth / 2;
        updatePosition(currentTime);
    }

    function updateMarkers() {
        if (!ctx || !peaks || peaks.length === 0) return;
        draw(peaks);
    }
    
    function setZoom(newPixelsPerSecond) {
        if (!audioBuffer) return;

        pixelsPerSecond = Math.max(20, Math.min(500, newPixelsPerSecond));

        const trackWidth = Math.ceil(audioDuration * pixelsPerSecond);
        track.style.width = trackWidth + 'px';
        canvas.width = trackWidth;

        peaks = processAudioBuffer(audioBuffer);
        draw(peaks);

        updatePosition(videoPlayer.currentTime);
    }

    function zoomIn() {
        setZoom(pixelsPerSecond * 1.25);
    }

    function zoomOut() {
        setZoom(pixelsPerSecond / 1.25);
    }

    function processAudioBuffer(buffer) {
        const rawData = buffer.getChannelData(0);
        const samples = Math.floor(audioDuration * pixelsPerSecond);
        const blockSize = Math.floor(rawData.length / samples);
        const peaks = [];
        if (blockSize === 0) {
            for (let i = 0; i < samples; i++) {
                let sampleIndex = Math.floor(i * (rawData.length / samples));
                peaks.push(Math.abs(rawData[sampleIndex] || 0));
            }
            return peaks;
        }
        for (let i = 0; i < samples; i++) {
            const blockStart = blockSize * i;
            let sum = 0;
            for (let j = 0; j < blockSize; j++) {
                sum += Math.abs(rawData[blockStart + j]);
            }
            peaks.push(sum / blockSize);
        }
        return peaks;
    }

    function draw(peaks) {
        if (!ctx) return;
        const canvasHeight = canvas.height;
        const canvasWidth = canvas.width;
        ctx.clearRect(0, 0, canvasWidth, canvasHeight);

        const maxPeak = Math.max(...peaks);

        const topMargin = 30;
        const waveformHeight = canvasHeight > topMargin ? canvasHeight - topMargin : 0;
        const yOffset = topMargin;

        if (waveformHeight > 0) {
            const centerY = yOffset + waveformHeight / 2 + 17;
            const mainWaveHeight = waveformHeight * 1.9; 
            const reflectedWaveHeight = waveformHeight * 0.4;

            ctx.fillStyle = '#6348BD';
            ctx.beginPath();
            ctx.moveTo(0, centerY);
            for (let i = 0; i < peaks.length; i++) {
                const peakHeight = (peaks[i] / maxPeak) * mainWaveHeight;
                ctx.lineTo(i, centerY - peakHeight);
            }
            ctx.lineTo(peaks.length, centerY);
            ctx.fill();

            ctx.fillStyle = '#4A3C8D'; 
            ctx.beginPath();
            ctx.moveTo(0, centerY);
            for (let i = 0; i < peaks.length; i++) {
                const peakHeight = (peaks[i] / maxPeak) * reflectedWaveHeight;
                ctx.lineTo(i, centerY + peakHeight);
            }
            ctx.lineTo(peaks.length, centerY);
            ctx.fill();
        }

        const subtitles = window.Subtitles.getSubtitles();
        if (!subtitles) return;
        subtitles.forEach((sub, index) => {
            if (sub.time !== null) {
                const xPos = sub.time * pixelsPerSecond;
                
                ctx.font = 'bold 11px "Inter var"';
                ctx.textAlign = 'center';

                const text = (index + 1).toString();
                const textMetrics = ctx.measureText(text);
                const actualTextWidth = textMetrics.width;

                const fontSize = 11;
                const padding = 1;

                const blockHeight = fontSize + (padding * 2);
                let blockWidth = actualTextWidth + (padding * 2);
                
                blockWidth = Math.max(blockWidth, blockHeight);
                const borderRadius = 100;

                const blockX = xPos - blockWidth / 2;
                const blockY = 2 + 0.5;

                ctx.fillStyle = '#38883A';
                ctx.strokeStyle = '#9BC39C';
                ctx.lineWidth = 1;

                ctx.beginPath();
                ctx.moveTo(xPos, blockY + blockHeight);
                ctx.lineTo(xPos, canvasHeight);
                ctx.stroke();

                ctx.beginPath();
                ctx.roundRect(blockX, blockY, blockWidth, blockHeight, borderRadius);
                ctx.fill();
                ctx.stroke();

                ctx.fillStyle = 'white';
                ctx.textBaseline = 'middle';
                ctx.fillText(text, xPos, blockY + blockHeight / 2);
                ctx.textBaseline = 'alphabetic';
            }
        });
    }

    function drawPlaceholder(text) {
        if (!ctx) return;
        ctx.fillStyle = '#333';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'white';
        ctx.font = '16px Inter';
        ctx.textAlign = 'center';
        ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    }

    return {
        init,
        loadAudio,
        updatePosition,
        updateMarkers,
        handleResize,
        zoomIn,
        zoomOut
    };
})();
