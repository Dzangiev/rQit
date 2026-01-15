document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const fileInput = document.getElementById('file-input');
    const fileNameText = document.getElementById('file-name-text');
    const videoPlayer = document.getElementById('main-video');
    const textDisplay = document.getElementById('text-display');
    const playPauseBtn = document.getElementById('play-pause-btn');
    const playPauseIcon = playPauseBtn.querySelector('.icon');
    const timeDisplayCurrent = document.getElementById('time-display-current');
    const timeDisplayDuration = document.getElementById('time-display-duration');
    const zoomInBtn = document.getElementById('zoom-in-btn');
    const zoomOutBtn = document.getElementById('zoom-out-btn');
    const speedBtn = document.getElementById('speed-btn');
    const speedText = document.getElementById('speed-text');
    const speedModal = document.getElementById('speed-modal');
    const speedModalContent = speedModal.querySelector('.speed-modal-content');
    const playerBottomSection = document.getElementById('player-bottom-section');

    // --- Marker Control DOM Elements ---
    const resetMarkersBtn = document.getElementById('reset-markers-btn');
    const prevMarkerBtn = document.getElementById('prev-marker-btn');
    const addMarkerBtn = document.getElementById('add-marker-btn');
    const nextMarkerBtn = document.getElementById('next-marker-btn');
    const deleteMarkerBtn = document.getElementById('delete-marker-btn');
    
    // --- Initialize Modules ---
    window.Waveform.init(videoPlayer);

    // --- State ---
    let animationFrameId;
    let currentFile = null;

    // --- Debounce Utility for Resize ---
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => { clearTimeout(timeout); func(...args); };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // --- Event Handlers ---
    window.addEventListener('resize', debounce(() => {
        if (currentFile) {
            window.Waveform.handleResize(videoPlayer.currentTime);
        }
    }, 100));

    // --- Subtitle & UI Update Logic ---
    const updateSubtitles = () => {
        const subtitles = window.Subtitles.getSubtitles();
        const currentTime = videoPlayer.currentTime;

        if (!subtitles || subtitles.length === 0) {
            textDisplay.textContent = '';
            return;
        }

        let lastPassedIndex = -1;
        for (let i = 0; i < subtitles.length; i++) {
            if (subtitles[i].time !== null && currentTime >= subtitles[i].time) {
                lastPassedIndex = i;
            }
        }
        
        let displayIndex = -1;
        if (lastPassedIndex === -1) {
            // Before the first timestamp. Display text from row 0.
            displayIndex = 0;
        } else {
            // We have passed the subtitle at `lastPassedIndex`.
            // We should display the text of the *next* row.
            displayIndex = lastPassedIndex + 1;
        }
        
        let textToShow = '';
        if (displayIndex < subtitles.length) {
            if (subtitles[displayIndex] && subtitles[displayIndex].texts) {
                textToShow = subtitles[displayIndex].texts[0] || '';
            }
        }

        if (textDisplay.textContent !== textToShow) {
            textDisplay.textContent = textToShow;
        }
    };
    
    const updateUIFromSubtitles = () => {
        updateSubtitles();
        window.Waveform.updateMarkers();
        updateMarkerButtonStates();
    };

    const updateMarkerButtonStates = () => {
        const subtitles = window.Subtitles.getSubtitles();
        const hasMarkersWithTime = subtitles && subtitles.some(sub => sub.time !== null);
        const currentTime = videoPlayer.currentTime;

        resetMarkersBtn.disabled = !hasMarkersWithTime;
        addMarkerBtn.disabled = !currentFile;

        const timeTolerance = 0.05; // 50ms tolerance for matching time
        let onMarker = false;
        if (hasMarkersWithTime) {
            for (const sub of subtitles) {
                if (sub.time !== null && Math.abs(sub.time - currentTime) < timeTolerance) {
                    onMarker = true;
                    break;
                }
            }
        }
        deleteMarkerBtn.disabled = !onMarker;

        let prevMarkerExists = hasMarkersWithTime && subtitles.some(sub => sub.time !== null && sub.time < currentTime);
        prevMarkerBtn.disabled = !prevMarkerExists;

        let nextMarkerExists = hasMarkersWithTime && subtitles.some(sub => sub.time !== null && sub.time > currentTime);
        nextMarkerBtn.disabled = !nextMarkerExists;
    };
    
    // --- Event Listeners ---
    document.addEventListener('subtitlesUpdated', updateUIFromSubtitles);
    videoPlayer.addEventListener('timeupdate', () => {
        updateSubtitles();
        updateMarkerButtonStates();
    });

    fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            playerBottomSection.classList.remove('hidden');
            currentFile = file;
            const fileURL = URL.createObjectURL(file);
            videoPlayer.src = fileURL;
            fileNameText.textContent = file.name;
            
            window.Waveform.loadAudio(file);
        }
    });

    playPauseBtn.addEventListener('click', () => {
        if (videoPlayer.paused) videoPlayer.play();
        else videoPlayer.pause();
    });

    videoPlayer.addEventListener('play', () => {
        playPauseIcon.classList.replace('icon-play', 'icon-pause');
        updateTimeLoop();
    });

    videoPlayer.addEventListener('pause', () => {
        playPauseIcon.classList.replace('icon-pause', 'icon-play');
        cancelAnimationFrame(animationFrameId);
    });

    videoPlayer.addEventListener('ended', () => {
        playPauseIcon.classList.replace('icon-pause', 'icon-play');
        cancelAnimationFrame(animationFrameId);
    });

    videoPlayer.addEventListener('seeking', () => {
        updateTimeDisplay();
        window.Waveform.updatePosition(videoPlayer.currentTime);
        updateMarkerButtonStates();
        cancelAnimationFrame(animationFrameId);
        if(!videoPlayer.paused) {
            updateTimeLoop();
        }
    });

    videoPlayer.addEventListener('loadedmetadata', () => {
        updateTimeDisplay();
        updateUIFromSubtitles();
    });

    // --- Time Display ---
    function formatTime(seconds) {
        if (isNaN(seconds)) return '00:00:00.00';
        const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
        const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
        const s = Math.floor(seconds % 60).toString().padStart(2, '0');
        const cs = Math.floor((seconds - Math.floor(seconds)) * 100).toString().padStart(2, '0');
        return `${h}:${m}:${s}.${cs}`;
    }

    function updateTimeDisplay() {
        const currentTime = videoPlayer.currentTime;
        const duration = videoPlayer.duration;
        if (!isNaN(duration)) {
            timeDisplayCurrent.textContent = formatTime(currentTime);
            timeDisplayDuration.textContent = formatTime(duration);
        } else {
            timeDisplayCurrent.textContent = '00:00:00.00';
            timeDisplayDuration.textContent = '00:00:00.00';
        }
    }

    function updateTimeLoop() {
        updateTimeDisplay();
        window.Waveform.updatePosition(videoPlayer.currentTime);
        animationFrameId = requestAnimationFrame(updateTimeLoop);
    }

    // --- Zoom & Speed Controls ---
    zoomInBtn.addEventListener('click', () => window.Waveform.zoomIn());
    zoomOutBtn.addEventListener('click', () => window.Waveform.zoomOut());
    
    const speeds = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];
    speeds.forEach(speed => {
        const button = document.createElement('button');
        button.textContent = `${speed}x`;
        button.dataset.speed = speed;
        if (speed === 1.0) button.classList.add('active-speed');
        button.addEventListener('click', () => {
            videoPlayer.playbackRate = speed;
            speedText.textContent = `${speed}x`;
            speedModalContent.querySelector('.active-speed').classList.remove('active-speed');
            button.classList.add('active-speed');
            speedModal.classList.add('hidden');
        });
        speedModalContent.appendChild(button);
    });

    speedBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        speedModal.classList.toggle('hidden');
    });

    document.addEventListener('click', (event) => {
        if (!speedModal.classList.contains('hidden') && !speedModal.contains(event.target) && !speedBtn.contains(event.target)) {
            speedModal.classList.add('hidden');
        }
    });

    // --- Marker Controls Event Listeners ---
    resetMarkersBtn.addEventListener('click', () => {
        window.Table.showConfirmationModal('Вы уверены, что хотите сбросить все тайм-коды?', () => {
            window.Table.clearAllTimestamps();
            updateMarkerButtonStates();
        });
    });

    addMarkerBtn.addEventListener('click', () => {
        if (currentFile && !addMarkerBtn.disabled) {
            window.Table.insertTimestampRow(videoPlayer.currentTime);
        }
    });

    const findMarkerTime = (direction) => {
        const subtitles = window.Subtitles.getSubtitles().filter(s => s.time !== null);
        if (subtitles.length === 0) return -1;
        const currentTime = videoPlayer.currentTime;

        if (direction === 'prev') {
            const prevTimes = subtitles.filter(s => s.time < currentTime);
            return prevTimes.length > 0 ? prevTimes[prevTimes.length - 1].time : -1;
        } else { // next
            const nextTime = subtitles.find(s => s.time > currentTime);
            return nextTime ? nextTime.time : -1;
        }
    };

    prevMarkerBtn.addEventListener('click', () => {
        const targetTime = findMarkerTime('prev');
        if (targetTime !== -1) {
            videoPlayer.currentTime = targetTime;
            videoPlayer.pause();
        }
    });

    nextMarkerBtn.addEventListener('click', () => {
        const targetTime = findMarkerTime('next');
        if (targetTime !== -1) {
            videoPlayer.currentTime = targetTime;
            videoPlayer.pause();
        }
    });

    deleteMarkerBtn.addEventListener('click', () => {
        if (deleteMarkerBtn.disabled) return;
        const subtitles = window.Subtitles.getSubtitles();
        const currentTime = videoPlayer.currentTime;
        const timeTolerance = 0.05;
        let indexToDelete = -1;
        
        for (let i = 0; i < subtitles.length; i++) {
            if (subtitles[i].time !== null && Math.abs(subtitles[i].time - currentTime) < timeTolerance) {
                indexToDelete = i;
                break;
            }
        }

        if (indexToDelete !== -1) {
            window.Table.clearTimestampByIndex(indexToDelete);
        }
    });
});