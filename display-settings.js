// Create a global object to hold settings and shared functions
window.DisplaySettings = {
    settings: {
        aspectRatio: '9:16',
        resolution: 1080,
        primaryFont: 'KFGQPC Uthmanic Script HAFS',
        primaryFontSize: 48,
        secondaryFont: 'Inter var',
        secondaryFontSize: 24,
        textSpacing: 20,
        animationType: 'fade',
        animationDuration: 0.3,
        animationEasing: 'linear'
    },
    easing: {
        linear: t => t,
        easeInQuad: t => t * t,
        easeOutQuad: t => t * (2 - t),
        easeInOutQuad: t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
    },
    calculateOpacity: function(currentTime, segmentStartTime, segmentEndTime) {
        const s = this.settings;
        if (s.animationType === 'none' || s.animationDuration <= 0) {
            return 1;
        }

        const ease = this.easing[s.animationEasing] || this.easing.linear;
        const animDuration = s.animationDuration;
        const segmentDuration = segmentEndTime - segmentStartTime;
        const timeIntoSegment = currentTime - segmentStartTime;
        
        // If the segment is shorter than the animation, it should just be at peak opacity for a moment.
        if (segmentDuration < animDuration) {
             const progress = timeIntoSegment / segmentDuration;
             return ease(1 - Math.abs(progress - 0.5) * 2);
        }

        // Fade Out takes precedence in case of overlap.
        if (timeIntoSegment > segmentDuration - animDuration) {
            const progress = (segmentDuration - timeIntoSegment) / animDuration;
            return ease(Math.max(0, progress));
        }

        // Fade In
        if (timeIntoSegment < animDuration) {
            const progress = timeIntoSegment / animDuration;
            return ease(Math.min(1, progress));
        }

        // Static
        return 1;
    },
    // The draw function will be attached later, as it needs a specific context (ctx).
    // We will create a factory function to generate a drawText function for any given canvas context.
    createDrawTextFunction: function(canvas, ctx) {
        const localSettings = this.settings; // Reference to the global settings

        const applyCanvasSize = () => {
            const dpr = window.devicePixelRatio || 1;
            const [arWidth, arHeight] = localSettings.aspectRatio.split(':').map(Number);
            const selectedResolution = localSettings.resolution;
            let resolutionWidth, resolutionHeight;

            if (arWidth > arHeight) { // Landscape
                resolutionHeight = selectedResolution;
                resolutionWidth = Math.round(resolutionHeight * (arWidth / arHeight));
            } else { // Portrait or Square
                resolutionWidth = selectedResolution;
                resolutionHeight = Math.round(resolutionWidth * (arHeight / arWidth));
            }

            // Ensure width and height are even numbers for 'avc' codec compatibility
            resolutionWidth = Math.floor(resolutionWidth / 2) * 2;
            resolutionHeight = Math.floor(resolutionHeight / 2) * 2;

            // For hidden canvases, we just set the resolution directly
            if (canvas.parentElement.id === 'hidden-canvas-container') {
                 canvas.width = resolutionWidth;
                 canvas.height = resolutionHeight;
            } else { // For the visible canvas, we also style it
                const container = canvas.parentElement;
                const containerWidth = container.clientWidth;
                const containerHeight = container.clientHeight;

                let canvasStyleWidth, canvasStyleHeight;

                if ((containerWidth / containerHeight) > (arWidth / arHeight)) {
                    canvasStyleHeight = containerHeight;
                    canvasStyleWidth = canvasStyleHeight * (arWidth / arHeight);
                } else {
                    canvasStyleWidth = containerWidth;
                    canvasStyleHeight = canvasStyleWidth * (arHeight / arWidth);
                }
                
                canvas.style.width = `${canvasStyleWidth}px`;
                canvas.style.height = `${canvasStyleHeight}px`;

                canvas.width = resolutionWidth * dpr;
                canvas.height = resolutionHeight * dpr;
                ctx.resetTransform();
                ctx.scale(dpr, dpr);
            }
        };

        const wrapText = (text, maxWidth, fontSize, fontFace) => {
            if (!text) return [];
            ctx.font = `${fontSize}px '${fontFace}', sans-serif`;
            const words = text.split(' ');
            let lines = [];
            let currentLine = words[0] || '';

            for (let i = 1; i < words.length; i++) {
                const word = words[i];
                const width = ctx.measureText(currentLine + " " + word).width;
                if (width < maxWidth) {
                    currentLine += " " + word;
                } else {
                    lines.push(currentLine);
                    currentLine = word;
                }
            }
            lines.push(currentLine);
            return lines;
        };

        return function(primaryText, secondaryText, opacity = 1) {
            applyCanvasSize();
            
            const dpr = (canvas.parentElement.id === 'hidden-canvas-container') ? 1 : (window.devicePixelRatio || 1);
            const canvasHeight = canvas.height / dpr;
            const canvasWidth = canvas.width / dpr;

            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            if ((!primaryText && !secondaryText) || opacity <= 0) return;

            ctx.textAlign = 'center';
            const baseFillStyle = `rgba(255, 255, 255, ${opacity})`;

            const primaryLines = wrapText(primaryText, canvasWidth * 0.9, localSettings.primaryFontSize, localSettings.primaryFont);
            const secondaryLines = wrapText(secondaryText, canvasWidth * 0.9, localSettings.secondaryFontSize, localSettings.secondaryFont);

            const primaryLineHeight = localSettings.primaryFontSize * 1.2;
            const secondaryLineHeight = localSettings.secondaryFontSize * 1.2;

            const primaryBlockHeight = primaryLines.length * primaryLineHeight;
            const secondaryBlockHeight = secondaryLines.length * secondaryLineHeight;
            
            const spacing = (primaryLines.length > 0 && secondaryLines.length > 0) ? localSettings.textSpacing : 0;

            const totalHeight = primaryBlockHeight + secondaryBlockHeight + spacing;
            let startY = (canvasHeight - totalHeight) / 2;

            ctx.textBaseline = 'top';
            
            // Draw Primary Text
            ctx.fillStyle = baseFillStyle;
            ctx.font = `${localSettings.primaryFontSize}px '${localSettings.primaryFont}', sans-serif`;
            primaryLines.forEach((line, index) => {
                ctx.fillText(line, canvasWidth / 2, startY + index * primaryLineHeight);
            });

            startY += primaryBlockHeight + spacing;

            // Draw Secondary Text
            ctx.fillStyle = baseFillStyle;
            ctx.font = `${localSettings.secondaryFontSize}px '${localSettings.secondaryFont}', sans-serif`;
            secondaryLines.forEach((line, index) => {
                ctx.fillText(line, canvasWidth / 2, startY + index * secondaryLineHeight);
            });
        };
    }
};


document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const page = document.getElementById('page-display-settings');
    const canvas = document.getElementById('display-canvas');
    const ctx = canvas.getContext('2d');
    const versionSelect = document.getElementById('version-select');
    const timeDisplay = document.getElementById('display-time');

    const prevBtn = document.getElementById('display-prev-btn');
    const playPauseBtn = document.getElementById('display-play-pause-btn');
    const playIcon = playPauseBtn.querySelector('.icon');
    const nextBtn = document.getElementById('display-next-btn');

    // --- Settings Modal Elements ---
    const settingsModal = document.getElementById('display-settings-modal');
    const closeSettingsBtn = document.getElementById('settings-close-btn');
    const aspectRatioSelect = document.getElementById('aspect-ratio-select');
    const resolutionSelect = document.getElementById('resolution-select');
    const primaryFontSelect = document.getElementById('primary-font-select');
    const primaryFontSizeInput = document.getElementById('primary-font-size-input');
    const secondaryFontSelect = document.getElementById('secondary-font-select');
    const secondaryFontSizeInput = document.getElementById('secondary-font-size-input');
    const textSpacingInput = document.getElementById('text-spacing-input');
    const animationTypeSelect = document.getElementById('animation-type-select');
    const animationDurationInput = document.getElementById('animation-duration-input');
    const animationEasingSelect = document.getElementById('animation-easing-select');
    const animationEasingGroup = document.getElementById('animation-easing-group');

    // --- State ---
    let subtitles = [];
    let duration = 0;
    let currentTime = 0;
    let currentIndex = -1;
    let isPlaying = false;
    let animationFrameId = null;
    
    // --- Create a drawing function for this page's specific canvas
    const drawText = window.DisplaySettings.createDrawTextFunction(canvas, ctx);

    // --- Utility Functions ---
    const formatTime = (seconds) => {
        if (isNaN(seconds) || seconds < 0) return '00:00:00.0';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        const ds = Math.floor((seconds - Math.floor(seconds)) * 10);
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ds}`;
    };

    const updateTotalTime = () => {
        const durationFormatted = formatTime(duration);
        timeDisplay.children[2].textContent = durationFormatted;
    };

    const updateCurrentTime = () => {
        const currentFormatted = formatTime(currentTime);
        timeDisplay.children[0].textContent = currentFormatted;
    };

    // --- Playback Logic ---
    const stop = () => {
        isPlaying = false;
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
        currentTime = 0;
        currentIndex = -1;
        playIcon.classList.remove('icon-pause');
        playIcon.classList.add('icon-play');
        update();
    };
    
    const play = () => {
        if (isPlaying || subtitles.length === 0) return;
        isPlaying = true;
        playIcon.classList.remove('icon-play');
        playIcon.classList.add('icon-pause');

        let lastTime = performance.now();

        const frame = (now) => {
            const deltaTime = (now - lastTime) / 1000;
            lastTime = now;
            currentTime += deltaTime;
            if (currentTime > duration) {
                stop();
                return;
            }
            update();
            animationFrameId = requestAnimationFrame(frame);
        };
        animationFrameId = requestAnimationFrame(frame);
    };

    const pause = () => {
        if (!isPlaying) return;
        isPlaying = false;
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
        playIcon.classList.remove('icon-pause');
        playIcon.classList.add('icon-play');
    };

    const update = () => {
        const newIndex = subtitles.findIndex(sub => currentTime < sub.time);

        // If no subtitle is active (e.g., before the first one or after the last one)
        if (newIndex === -1) {
            if (currentIndex !== -1) { // If there *was* an active subtitle before
                currentIndex = -1;
                drawText('', '', 0); // Draw empty frame with 0 opacity
            }
            updateCurrentTime();
            prevBtn.disabled = true;
            nextBtn.disabled = true;
            return;
        }

        currentIndex = newIndex;
        const currentSub = subtitles[currentIndex];
        const segmentStartTime = (currentIndex > 0) ? subtitles[currentIndex - 1].time : 0;
        const segmentEndTime = currentSub.time;

        const opacity = window.DisplaySettings.calculateOpacity(currentTime, segmentStartTime, segmentEndTime);

        const selectedVersionIndex = versionSelect.selectedIndex;
        let primaryText = currentSub.texts[0] || '';
        let secondaryText = '';

        if (selectedVersionIndex > 0) {
            const textIndex = parseInt(versionSelect.value, 10);
            secondaryText = currentSub.texts[textIndex] || '';
        }
        
        drawText(primaryText, secondaryText, opacity);
        
        updateCurrentTime();

        // Update button states
        const prevSubTime = (currentIndex > 0) ? subtitles[currentIndex - 1].time : 0;
        prevBtn.disabled = currentTime <= prevSubTime || currentIndex === 0;
        nextBtn.disabled = currentIndex >= subtitles.length - 1;
    };

    const goToPrev = () => {
        if (subtitles.length === 0) return;
        // Find the start time of the current subtitle segment
        const currentSegmentStartTime = (currentIndex > 0) ? subtitles[currentIndex - 1].time : 0;
        // If we are past the beginning of the current segment, jump back to its start.
        if (currentTime > currentSegmentStartTime) {
            currentTime = currentSegmentStartTime;
        } else { // Otherwise, jump to the start of the previous segment.
            const prevSegmentStartTime = (currentIndex > 1) ? subtitles[currentIndex - 2].time : 0;
            currentTime = prevSegmentStartTime;
        }
        update();
    };
    
    const goToNext = () => {
        // Jump to the start time of the next subtitle segment, which is the end time of the current one.
        if (currentIndex < subtitles.length - 1 && currentIndex !== -1) {
            currentTime = subtitles[currentIndex].time;
            update();
        }
    };

    // --- Setup ---
    const setupDisplayPage = () => {
        window.Subtitles.parseTable();
        subtitles = window.Subtitles.getSubtitles().filter(sub => sub.time !== null && sub.time >= 0);
        subtitles.sort((a, b) => a.time - b.time);
        const headers = window.Subtitles.getHeaders();
        
        if (subtitles.length === 0) {
            canvas.parentElement.classList.add('hidden');
            page.querySelector('.display-controls-area').classList.add('hidden');
            duration = 0;
            stop();
            return;
        } else {
            canvas.parentElement.classList.remove('hidden');
            page.querySelector('.display-controls-area').classList.remove('hidden');
        }

        while (versionSelect.options.length > 1) versionSelect.remove(1);
        if (headers.length > 2) {
             for (let i = 2; i < headers.length; i++) {
                const option = document.createElement('option');
                option.value = i - 1;
                option.textContent = headers[i];
                versionSelect.appendChild(option);
            }
        }
        
        duration = subtitles.length > 0 ? subtitles[subtitles.length - 1].time : 0;
        stop();
        updateTotalTime();
        currentIndex = -1;
        update();
    };

    // --- Settings Modal Logic ---
    const applySettingsToModal = () => {
        const s = window.DisplaySettings.settings;
        aspectRatioSelect.value = s.aspectRatio;
        resolutionSelect.value = s.resolution;
        primaryFontSelect.value = s.primaryFont;
        primaryFontSizeInput.value = s.primaryFontSize;
        secondaryFontSelect.value = s.secondaryFont;
        secondaryFontSizeInput.value = s.secondaryFontSize;
        textSpacingInput.value = s.textSpacing;
        animationTypeSelect.value = s.animationType;
        animationDurationInput.value = s.animationDuration;
        animationEasingSelect.value = s.animationEasing;

        // Show/hide easing controls based on animation type
        animationEasingGroup.style.display = s.animationType === 'fade' ? '' : 'none';
    };

    const openSettingsModal = () => {
        applySettingsToModal();
        settingsModal.classList.remove('hidden');
    };

    const closeSettingsModal = () => {
        settingsModal.classList.add('hidden');
        currentIndex = -1;
        update();
    };
    
    const updateSetting = (key, value) => {
        const s = window.DisplaySettings.settings;
        if (key.includes('Size') || key === 'resolution' || key === 'textSpacing' || key === 'animationDuration') {
            s[key] = Number(value);
        } else {
            s[key] = value;
        }
    };

    // --- Event Listeners ---
    document.getElementById('display-settings-btn').addEventListener('click', openSettingsModal);
    closeSettingsBtn.addEventListener('click', closeSettingsModal);

    aspectRatioSelect.addEventListener('change', (e) => updateSetting('aspectRatio', e.target.value));
    resolutionSelect.addEventListener('change', (e) => updateSetting('resolution', e.target.value));
    primaryFontSelect.addEventListener('change', (e) => updateSetting('primaryFont', e.target.value));
    primaryFontSizeInput.addEventListener('input', (e) => updateSetting('primaryFontSize', e.target.value));
    secondaryFontSelect.addEventListener('change', (e) => updateSetting('secondaryFont', e.target.value));
    secondaryFontSizeInput.addEventListener('input', (e) => updateSetting('secondaryFontSize', e.target.value));
    textSpacingInput.addEventListener('input', (e) => updateSetting('textSpacing', e.target.value));
    animationTypeSelect.addEventListener('change', (e) => {
        updateSetting('animationType', e.target.value);
        // Show/hide easing controls when animation type changes
        animationEasingGroup.style.display = e.target.value === 'fade' ? '' : 'none';
    });
    animationDurationInput.addEventListener('input', (e) => updateSetting('animationDuration', e.target.value));
    animationEasingSelect.addEventListener('change', (e) => updateSetting('animationEasing', e.target.value));

    playPauseBtn.addEventListener('click', () => isPlaying ? pause() : play());
    prevBtn.addEventListener('click', goToPrev);
    nextBtn.addEventListener('click', goToNext);
    versionSelect.addEventListener('change', () => {
        currentIndex = -1;
        update();
    });

    // Use a MutationObserver to detect when the page becomes active
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.attributeName === 'class' && page.classList.contains('active')) {
                document.fonts.ready.then(() => setupDisplayPage());
            } else if (!page.classList.contains('active') && isPlaying) {
                pause();
            }
        });
    });
    observer.observe(page, { attributes: true });

    // Initial setup in case the page is active on load
    if (page.classList.contains('active')) {
        document.fonts.ready.then(() => setupDisplayPage());
    }
});