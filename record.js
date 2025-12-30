import { Output, Mp4OutputFormat, BufferTarget, CanvasSource } from './mediabunny.mjs';

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const page = document.getElementById('page-record');
    if (!page) return;

    // --- Main Page Buttons ---
    const openVersionsModalBtn = document.getElementById('open-versions-modal-btn');
    const recordStartBtn = document.getElementById('record-start-btn');
    const openDownloadModalBtn = document.getElementById('open-download-modal-btn');
    const downloadBtn = document.getElementById('download-selected-btn');

    // --- Modals & Lists ---
    const recordVersionsModal = document.getElementById('record-versions-modal');
    const recordVersionsList = document.getElementById('record-versions-list');
    const recordVersionsCloseBtn = document.getElementById('record-versions-close-btn');
    
    const downloadModal = document.getElementById('download-modal');
    const downloadVideosList = document.getElementById('download-videos-list');
    const downloadModalCloseBtn = document.getElementById('download-modal-close-btn');

    const videoPlayerModal = document.getElementById('video-player-modal');
    const videoPlayer = document.getElementById('video-player');
    const videoPlayerCloseBtn = document.getElementById('video-player-close-btn');

    // --- Progress & Other ---
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

    // --- State ---
    let isRecording = false;
    const recordedVideos = [];
    let stopwatchInterval = null;
    let stopwatchTime = 0;
    let currentVideoUrl = null;

    // --- UI Handlers ---
    openVersionsModalBtn.addEventListener('click', () => recordVersionsModal.classList.remove('hidden'));
    recordVersionsCloseBtn.addEventListener('click', () => recordVersionsModal.classList.add('hidden'));
    openDownloadModalBtn.addEventListener('click', () => downloadModal.classList.remove('hidden'));
    downloadModalCloseBtn.addEventListener('click', () => downloadModal.classList.add('hidden'));

    videoPlayerCloseBtn.addEventListener('click', () => {
        videoPlayerModal.classList.add('hidden');
        videoPlayer.pause();
        if (currentVideoUrl) {
            URL.revokeObjectURL(currentVideoUrl);
            currentVideoUrl = null;
        }
        videoPlayer.src = '';
    });

    // --- Utility Functions ---
    const showConfirmation = (message) => {
        return new Promise((resolve) => {
            confirmationMessage.textContent = message;
            confirmationModal.classList.remove('hidden');
            const onConfirm = () => {
                confirmationModal.classList.add('hidden');
                confirmBtn.removeEventListener('click', onConfirm);
                cancelBtn.removeEventListener('click', onCancel);
                resolve(true);
            };
            const onCancel = () => {
                confirmationModal.classList.add('hidden');
                confirmBtn.removeEventListener('click', onConfirm);
                cancelBtn.removeEventListener('click', onCancel);
                resolve(false);
            };
            confirmBtn.addEventListener('click', onConfirm);
            cancelBtn.addEventListener('click', onCancel);
        });
    };
    
    const formatStopwatch = (time) => {
        const h = Math.floor(time / 3600).toString().padStart(2, '0');
        const m = Math.floor((time % 3600) / 60).toString().padStart(2, '0');
        const s = Math.floor(time % 60).toString().padStart(2, '0');
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

    const getTimestamp = () => {
        const d = new Date();
        const year = d.getFullYear();
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const day = d.getDate().toString().padStart(2, '0');
        const hour = d.getHours().toString().padStart(2, '0');
        const minute = d.getMinutes().toString().padStart(2, '0');
        return `${year}-${month}-${day}_${hour}-${minute}`;
    };

    // --- Page Setup ---
    const setupRecordPage = () => {
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
    
    // --- Recording Logic ---
    const startStopwatch = () => {
        stopwatchTime = 0;
        stopwatchEl.textContent = formatStopwatch(stopwatchTime);
        stopwatchInterval = setInterval(() => {
            stopwatchTime++;
            stopwatchEl.textContent = formatStopwatch(stopwatchTime);
        }, 1000);
    };

    const stopStopwatch = () => {
        clearInterval(stopwatchInterval);
    };

    const recordVersion = async (job, subtitles, duration, timestampStr, onProgress) => {
        const canvas = job.canvas;
        const ctx = canvas.getContext('2d');
        const drawText = window.DisplaySettings.createDrawTextFunction(canvas, ctx);

        const FRAME_RATE = 30;
        const BITRATE = 5_000_000;

        const output = new Output({
            format: new Mp4OutputFormat(),
            target: new BufferTarget()
        });
        const videoSource = new CanvasSource(canvas, { codec: 'avc', bitrate: BITRATE });
        output.addVideoTrack(videoSource);
        await output.start();

        const totalFrames = Math.floor(duration * FRAME_RATE);
        
        for (let i = 0; i < totalFrames; i++) {
            const timestamp = i / FRAME_RATE;
            
            const activeSubtitleIndex = subtitles.findIndex(sub => timestamp < sub.time);
            
            let primaryText = '';
            let secondaryText = '';
            let opacity = 0;

            if (activeSubtitleIndex !== -1) {
                const activeSub = subtitles[activeSubtitleIndex];
                const segmentStartTime = (activeSubtitleIndex > 0) ? subtitles[activeSubtitleIndex - 1].time : 0;
                const segmentEndTime = activeSub.time;

                opacity = window.DisplaySettings.calculateOpacity(timestamp, segmentStartTime, segmentEndTime);

                if (opacity > 0) {
                    primaryText = activeSub.texts[0] || '';
                    if (job.textIndex >= 2) {
                        secondaryText = activeSub.texts[job.textIndex - 1] || '';
                    }
                }
            }
            
            drawText(primaryText, secondaryText, opacity);
            await videoSource.add(timestamp, 1 / FRAME_RATE);

            if (i % 10 === 0) { // Update progress less frequently
                onProgress(i / totalFrames);
            }
        }
        
        onProgress(1); // Final progress update
        await output.finalize();

        return {
            name: `${job.name}_${timestampStr}.mp4`,
            blob: new Blob([output.target.buffer], { type: 'video/mp4' })
        };
    };

    const handleStartRecording = async () => {
        if (isRecording) return;

        const selectedInputs = Array.from(recordVersionsList.querySelectorAll('input:checked'));
        if (selectedInputs.length === 0) {
            alert('Пожалуйста, выберите хотя бы одну версию для записи.');
            return;
        }
        
        const jobs = selectedInputs.map(input => {
            const canvas = document.createElement('canvas');
            hiddenCanvasContainer.appendChild(canvas);
            return {
                name: input.value,
                textIndex: parseInt(input.dataset.index, 10),
                canvas: canvas, // Attach canvas to job
            };
        });

        const confirmed = await showConfirmation(`Вы уверены, что хотите записать ${jobs.length} видео?`);
        if (!confirmed) {
            // Clean up created canvases if user cancels
            jobs.forEach(job => hiddenCanvasContainer.removeChild(job.canvas));
            return;
        }

        isRecording = true;
        recordStartBtn.disabled = true;
        downloadBtn.disabled = true;
        progressBlock.classList.remove('hidden');
        statusText.textContent = 'Подготовка к записи...';

        window.Subtitles.parseTable();
        const subtitles = window.Subtitles.getSubtitles().filter(sub => sub.time !== null && sub.time >= 0).sort((a, b) => a.time - b.time);
        const duration = subtitles.length > 0 ? subtitles[subtitles.length - 1].time : 0;
        
        if (duration <= 0) {
            statusText.textContent = 'Ошибка: нет тайм-кодов для записи.';
            isRecording = false;
            recordStartBtn.disabled = false;
            downloadBtn.disabled = false;
            jobs.forEach(job => hiddenCanvasContainer.removeChild(job.canvas));
            return;
        }

        startStopwatch();
        const timestampStr = getTimestamp();
        
        const jobProgress = new Array(jobs.length).fill(0);
        const updateOverallProgress = () => {
            const totalProgress = jobProgress.reduce((sum, p) => sum + p, 0);
            const overallPercentage = (totalProgress / jobs.length) * 100;
            progressBar.style.width = `${overallPercentage}%`;
            percentageEl.textContent = `${Math.floor(overallPercentage)}%`;
        };
        
        statusText.textContent = `Идет запись ${jobs.length} видео...`;

        const recordingPromises = jobs.map((job, index) => 
            recordVersion(
                job, 
                subtitles, 
                duration, 
                timestampStr,
                (progress) => { // onProgress callback
                    jobProgress[index] = progress;
                    updateOverallProgress();
                }
            ).catch(error => {
                console.error(`Failed to record ${job.name}:`, error);
                // Return an error object to identify failed jobs
                return { error: true, name: job.name, message: error.message };
            })
        );

        const results = await Promise.all(recordingPromises);

        stopStopwatch();
        
        let successCount = 0;
        results.forEach(result => {
            if (result && !result.error) {
                recordedVideos.push(result);
                addVideoToDownloadList(result.name);
                successCount++;
            }
        });
        
        statusText.textContent = `Запись завершена. Успешно: ${successCount} из ${jobs.length}.`;

        // Clean up all canvases
        jobs.forEach(job => hiddenCanvasContainer.removeChild(job.canvas));

        isRecording = false;
        recordStartBtn.disabled = false;
        downloadBtn.disabled = false;
    };
    
    const addVideoToDownloadList = (name) => {
        if (downloadVideosList.querySelector('p')) {
            downloadVideosList.innerHTML = ''; // Clear the "no videos" message
        }
        const item = document.createElement('div');
        item.classList.add('video-list-item');
        item.innerHTML = `
            <label>
                <input type="checkbox" value="${name}" checked />
                <span>${name}</span>
            </label>
            <button class="play-video-btn" data-video-name="${name}">
                <img src="icons/Play.svg" alt="Play">
            </button>
        `;
        downloadVideosList.appendChild(item);
    };

    const handleDownload = async () => {
        const selectedInputs = Array.from(downloadVideosList.querySelectorAll('input:checked'));
        const filesToDownload = selectedInputs.map(input => input.value);
        if (filesToDownload.length === 0) {
            alert('Не выбрано ни одного видео для скачивания.');
            return;
        }
        const confirmed = await showConfirmation(`Вы уверены, что хотите скачать ${filesToDownload.length} видео?`);
        if (!confirmed) return;
        filesToDownload.forEach(filename => {
            const video = recordedVideos.find(v => v.name === filename);
            if (video) {
                downloadBlob(video.blob, video.name);
            }
        });
    };

    // --- Event Listeners ---
    recordStartBtn.addEventListener('click', handleStartRecording);
    downloadBtn.addEventListener('click', handleDownload);

    downloadVideosList.addEventListener('click', (e) => {
        const playBtn = e.target.closest('.play-video-btn');
        if (!playBtn) return;

        const videoName = playBtn.dataset.videoName;
        const video = recordedVideos.find(v => v.name === videoName);

        if (video) {
            if (currentVideoUrl) {
                URL.revokeObjectURL(currentVideoUrl);
            }
            currentVideoUrl = URL.createObjectURL(video.blob);
            videoPlayer.src = currentVideoUrl;
            videoPlayerModal.classList.remove('hidden');
            videoPlayer.play();
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

    if (page.classList.contains('active')) {
        setupRecordPage();
    }
});