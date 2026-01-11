import { Output, Mp4OutputFormat, BufferTarget, CanvasSource } from './mediabunny.mjs';

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const page = document.getElementById('page-record');
    if (!page) return;

    const openVersionsModalBtn = document.getElementById('open-versions-modal-btn');
    const recordStartBtn = document.getElementById('record-start-btn');
    const openDownloadModalBtn = document.getElementById('open-download-modal-btn');
    const downloadBtn = document.getElementById('download-selected-btn');
    const recordVersionsModal = document.getElementById('record-versions-modal');
    const recordVersionsList = document.getElementById('record-versions-list');
    const recordVersionsCloseBtn = document.getElementById('record-versions-close-btn');
    const downloadModal = document.getElementById('download-modal');
    const downloadVideosList = document.getElementById('download-videos-list');
    const downloadModalCloseBtn = document.getElementById('download-modal-close-btn');
    const videoPlayerModal = document.getElementById('video-player-modal');
    const videoPlayer = document.getElementById('video-player');
    const videoPlayerCloseBtn = document.getElementById('video-player-close-btn');
    const progressBlock = document.getElementById('record-progress-block');
    const statusText = document.getElementById('record-status-text');
    const stopwatchEl = document.getElementById('record-stopwatch');
    const progressBar = document.getElementById('record-progress-bar');
    const percentageEl = document.getElementById('record-percentage');
    const hiddenCanvasContainer = document.getElementById('hidden-canvas-container');
    const confirmationModal = document.getElementById('confirmation-modal');
    const confirmationMessage = document.getElementById('confirmation-message');
    const confirmBtn = document.getElementById('confirm-btn');
    const cancelBtn = document.getElementById('cancel-btn');
    const openRecordModeBtn = document.getElementById('open-record-mode-btn');
    const recordModeModal = document.getElementById('record-mode-modal');
    const recordModeSelect = document.getElementById('record-mode-select');
    const recordModeSaveBtn = document.getElementById('record-mode-save-btn');

    // --- State ---
    let isRecording = false;
    const recordedVideos = [];
    let stopwatchInterval = null;
    let stopwatchTime = 0;
    let currentVideoUrl = null;
    let mediaRecorder;
    let recordedChunks = [];
    let animationFrameId;
    let currentRecordMode = 'fast';

    // --- Config ---
    const FRAME_RATE = 30;
    const BITRATE = 2500000;

    // --- UI Handlers & Utils ---
    openVersionsModalBtn.addEventListener('click', () => recordVersionsModal.classList.remove('hidden'));
    recordVersionsCloseBtn.addEventListener('click', () => recordVersionsModal.classList.add('hidden'));
    openDownloadModalBtn.addEventListener('click', () => downloadModal.classList.remove('hidden'));
    downloadModalCloseBtn.addEventListener('click', () => downloadModal.classList.add('hidden'));
    openRecordModeBtn.addEventListener('click', () => recordModeModal.classList.remove('hidden'));
    recordModeSaveBtn.addEventListener('click', () => {
        currentRecordMode = recordModeSelect.value;
        recordModeModal.classList.add('hidden');
    });

    videoPlayerCloseBtn.addEventListener('click', () => {
        videoPlayerModal.classList.add('hidden');
        videoPlayer.pause();
        if (currentVideoUrl) URL.revokeObjectURL(currentVideoUrl);
        currentVideoUrl = null;
        videoPlayer.src = '';
    });
    
    const isMobile = () => /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

    const showConfirmation = (message) => new Promise((resolve) => {
        confirmationMessage.textContent = message;
        confirmationModal.classList.remove('hidden');
        const onConfirm = () => { resolve(true); cleanup(); };
        const onCancel = () => { resolve(false); cleanup(); };
        const cleanup = () => {
            confirmationModal.classList.add('hidden');
            confirmBtn.removeEventListener('click', onConfirm);
            cancelBtn.removeEventListener('click', onCancel);
        };
        confirmBtn.addEventListener('click', onConfirm);
        cancelBtn.addEventListener('click', onCancel);
    });
    
    const formatStopwatch = (time) => {
        const h = String(Math.floor(time / 3600)).padStart(2, '0');
        const m = String(Math.floor((time % 3600) / 60)).padStart(2, '0');
        const s = String(Math.floor(time % 60)).padStart(2, '0');
        return `${h}:${m}:${s}`;
    };

    const downloadBlob = (blob, filename) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const getTimestamp = () => new Date().toISOString().replace(/[:.]/g, '-');
    
    const setupRecordPage = () => {
        if (isMobile()) {
            currentRecordMode = 'compatible';
        } else {
            currentRecordMode = 'fast';
        }
        recordModeSelect.value = currentRecordMode;

        if (!window.Subtitles) return;
        window.Subtitles.parseTable();
        const headers = window.Subtitles.getHeaders();
        recordVersionsList.innerHTML = '';
        const defaultLabel = document.createElement('label');
        defaultLabel.innerHTML = `<input type="checkbox" value="Дефолтная версия" data-index="1" /> Дефолтная версия`;
        recordVersionsList.appendChild(defaultLabel);
        if (headers.length > 2) {
            headers.slice(2).forEach((header, index) => {
                const label = document.createElement('label');
                label.innerHTML = `<input type="checkbox" value="${header}" data-index="${index + 2}" /> ${header}`;
                recordVersionsList.appendChild(label);
            });
        }
    };
    
    const startStopwatch = () => {
        stopwatchTime = 0;
        stopwatchEl.textContent = formatStopwatch(stopwatchTime);
        stopwatchInterval = setInterval(() => {
            stopwatchTime++;
            stopwatchEl.textContent = formatStopwatch(stopwatchTime);
        }, 1000);
    };

    const stopStopwatch = () => clearInterval(stopwatchInterval);

    // --- Recording Logic ---

    // FAST MODE (Desktop): Uses mediabunny for accelerated offline rendering
    const recordVersion_Fast = async (job, subtitles, duration, timestampStr, onProgress) => {
        const { canvas, textIndex, name } = job;
        const ctx = canvas.getContext('2d');
        const drawText = window.DisplaySettings.createDrawTextFunction(canvas, ctx);

        const output = new Output({
            format: new Mp4OutputFormat(),
            target: new BufferTarget()
        });
        const videoSource = new CanvasSource(canvas, { codec: 'avc', bitrate: 5_000_000 });
        output.addVideoTrack(videoSource);
        await output.start();

        const totalFrames = Math.floor(duration * FRAME_RATE);
        for (let i = 0; i < totalFrames; i++) {
            const timestamp = i / FRAME_RATE;
            const activeSubtitleIndex = subtitles.findIndex(sub => timestamp < sub.time);
            let primaryText = '', secondaryText = '', opacity = 0;
            if (activeSubtitleIndex !== -1) {
                const activeSub = subtitles[activeSubtitleIndex];
                const segmentStartTime = (activeSubtitleIndex > 0) ? subtitles[activeSubtitleIndex - 1].time : 0;
                opacity = window.DisplaySettings.calculateOpacity(timestamp, segmentStartTime, activeSub.time);
                if (opacity > 0) {
                    primaryText = activeSub.texts[0] || '';
                    if (textIndex >= 2) secondaryText = activeSub.texts[textIndex - 1] || '';
                }
            }
            drawText(primaryText, secondaryText, opacity);
            await videoSource.add(timestamp, 1 / FRAME_RATE);
            if (i % 10 === 0) onProgress(i / totalFrames);
        }
        
        onProgress(1);
        await output.finalize();

        return { name: `${name}_${timestampStr}.mp4`, blob: new Blob([output.target.buffer], { type: 'video/mp4' }) };
    };

    // COMPATIBLE MODE (Mobile): Uses MediaRecorder for real-time, reliable rendering
    const recordVersion_Compatible = (job, subtitles, duration) => new Promise((resolve, reject) => {
        const { canvas, textIndex } = job;
        const ctx = canvas.getContext('2d');
        const drawText = window.DisplaySettings.createDrawTextFunction(canvas, ctx);
        const stream = canvas.captureStream(FRAME_RATE);

        const getSupportedMimeType = () => {
            const types = ['video/mp4;codecs=avc1.42E01E', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
            for (const type of types) {
                if (MediaRecorder.isTypeSupported(type)) {
                    console.log(`Using supported MIME type: ${type}`);
                    return type;
                }
            }
            console.log('No preferred MIME type supported, letting browser decide.');
            return '';
        };

        const mimeType = getSupportedMimeType();
        if (!window.MediaRecorder) {
            return reject(new Error('MediaRecorder API not supported on this browser.'));
        }
        
        try {
            mediaRecorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: BITRATE });
        } catch(e) {
            console.error("MediaRecorder instantiation failed:", e);
            return reject(e);
        }

        recordedChunks = [];
        mediaRecorder.onstart = () => {
            console.log('COMPATIBLE MODE: MediaRecorder started successfully.');
        };
        mediaRecorder.ondataavailable = (event) => {
            console.log(`COMPATIBLE MODE: data available, size: ${event.data.size}`);
            if (event.data.size > 0) {
                recordedChunks.push(event.data);
            }
        };
        mediaRecorder.onerror = (event) => {
            console.error('COMPATIBLE MODE: MediaRecorder error:', event.error);
            reject(event.error);
        };
        mediaRecorder.onstop = () => {
            console.log(`COMPATIBLE MODE: MediaRecorder stopped. Chunks recorded: ${recordedChunks.length}`);
            const blob = new Blob(recordedChunks, { type: mimeType.split(';')[0] || 'video/webm' });
            cancelAnimationFrame(animationFrameId);

            if (blob.size === 0) {
                console.error('COMPATIBLE MODE: Recording failed, blob is empty.');
                reject(new Error('Recording resulted in an empty file. The browser may not support canvas recording properly.'));
            } else {
                console.log(`COMPATIBLE MODE: Blob created successfully, size: ${blob.size}`);
                resolve(blob);
            }
        };

        let startTime = null;
        mediaRecorder.start();
        const render = (timestamp) => {
            if (!startTime) startTime = timestamp;
            const elapsed = (timestamp - startTime) / 1000;

            if (elapsed >= duration) {
                if (mediaRecorder.state === 'recording') {
                    mediaRecorder.stop();
                }
                return;
            }
            
            const activeSubtitleIndex = subtitles.findIndex(sub => elapsed < sub.time);
            let primaryText = '', secondaryText = '', opacity = 0;
            if (activeSubtitleIndex !== -1) {
                const activeSub = subtitles[activeSubtitleIndex];
                const segmentStartTime = (activeSubtitleIndex > 0) ? subtitles[activeSubtitleIndex - 1].time : 0;
                opacity = window.DisplaySettings.calculateOpacity(elapsed, segmentStartTime, activeSub.time);
                if (opacity > 0) {
                    primaryText = activeSub.texts[0] || '';
                    if (textIndex >= 2) secondaryText = activeSub.texts[textIndex - 1] || '';
                }
            }
            
            drawText(primaryText, secondaryText, opacity);
            animationFrameId = requestAnimationFrame(render);
        };
        animationFrameId = requestAnimationFrame(render);
    });

    // --- Main Handler ---
    const handleStartRecording = async () => {
        if (isRecording) return;
        const selectedInputs = Array.from(recordVersionsList.querySelectorAll('input:checked'));
        if (selectedInputs.length === 0) return alert('Пожалуйста, выберите хотя бы одну версию для записи.');
        
        const confirmed = await showConfirmation(`Вы уверены, что хотите записать ${selectedInputs.length} видео?`);
        if (!confirmed) return;

        const useFastMode = currentRecordMode === 'fast';
        
        isRecording = true;
        recordStartBtn.disabled = true;
        downloadBtn.disabled = true;
        progressBlock.classList.remove('hidden');

        window.Subtitles.parseTable();
        const subtitles = window.Subtitles.getSubtitles().filter(sub => sub.time !== null && sub.time >= 0).sort((a, b) => a.time - b.time);
        const duration = subtitles.length > 0 ? subtitles[subtitles.length - 1].time : 0;

        if (duration <= 0) {
            statusText.textContent = 'Ошибка: нет тайм-кодов для записи.';
            isRecording = false;
            recordStartBtn.disabled = false;
            return;
        }

        startStopwatch();
        const timestampStr = getTimestamp();
        let successCount = 0;
        const createdCanvases = [];

        if (useFastMode) {
            // --- FAST MODE LOGIC ---
            statusText.textContent = `Идет быстрая запись ${selectedInputs.length} видео...`;
            const jobs = selectedInputs.map(input => {
                const canvas = document.createElement('canvas');
                hiddenCanvasContainer.appendChild(canvas);
                createdCanvases.push(canvas);
                return { name: input.value, textIndex: parseInt(input.dataset.index, 10), canvas };
            });
            
            const jobProgress = new Array(jobs.length).fill(0);
            const updateOverallProgress = () => {
                const totalProgress = jobProgress.reduce((sum, p) => sum + p, 0);
                const overallPercentage = (totalProgress / jobs.length) * 100;
                progressBar.style.width = `${overallPercentage}%`;
                percentageEl.textContent = `${Math.floor(overallPercentage)}%`;
            };
            
            const recordingPromises = jobs.map((job, index) => 
                recordVersion_Fast(job, subtitles, duration, timestampStr, (p) => { jobProgress[index] = p; updateOverallProgress(); })
                    .catch(e => ({ error: true, name: job.name, message: e.message }))
            );
            const results = await Promise.all(recordingPromises);
            results.forEach(result => {
                if (result && !result.error) {
                    recordedVideos.push(result);
                    addVideoToDownloadList(result.name);
                    successCount++;
                } else console.error(`Failed to record ${result.name}:`, result.message);
            });

        } else {
            // --- COMPATIBLE MODE LOGIC ---
            statusText.textContent = `Идет запись в реальном времени...`;
            const canvas = document.createElement('canvas');
            hiddenCanvasContainer.appendChild(canvas);
            createdCanvases.push(canvas);
            const { width, height } = window.DisplaySettings.getResolution();
            canvas.width = width;
            canvas.height = height;

            const jobs = selectedInputs.map(input => ({
                name: input.value, textIndex: parseInt(input.dataset.index, 10), canvas
            }));
            
            for (let i = 0; i < jobs.length; i++) {
                const job = jobs[i];
                try {
                    statusText.textContent = `Запись (${i + 1}/${jobs.length}): ${job.name}`;
                    const blob = await recordVersion_Compatible(job, subtitles, duration);
                    const result = { name: `${job.name}_${timestampStr}.mp4`, blob };
                    recordedVideos.push(result);
                    addVideoToDownloadList(result.name);
                    successCount++;
                } catch (error) {
                    console.error(`Failed to record ${job.name}:`, error);
                    alert(`Не удалось записать ${job.name}. Проверьте консоль.`);
                }
                const overallPercentage = ((i + 1) / jobs.length) * 100;
                progressBar.style.width = `${overallPercentage}%`;
                percentageEl.textContent = `${Math.floor(overallPercentage)}%`;
            }
        }
        
        // --- Finalization ---
        stopStopwatch();
        statusText.textContent = `Запись завершена. Успешно: ${successCount} из ${selectedInputs.length}.`;
        createdCanvases.forEach(canvas => hiddenCanvasContainer.removeChild(canvas));
        isRecording = false;
        recordStartBtn.disabled = false;
        downloadBtn.disabled = false;
    };
    
    const addVideoToDownloadList = (name) => {
        if (downloadVideosList.querySelector('p')) downloadVideosList.innerHTML = '';
        const item = document.createElement('div');
        item.classList.add('video-list-item');
        item.innerHTML = `
            <label><input type="checkbox" value="${name}" checked /><span>${name}</span></label>
            <button class="play-video-btn" data-video-name="${name}"><img src="icons/Play.svg" alt="Play"></button>`;
        downloadVideosList.appendChild(item);
    };

    const handleDownload = async () => {
        const selectedInputs = Array.from(downloadVideosList.querySelectorAll('input:checked'));
        const filesToDownload = selectedInputs.map(input => input.value);
        if (filesToDownload.length === 0) return alert('Не выбрано ни одного видео для скачивания.');
        if (!await showConfirmation(`Вы уверены, что хотите скачать ${filesToDownload.length} видео?`)) return;
        filesToDownload.forEach(filename => {
            const video = recordedVideos.find(v => v.name === filename);
            if (video) downloadBlob(video.blob, video.name);
        });
    };

    recordStartBtn.addEventListener('click', handleStartRecording);
    downloadBtn.addEventListener('click', handleDownload);
    downloadVideosList.addEventListener('click', (e) => {
        const playBtn = e.target.closest('.play-video-btn');
        if (!playBtn) return;
        const videoName = playBtn.dataset.videoName;
        const video = recordedVideos.find(v => v.name === videoName);
        if (video) {
            if (currentVideoUrl) URL.revokeObjectURL(currentVideoUrl);
            currentVideoUrl = URL.createObjectURL(video.blob);
            videoPlayer.src = currentVideoUrl;
            videoPlayerModal.classList.remove('hidden');
            videoPlayer.play().catch(err => console.error("Error playing video:", err));
        }
    });

    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.attributeName === 'class' && page.classList.contains('active')) {
                setupRecordPage();
            }
        });
    });
    observer.observe(page, { attributes: true });

    if (page.classList.contains('active')) setupRecordPage();
});