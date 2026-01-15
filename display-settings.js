// Create a global object to hold settings and shared functions
window.DisplaySettings = {
    settings: {}, // Will be populated from JSON
    easing: {
        linear: t => t,
        easeInQuad: t => t * t,
        easeOutQuad: t => t * (2 - t),
        easeInOutQuad: t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
    },
    getResolution: function() {
        const [arWidth, arHeight] = this.settings.aspectRatio.split(':').map(Number);
        const selectedResolution = this.settings.resolution;
        let resolutionWidth, resolutionHeight;

        if (arWidth > arHeight) { // Landscape
            resolutionHeight = selectedResolution;
            resolutionWidth = Math.round(resolutionHeight * (arWidth / arHeight));
        } else { // Portrait or Square
            resolutionWidth = selectedResolution;
            resolutionHeight = Math.round(resolutionWidth * (arHeight / arWidth));
        }

        // Ensure width and height are even numbers for 'avc' codec compatibility
        return {
            width: Math.floor(resolutionWidth / 2) * 2,
            height: Math.floor(resolutionHeight / 2) * 2
        };
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
        
        if (segmentDuration < animDuration) {
             const progress = timeIntoSegment / segmentDuration;
             return ease(1 - Math.abs(progress - 0.5) * 2);
        }

        if (timeIntoSegment > segmentDuration - animDuration) {
            const progress = (segmentDuration - timeIntoSegment) / animDuration;
            return ease(Math.max(0, progress));
        }

        if (timeIntoSegment < animDuration) {
            const progress = timeIntoSegment / animDuration;
            return ease(Math.min(1, progress));
        }

        return 1;
    },
    createDrawTextFunction: function(canvas, ctx) {
        const localSettings = this.settings;

        const applyCanvasSize = () => {
            const dpr = window.devicePixelRatio || 1;
            const { width: resolutionWidth, height: resolutionHeight } = this.getResolution();
            const [arWidth, arHeight] = localSettings.aspectRatio.split(':').map(Number);

            if (canvas.parentElement.id === 'hidden-canvas-container') {
                 canvas.width = resolutionWidth;
                 canvas.height = resolutionHeight;
            } else {
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
            
            ctx.fillStyle = baseFillStyle;
            ctx.font = `${localSettings.primaryFontSize}px '${localSettings.primaryFont}', sans-serif`;
            primaryLines.forEach((line, index) => {
                ctx.fillText(line, canvasWidth / 2, startY + index * primaryLineHeight);
            });

            startY += primaryBlockHeight + spacing;

            ctx.fillStyle = baseFillStyle;
            ctx.font = `${localSettings.secondaryFontSize}px '${localSettings.secondaryFont}', sans-serif`;
            secondaryLines.forEach((line, index) => {
                ctx.fillText(line, canvasWidth / 2, startY + index * secondaryLineHeight);
            });
        };
    }
};

// --- New Dynamic Settings Logic ---

function generateSettingsHTML(config, container) {
    container.innerHTML = '';
    config.groups.forEach(group => {
        const groupEl = document.createElement('div');
        if (group.label) {
            groupEl.className = 'settings-group';
            const title = document.createElement('h3');
            title.textContent = group.label;
            groupEl.appendChild(title);
        }
        
        group.settings.forEach(setting => {
            groupEl.appendChild(createSettingElement(setting));
        });
        container.appendChild(groupEl);
    });
}

function createSettingElement(setting) {
    const item = document.createElement('div');
    item.className = 'settings-item';
    if (setting.condition) {
        item.dataset.conditionId = setting.condition.id;
        item.dataset.conditionValue = setting.condition.value;
        item.id = `setting-item-${setting.id}`; // Add id for easier selection
    }

    const label = document.createElement('label');
    label.setAttribute('for', `setting-input-${setting.id}`);
    label.textContent = setting.label;
    item.appendChild(label);

    let input;
    if (setting.type === 'select') {
        input = document.createElement('select');
        setting.options.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.label;
            input.appendChild(option);
        });
    } else if (setting.type === 'number') {
        input = document.createElement('input');
        input.type = 'number';
        if (setting.min !== undefined) input.min = setting.min;
        if (setting.step !== undefined) input.step = setting.step;
    }
    
    input.id = `setting-input-${setting.id}`;
    input.dataset.settingId = setting.id;
    input.className = 'btn';
    item.appendChild(input);

    return item;
}

function initializeSettings(config) {
    const settings = {};
    config.groups.forEach(group => {
        group.settings.forEach(setting => {
            const value = setting.type === 'number' ? Number(setting.default) : setting.default;
            settings[setting.id] = value;
        });
    });
    window.DisplaySettings.settings = settings;
}

function attachSettingsListeners(config, updateCallback) {
    config.groups.forEach(group => {
        group.settings.forEach(setting => {
            const input = document.getElementById(`setting-input-${setting.id}`);
            if (input) {
                const eventType = (setting.type === 'number') ? 'input' : 'change';
                input.addEventListener(eventType, (e) => {
                    updateSetting(setting.id, e.target.value);
                    if (setting.id === 'animationType') {
                        updateConditionalVisibility(config, e.target.value);
                    }
                    // Trigger a redraw/update in the main logic
                    updateCallback(); 
                });
            }
        });
    });
}

function updateConditionalVisibility(config, value) {
    config.groups.forEach(group => {
        group.settings.forEach(s => {
            if (s.condition && s.condition.id === 'animationType') {
                const el = document.getElementById(`setting-item-${s.id}`);
                if (el) {
                    el.style.display = (value === s.condition.value) ? 'flex' : 'none';
                }
            }
        });
    });
}

function applySettingsToModal(config) {
    const settings = window.DisplaySettings.settings;
    config.groups.forEach(group => {
        group.settings.forEach(setting => {
            const input = document.getElementById(`setting-input-${setting.id}`);
            if (input) {
                input.value = settings[setting.id];
            }
        });
    });
    updateConditionalVisibility(config, settings['animationType']);
}

const updateSetting = (key, value) => {
    const s = window.DisplaySettings.settings;
    if (typeof s[key] === 'number') {
        s[key] = Number(value);
    } else {
        s[key] = value;
    }
};

// --- Main Initialization ---

async function init() {
    try {
        const response = await fetch('display-settings.json');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const config = await response.json();

        const settingsGrid = document.querySelector('#display-settings-modal .settings-grid');
        const page = document.getElementById('page-display-settings');

        if (!settingsGrid || !page) return;

        generateSettingsHTML(config, settingsGrid);
        initializeSettings(config);
        
        // --- All original DOMContentLoaded logic moved here ---

        const canvas = document.getElementById('display-canvas');
        const ctx = canvas.getContext('2d');
        const versionSelect = document.getElementById('version-select');
        const timeDisplay = document.getElementById('display-time');
        const prevBtn = document.getElementById('display-prev-btn');
        const playPauseBtn = document.getElementById('display-play-pause-btn');
        const playIcon = playPauseBtn.querySelector('.icon');
        const nextBtn = document.getElementById('display-next-btn');
        const settingsModal = document.getElementById('display-settings-modal');
        const closeSettingsBtn = document.getElementById('settings-close-btn');

        let subtitles = [];
        let duration = 0;
        let currentTime = 0;
        let currentIndex = -1;
        let isPlaying = false;
        let animationFrameId = null;

        const drawText = window.DisplaySettings.createDrawTextFunction(canvas, ctx);

        const formatTime = (seconds) => {
            if (isNaN(seconds) || seconds < 0) return '00:00:00.00';
            const h = Math.floor(seconds / 3600);
            const m = Math.floor((seconds % 3600) / 60);
            const s = Math.floor(seconds % 60);
            const cs = Math.floor((seconds - Math.floor(seconds)) * 100).toString().padStart(2, '0');
            return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${cs}`;
        };

        const updateTotalTime = () => {
            const durationFormatted = formatTime(duration);
            timeDisplay.children[1].textContent = durationFormatted;
        };

        const updateCurrentTime = () => {
            const currentFormatted = formatTime(currentTime);
            timeDisplay.children[0].textContent = currentFormatted;
        };

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
            if (newIndex === -1) {
                if (currentIndex !== -1) {
                    currentIndex = -1;
                    drawText('', '', 0);
                }
                updateCurrentTime();
                prevBtn.disabled = true;
                nextBtn.disabled = true;
                return;
            }
            currentIndex = newIndex;
            const currentSub = subtitles[currentIndex];
            const segmentStartTime = (currentIndex > 0) ? subtitles[currentIndex - 1].time : 0;
            const opacity = window.DisplaySettings.calculateOpacity(currentTime, segmentStartTime, currentSub.time);
            const selectedVersionIndex = versionSelect.selectedIndex;
            let primaryText = currentSub.texts[0] || '';
            let secondaryText = (selectedVersionIndex > 0) ? (currentSub.texts[parseInt(versionSelect.value, 10)] || '') : '';
            drawText(primaryText, secondaryText, opacity);
            updateCurrentTime();
            const prevSubTime = (currentIndex > 0) ? subtitles[currentIndex - 1].time : 0;
            prevBtn.disabled = currentTime <= prevSubTime || currentIndex === 0;
            nextBtn.disabled = currentIndex >= subtitles.length - 1;
        };

        const goToPrev = () => {
            if (subtitles.length === 0) return;
            const currentSegmentStartTime = (currentIndex > 0) ? subtitles[currentIndex - 1].time : 0;
            if (currentTime > currentSegmentStartTime) {
                currentTime = currentSegmentStartTime;
            } else {
                const prevSegmentStartTime = (currentIndex > 1) ? subtitles[currentIndex - 2].time : 0;
                currentTime = prevSegmentStartTime;
            }
            update();
        };

        const goToNext = () => {
            if (currentIndex < subtitles.length - 1 && currentIndex !== -1) {
                currentTime = subtitles[currentIndex].time;
                update();
            }
        };
        
        const setupDisplayPage = () => {
            window.Subtitles.parseTable();
            subtitles = window.Subtitles.getSubtitles().filter(sub => sub.time !== null && sub.time >= 0).sort((a, b) => a.time - b.time);
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

        const openSettingsModal = () => {
            applySettingsToModal(config);
            settingsModal.classList.remove('hidden');
        };

        const closeSettingsModal = () => {
            settingsModal.classList.add('hidden');
            currentIndex = -1; // Reset to redraw with new settings
            update();
        };

        // Attach listeners
        attachSettingsListeners(config, update); // Pass update as callback
        document.getElementById('display-settings-btn').addEventListener('click', openSettingsModal);
        closeSettingsBtn.addEventListener('click', closeSettingsModal);
        playPauseBtn.addEventListener('click', () => isPlaying ? pause() : play());
        prevBtn.addEventListener('click', goToPrev);
        nextBtn.addEventListener('click', goToNext);
        versionSelect.addEventListener('change', () => {
            currentIndex = -1; // Reset to redraw with new texts
            update();
        });

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

        if (page.classList.contains('active')) {
            document.fonts.ready.then(() => setupDisplayPage());
        }

    } catch (error) {
        console.error("Failed to initialize display settings:", error);
    }
}

document.addEventListener('DOMContentLoaded', init);
