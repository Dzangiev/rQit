document.addEventListener('DOMContentLoaded', () => {
    // --- Table Page DOM Elements ---
    const mainTable = document.getElementById('main-table');
    const btnAddLanguage = document.getElementById('btn-add-language');
    const btnAddRowBottom = document.getElementById('btn-add-row-bottom');
    const btnClearTable = document.getElementById('btn-clear-table');
    const btnAddManual = document.getElementById('btn-add-manual');
    const btnAddFromQuran = document.getElementById('btn-add-from-quran');
    const btnExportTable = document.getElementById('btn-export-table');
    const btnExportJSON = document.getElementById('btn-export-json');
    const btnExportCapCut = document.getElementById('btn-export-capcut');
    const importTableInput = document.getElementById('import-table-input');
    const btnUndo = document.getElementById('btn-undo');
    const btnRedo = document.getElementById('btn-redo');
    const btnSplitText = document.getElementById('btn-split-text');

    // --- Confirmation Modal DOM Elements ---
    const confirmationModal = document.getElementById('confirmation-modal');
    const confirmationMessage = document.getElementById('confirmation-message');
    const confirmBtn = document.getElementById('confirm-btn');
    const cancelBtn = document.getElementById('cancel-btn');

    // --- Manual Add Modal DOM Elements ---
    const manualAddModal = document.getElementById('manual-add-modal');
    const manualInputH = document.getElementById('manual-h');
    const manualInputM = document.getElementById('manual-m');
    const manualInputS = document.getElementById('manual-s');
    const manualInputCS = document.getElementById('manual-cs');
    const manualAddSaveBtn = document.getElementById('manual-add-save-btn');
    const manualAddCancelBtn = document.getElementById('manual-add-cancel-btn');

    // --- Quran Import Modal DOM Elements ---
    const quranImportModal = document.getElementById('quran-import-modal');
    const quranSurahSelect = document.getElementById('quran-surah-select');
    const quranReciterSelect = document.getElementById('quran-reciter-select');
    const quranAyahStartInput = document.getElementById('quran-ayah-start');
    const quranAyahEndInput = document.getElementById('quran-ayah-end');
    const quranImportConfirmBtn = document.getElementById('quran-import-confirm-btn');
    const quranImportCancelBtn = document.getElementById('quran-import-cancel-btn');
    const quranScriptSelect = document.getElementById('quran-script-select'); // New element
    const quranLangCollapsibleTrigger = document.getElementById('quran-lang-collapsible-trigger');
    const quranLangListContainer = document.getElementById('quran-lang-list-container');

    // ...


    const editTimestampModal = document.getElementById('edit-timestamp-modal');
    const editInputH = document.getElementById('edit-h');
    const editInputM = document.getElementById('edit-m');
    const editInputS = document.getElementById('edit-s');
    const editInputCS = document.getElementById('edit-cs');
    const editTimestampSaveBtn = document.getElementById('edit-timestamp-save-btn');
    const editTimestampDeleteBtn = document.getElementById('edit-timestamp-delete-btn');
    const editTimestampCancelBtn = document.getElementById('edit-timestamp-cancel-btn');

    let onConfirmCallback = null;
    let activeCellForSplit = null;
    let editingTimestampRowIndex = -1; // To store the index of the row being edited
    let isSplittingText = false; // New flag to prevent duplicate saveState calls during splitting

    // --- Undo/Redo State ---
    let history = [];
    let historyIndex = -1;

    let availableTranslations = [];
    const API_BASE_URL = 'https://api.quran.com/api/v4';
    const QURAN_LANG_STORAGE_KEY = 'quranImportLanguages';

    // --- Modal Logic ---
    const showConfirmationModal = (message, callback) => {
        confirmationMessage.textContent = message;
        onConfirmCallback = callback;
        confirmationModal.classList.remove('hidden');
    };

    const hideConfirmationModal = () => {
        confirmationModal.classList.add('hidden');
        onConfirmCallback = null;
    };

    const showManualAddModal = () => {
        manualInputH.value = '';
        manualInputM.value = '';
        manualInputS.value = '';
        manualInputCS.value = '';
        manualAddModal.classList.remove('hidden');
    };

    const hideManualAddModal = () => {
        manualAddModal.classList.add('hidden');
    };

    const showEditTimestampModal = (rowIndex, timeInSeconds) => {
        editingTimestampRowIndex = rowIndex;
        const h = Math.floor(timeInSeconds / 3600);
        const m = Math.floor((timeInSeconds % 3600) / 60);
        const s = Math.floor(timeInSeconds % 60);
        const cs = Math.floor((timeInSeconds - Math.floor(timeInSeconds)) * 100);

        editInputH.value = h.toString().padStart(2, '0');
        editInputM.value = m.toString().padStart(2, '0');
        editInputS.value = s.toString().padStart(2, '0');
        editInputCS.value = cs.toString().padStart(2, '0');
        editTimestampModal.classList.remove('hidden');
    };

    const hideEditTimestampModal = () => {
        editTimestampModal.classList.add('hidden');
        editingTimestampRowIndex = -1;
    };

    const fetchSurahs = async () => {
        if (quranSurahSelect.options.length > 1) return; // Already populated
        try {
            const response = await fetch(`${API_BASE_URL}/chapters?language=en`);
            const data = await response.json();
            data.chapters.forEach(chapter => {
                const option = document.createElement('option');
                option.value = chapter.id;
                option.textContent = `${chapter.id}. ${chapter.name_simple} (${chapter.name_arabic})`;
                option.dataset.versesCount = chapter.verses_count;
                quranSurahSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Error fetching chapters:', error);
            alert('Не удалось загрузить список сур.');
        }
    };

    const fetchTranslations = async () => {
        if (availableTranslations.length > 0) return; // Already fetched
        try {
            const response = await fetch(`${API_BASE_URL}/resources/translations`);
            const data = await response.json();
            // Filter or just use top ones? Let's keep it simple and filter by some popular ones or just show all but sorted.
            // For now, let's take all.
            availableTranslations = data.translations.sort((a, b) => a.language_name.localeCompare(b.language_name));
            populateLanguageList();
        } catch (error) {
            console.error('Error fetching translations:', error);
            alert('Не удалось загрузить список переводов.');
        }
    };

    const populateLanguageList = () => {
        quranLangListContainer.innerHTML = '';
        const savedLangs = JSON.parse(localStorage.getItem(QURAN_LANG_STORAGE_KEY)) || [];

        // Add Select All Checkbox
        const allLabel = document.createElement('label');
        allLabel.innerHTML = `<strong><input type="checkbox" id="quran-lang-select-all"> Выбрать все</strong>`;
        quranLangListContainer.appendChild(allLabel);

        // Group translations by language_name
        const grouped = availableTranslations.reduce((acc, lang) => {
            const key = lang.language_name;
            if (!acc[key]) acc[key] = [];
            acc[key].push(lang);
            return acc;
        }, {});

        // Sort language names
        const sortedLangNames = Object.keys(grouped).sort();

        sortedLangNames.forEach(langName => {
            const group = grouped[langName];
            
            // Create a details element for the group
            const details = document.createElement('details');
            details.style.marginBottom = '5px';
            details.style.border = '1px solid #ccc';
            details.style.borderRadius = '4px';
            details.style.padding = '5px';

            const summary = document.createElement('summary');
            summary.style.cursor = 'pointer';
            summary.style.fontWeight = 'bold';
            summary.textContent = `${langName} (${group.length})`;
            details.appendChild(summary);

            const listContainer = document.createElement('div');
            listContainer.style.marginLeft = '15px';
            listContainer.style.marginTop = '5px';
            listContainer.style.display = 'flex';
            listContainer.style.flexDirection = 'column';

            group.forEach(lang => {
                const label = document.createElement('label');
                const isChecked = savedLangs.includes(String(lang.id));
                label.innerHTML = `<input type="checkbox" class="quran-lang-checkbox" value="${lang.id}" data-lang-name="${lang.language_name} - ${lang.name}" ${isChecked ? 'checked' : ''}> ${lang.name}`;
                listContainer.appendChild(label);
            });

            details.appendChild(listContainer);
            quranLangListContainer.appendChild(details);
        });

        const selectAllCheckbox = document.getElementById('quran-lang-select-all');
        const langCheckboxes = quranLangListContainer.querySelectorAll('.quran-lang-checkbox');

        const updateSelectAllState = () => {
            if (langCheckboxes.length === 0) return;
            selectAllCheckbox.checked = Array.from(langCheckboxes).every(cb => cb.checked);
        };

        updateSelectAllState();

        selectAllCheckbox.addEventListener('change', () => {
            langCheckboxes.forEach(cb => {
                cb.checked = selectAllCheckbox.checked;
            });
        });

        langCheckboxes.forEach(cb => {
            cb.addEventListener('change', updateSelectAllState);
        });
    };


    const fetchReciters = async () => {
        if (quranReciterSelect.options.length > 1) return;
        try {
            const response = await fetch(`${API_BASE_URL}/resources/recitations?language=en`);
            const data = await response.json();
            data.recitations.sort((a, b) => a.reciter_name.localeCompare(b.reciter_name)).forEach(reciter => {
                const option = document.createElement('option');
                option.value = reciter.id;
                option.textContent = `${reciter.reciter_name} (${reciter.style ? reciter.style : 'Murattal'})`;
                quranReciterSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Error fetching reciters:', error);
            // Non-critical, just alert or ignore
        }
    };

    const showQuranImportModal = () => {
        quranSurahSelect.value = '';
        quranReciterSelect.value = '';
        quranAyahStartInput.value = '1';
        quranAyahEndInput.value = '';
        
        fetchSurahs();
        fetchReciters();
        fetchTranslations();
        // populateLanguageList is called inside fetchTranslations once data is ready
        quranImportModal.classList.remove('hidden');
    };

    const hideQuranImportModal = () => {
        quranImportModal.classList.add('hidden');
        quranLangListContainer.classList.add('hidden');
    };

    confirmBtn.addEventListener('click', () => {
        if (onConfirmCallback) {
            onConfirmCallback();
        }
        hideConfirmationModal();
    });

    cancelBtn.addEventListener('click', hideConfirmationModal);
    manualAddCancelBtn.addEventListener('click', hideManualAddModal);
    quranImportCancelBtn.addEventListener('click', hideQuranImportModal);
    quranLangCollapsibleTrigger.addEventListener('click', () => {
        quranLangListContainer.classList.toggle('hidden');
    });

    manualAddSaveBtn.addEventListener('click', () => {
        const h = parseInt(manualInputH.value || 0, 10);
        const m = parseInt(manualInputM.value || 0, 10);
        const s = parseInt(manualInputS.value || 0, 10);
        const cs = parseInt(manualInputCS.value || 0, 10);

        if (h > 99 || m > 59 || s > 59 || cs > 99 || h < 0 || m < 0 || s < 0 || cs < 0) {
            alert('Неверный формат времени.');
            return;
        }

        const timeInSeconds = h * 3600 + m * 60 + s + cs / 100;
        insertTimestampRow(timeInSeconds);
        hideManualAddModal();
    });

    editTimestampSaveBtn.addEventListener('click', () => {
        const h = parseInt(editInputH.value || 0, 10);
        const m = parseInt(editInputM.value || 0, 10);
        const s = parseInt(editInputS.value || 0, 10);
        const cs = parseInt(editInputCS.value || 0, 10);

        if (h > 99 || m > 59 || s > 59 || cs > 99 || h < 0 || m < 0 || s < 0 || cs < 0) {
            alert('Неверный формат времени.');
            return;
        }
        
        saveEditedTimestamp(h * 3600 + m * 60 + s + cs / 100);
        hideEditTimestampModal();
    });

    editTimestampDeleteBtn.addEventListener('click', () => {
        deleteTimestamp(editingTimestampRowIndex);
        hideEditTimestampModal();
    });

    editTimestampCancelBtn.addEventListener('click', hideEditTimestampModal);

    quranImportConfirmBtn.addEventListener('click', () => {
        const surah = parseInt(quranSurahSelect.value, 10);
        const ayahStartRaw = quranAyahStartInput.value.trim();
        const ayahEndRaw = quranAyahEndInput.value.trim();

        // Validate surah selection
        if (isNaN(surah) || surah < 1 || surah > 114) {
            alert('Пожалуйста, выберите суру.');
            return;
        }

        // Get max verses for selected surah
        const selectedOption = quranSurahSelect.options[quranSurahSelect.selectedIndex];
        const maxVerses = selectedOption ? parseInt(selectedOption.dataset.versesCount, 10) : 999;

        let ayahStart = null;
        let ayahEnd = null;

        // Parse and validate ayah start
        if (ayahStartRaw !== '') {
            ayahStart = parseInt(ayahStartRaw, 10);
            if (isNaN(ayahStart) || ayahStart < 1) {
                alert('Аят (начало) должен быть числом не меньше 1.');
                return;
            }
            if (ayahStart > maxVerses) {
                alert(`Аят (начало) не может быть больше ${maxVerses} (всего аятов в этой суре).`);
                return;
            }
        }

        // Parse and validate ayah end
        if (ayahEndRaw !== '') {
            ayahEnd = parseInt(ayahEndRaw, 10);
            if (isNaN(ayahEnd) || ayahEnd < 1) {
                alert('Аят (конец) должен быть числом не меньше 1.');
                return;
            }
            if (ayahEnd > maxVerses) {
                alert(`Аят (конец) не может быть больше ${maxVerses} (всего аятов в этой суре).`);
                return;
            }
        }

        // Cross-field validation
        if (ayahStart !== null && ayahEnd !== null) {
            if (ayahEnd < ayahStart) {
                alert('Аят (конец) не может быть меньше Аята (начало).');
                return;
            }
        } else if (ayahStart !== null && ayahEnd === null) {
            // If only start is provided, set end to max or same as start
            ayahEnd = maxVerses; // Load from start to end of surah
        } else if (ayahStart === null && ayahEnd !== null) {
            // If only end is provided, start from 1
            ayahStart = 1;
        }

        importFromQuran(surah, ayahStart, ayahEnd);
    });

    // --- Table State & History ---
    const getTableData = () => {
        const headers = Array.from(mainTable.querySelectorAll('thead th')).map(th => {
            return th.querySelector('.header-text')?.innerText || th.innerText;
        });
        const body = Array.from(mainTable.querySelectorAll('tbody tr')).map(row => {
            return Array.from(row.querySelectorAll('td')).map(td => {
                return td.querySelector('.cell-content')?.innerText || '';
            });
        });
        return { headers, body };
    };

    const restoreTableFromData = (data) => {
        if (!data) return;

        const newHead = mainTable.querySelector('thead');
        const newBody = mainTable.querySelector('tbody');
        
        newHead.innerHTML = '';
        newBody.innerHTML = '';

        const headerRow = document.createElement('tr');
        data.headers.forEach((headerText, index) => {
            const th = document.createElement('th');
            if (index === 0) {
                th.innerHTML = `<div class="header-content">${headerText}<button class="btn btn--small btn-delete-col" style="visibility: hidden;"><span class="icon icon-x"></span></button></div>`;
            } else {
                th.innerHTML = `<div class="header-content"><div class="header-text" contenteditable="true">${headerText}</div><button class="btn btn--small btn-delete-col"><span class="icon icon-x"></span></button></div>`;
            }
            headerRow.appendChild(th);
        });
        newHead.appendChild(headerRow);

        data.body.forEach(rowData => {
            const tr = document.createElement('tr');
            rowData.forEach((cellText, index) => {
                const td = document.createElement('td');
                if (index === 0) {
                    td.innerHTML = `<div class="cell-content-wrapper"><button class="btn btn--small btn-delete-row"><span class="icon icon-x"></span></button><div class="cell-content">${cellText}</div></div>`;
                } else {
                    td.innerHTML = `<div class="cell-content-wrapper"><div class="cell-content" contenteditable="true">${cellText}</div></div>`;
                }
                tr.appendChild(td);
            });
            newBody.appendChild(tr);
        });

        updateAllEventListeners();
        window.Subtitles.parseTable();
        saveTable();
    };

    const saveState = () => {
        history = history.slice(0, historyIndex + 1);
        history.push(getTableData());
        historyIndex++;
        updateUndoRedoButtons();
    };

    const undo = () => {
        if (historyIndex > 0) {
            historyIndex--;
            restoreTableFromData(history[historyIndex]);
            updateUndoRedoButtons();
        }
    };

    const redo = () => {
        if (historyIndex < history.length - 1) {
            historyIndex++;
            restoreTableFromData(history[historyIndex]);
            updateUndoRedoButtons();
        }
    };

    const updateUndoRedoButtons = () => {
        btnUndo.disabled = historyIndex <= 0;
        btnRedo.disabled = historyIndex >= history.length - 1;
    };


    // --- Table Manipulation Logic ---
    const toEasternArabicNumerals = (num) => {
        const easternArabicNumerals = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
        return String(num).split('').map(digit => easternArabicNumerals[parseInt(digit)]).join('');
    };



    // ... (existing code)

    const importFromQuran = async (surah, ayahStart, ayahEnd) => {
        try {
            const selectedLangCheckboxes = quranLangListContainer.querySelectorAll('.quran-lang-checkbox:checked');
            const selectedLangIds = Array.from(selectedLangCheckboxes).map(cb => cb.value);
            
            // Save selection
            localStorage.setItem(QURAN_LANG_STORAGE_KEY, JSON.stringify(selectedLangIds));

            // Helper to get name by ID
            const getLangNameById = (id) => {
                const cb = Array.from(selectedLangCheckboxes).find(c => c.value === id);
                return cb ? cb.dataset.langName : id;
            };

            const originalBtnText = quranImportConfirmBtn.innerText;
            quranImportConfirmBtn.innerText = 'Загрузка...';
            quranImportConfirmBtn.disabled = true;

            let allVerses = [];
            let page = 1;
            let totalPages = 1;
            let verseTimings = [];
            let totalRawDuration = 0;
            
            const reciterId = quranReciterSelect.value;
            const scriptType = quranScriptSelect.value || 'text_uthmani';

            try {
                // Fetch Reciter Timestamps if selected
                if (reciterId) {
                    // ... (Comment block preserved) ...
                     const timeRes = await fetch(`${API_BASE_URL}/recitations/${reciterId}/by_chapter/${surah}`);
                     if (timeRes.ok) {
                         const timeData = await timeRes.json();
                         // (Abbreviated comments)
                    }
                }

                // Fetch loop for pagination
                do {
                    // Add audio param if reciter selected
                    let url = `${API_BASE_URL}/verses/by_chapter/${surah}?language=en&words=false&translations=${selectedLangIds.join(',')}&fields=${scriptType}&page=${page}&per_page=50`;
                    if (reciterId) {
                        url += `&audio=${reciterId}`;
                    }

                    const response = await fetch(url);
                    if (!response.ok) throw new Error('API Error');
                    const data = await response.json();
                    
                    if (data.verses) {
                        allVerses.push(...data.verses);
                    }
                    
                    if (data.pagination) {
                        totalPages = data.pagination.total_pages;
                    } else {
                        totalPages = 1;
                    }
                    page++;
                } while (page <= totalPages);

            } catch (error) {
                console.error('Fetch error:', error);
                alert('Ошибка при загрузке данных из API.');
                quranImportConfirmBtn.innerText = originalBtnText;
                quranImportConfirmBtn.disabled = false;
                return;
            }

            quranImportConfirmBtn.innerText = originalBtnText;
            quranImportConfirmBtn.disabled = false;

            // Filter by range if needed
            // API verses are 1-indexed in terms of content, but array is 0-indexed.
            let versesToInsert = allVerses;
            if (!isNaN(ayahStart) && !isNaN(ayahEnd)) {
                const startIdx = Math.max(0, ayahStart - 1);
                const endIdx = ayahEnd; 
                versesToInsert = allVerses.slice(startIdx, endIdx);
            }

            // Rebuild Table Headers
            const header = mainTable.querySelector('thead tr');
            while (header.children.length > 1) header.removeChild(header.lastChild);
            const rows = mainTable.querySelectorAll('tbody tr');
            rows.forEach(row => { while (row.children.length > 1) row.removeChild(row.lastChild); });

            // 1. Arabic Column
            const arabicHeader = document.createElement('th');
            arabicHeader.innerHTML = `<div class="header-content"><div class="header-text" contenteditable="true">Arabic</div><button class="btn btn--small btn-delete-col"><span class="icon icon-x"></span></button></div>`;
            header.appendChild(arabicHeader);

            // 2. Translation Columns
            selectedLangIds.forEach(id => {
                const langName = getLangNameById(id);
                const newHeaderCell = document.createElement('th');
                newHeaderCell.innerHTML = `<div class="header-content"><div class="header-text" contenteditable="true">${langName}</div><button class="btn btn--small btn-delete-col"><span class="icon icon-x"></span></button></div>`;
                header.appendChild(newHeaderCell);
            });

            // Rebuild Table Body
            const tBody = mainTable.querySelector('tbody');
            const numRowsToAdd = versesToInsert.length;
            const existingRows = tBody.rows.length;

            let currentRunningTime = 0; 
            // If we are strictly importing a range, start time is 0 relative to this clip? 
            // Or absolute? Let's assume 0 for the first imported verse.

            for (let i = 0; i < numRowsToAdd; i++) {
                const verse = versesToInsert[i];
                // verse_key is "1:1", verse_number is 1.
                // translations is array: [{resource_id: 131, text: "..."}]
                
                let row;
                if (i < existingRows) {
                    row = tBody.rows[i];
                    while (row.cells.length > 1) row.deleteCell(1);
                } else {
                    row = tBody.insertRow();
                    const firstCell = row.insertCell();
                    firstCell.innerHTML = `<div class="cell-content-wrapper"><button class="btn btn--small btn-delete-row"><span class="icon icon-x"></span></button><div class="cell-content"></div></div>`;
                }

                if (reciterId && verse.audio) {
                    let segDur = 0;
                    
                    // Prioritize actual file duration from CDN if URL exists
                    // This accounts for silence/tail that segments miss.
                    if (verse.audio.url) {
                        try {
                            const audioUrl = `https://verses.quran.com/${verse.audio.url}`;
                            // Create a temporary audio element to get duration
                            const tempAudio = new Audio(audioUrl);
                            tempAudio.preload = 'metadata';
                            
                            // Wrap in promise to await metadata
                            segDur = await new Promise((resolve) => {
                                tempAudio.onloadedmetadata = () => {
                                    const d = tempAudio.duration;
                                    resolve(isNaN(d) ? 0 : d);
                                };
                                tempAudio.onerror = () => resolve(0);
                                // Timeout fallback
                                setTimeout(() => resolve(0), 5000);
                            });

                            if (segDur > 0) {
                                console.log(`Verse ${verse.verse_key} Audio Duration: ${segDur}s`);
                            }
                        } catch (err) {
                            console.warn('Could not fetch audio metadata', err);
                        }
                    }

                    // Fallback to segments if CDN fetch failed or returned 0
                    if (segDur === 0 && verse.audio.segments && Array.isArray(verse.audio.segments) && verse.audio.segments.length > 0) {
                        const lastSegment = verse.audio.segments[verse.audio.segments.length - 1];
                        if (Array.isArray(lastSegment) && lastSegment.length >= 4) {
                            const rawEnd = parseInt(lastSegment[3], 10);
                            console.log(`Verse ${verse.verse_key} Raw Last Segment End: ${rawEnd} ms`);
                            totalRawDuration += rawEnd;
                            segDur = rawEnd / 1000; 
                        }
                    }
                    
                    if (segDur > 0) {
                         currentRunningTime += segDur;
                         const timeStr = formatTime(currentRunningTime);
                         const timeCell = row.cells[0].querySelector('.cell-content');
                         if (timeCell) timeCell.innerText = timeStr;
                    }
                }

                // Add Arabic Cell
                const arabicCell = row.insertCell();
                // Add eastern arabic numeral at end
                const verseNum = verse.verse_number || (i + 1); // Fallback
                
                // Get text based on selected script
                let rawArabicText = verse[scriptType] || verse['text_uthmani'] || ''; 

                const arabicText = rawArabicText + ' ' + toEasternArabicNumerals(verseNum);
                arabicCell.innerHTML = `<div class="cell-content-wrapper"><div class="cell-content" contenteditable="true" dir="rtl">${arabicText}</div></div>`;

                // Handle Timestamp from Audio
                // If we fetched audio, verse might have `audio` object.
                // It usually has `url` and `duration`? 
                // Getting *start time* of the verse in a continuous recitation is hard if it's just individual files.
                // However, if `audio` `url` is distinct for each verse, the text doesn't help us with "timestamp" unless we mean duration?
                // The user likely wants the timestamp relevant to the *surah* audio.
                // If `audio` returns a segment of a global file, it might not have relative time?
                // Actually, often `audio` has `url`.
                // Let's check if we can calculate it relative to previous?
                // For now, let's leave timestamp empty if we can't determine it, OR
                // if the API returns a `timestamp` or `startTime`?
                // `verse.audio.timestamp`?
                // If we don't have it, we just don't add description.
                
                // WAIT! If the user wants timestamps in the TABLE (first column), 
                // we currently expect seconds.
                // If we get audio URL, we don't necessarily get the start time in the file?
                // Actually, if it's verse-by-verse audio, start is 0?
                // If it's chapter audio, we need segments.
                // Let's assume we can't reliably get timestamps for the table just by selecting a reciter 
                // WITHOUT parsing segments which is complex.
                // BUT, maybe the `audio` field in verse response has `timestamp`?
                // Let's check `verse.audio`.
                // If not, we skip.
                
                // Refined Attempt:
                // Many apps use `quran.com` segments data.
                // If we can't get it easily, maybe we populate the table 
                // but timestamps remain 0 or cumulative if we have duration?
                // Let's try to use cumulative duration if available?
                // verse.audio.duration_ms / 1000.
                
                let timestampVal = '';
                if (verse.audio && verse.audio.duration) {
                     // If we have distinct audio files for each verse, we can't easily put "timestamp" for a single long video/audio
                     // UNLESS we are building a concatenation?
                     // The user asked "load timestamps" implies they exist.
                     // Maybe for syncing?
                     // Let's try to assume we are building a continuous timeline.
                     // So specific timestamp = sum(previous durations).
                     const duration = verse.audio.duration; // seconds? usually ms in some apis, but checking.
                     // Assuming we process in order.
                }

                // Temporary: The API v4 `verses` endpoint with `audio` param 
                // returns an `audio` object: { url: "...", duration_ms: ... } (or duration).
                // If we want a timeline, we can sum them up!
                // Let's DECLARE a running total outside the loop.
                // BUT we are slicing `versesToInsert`.
                // So we need to sum up from the start involved in `versesToInsert`.
                // Ideally start at 0 for the first imported verse?
                
                // Let's define `currentTimestamp` before loop.
                
                // Add Translation Cells
                selectedLangIds.forEach(id => {
                    const cell = row.insertCell();
                    // Find translation by resource_id. NOTE: id from checkbox is string, resource_id is int.
                    const translation = verse.translations.find(t => String(t.resource_id) === String(id));
                    // Remove footnotes? usually "<sup>1</sup>". API returns HTML sometimes.
                    // For now, raw html is risky in contenteditable but let's assume text.
                    // Actually API returns clean text usually unless footnotes requested.
                    const transText = translation ? translation.text : '';
                    cell.innerHTML = `<div class="cell-content-wrapper"><div class="cell-content" contenteditable="true">${transText}</div></div>`;
                });
            }
            
            while (tBody.rows.length > numRowsToAdd) tBody.deleteRow(numRowsToAdd);

            if (reciterId) {
                console.log(`Total Raw Duration Sum: ${totalRawDuration} ms`);
            }

            updateAllEventListeners();
            window.Subtitles.parseTable();
            saveTable();
            saveState();
            hideQuranImportModal();

        } catch (error) {
            console.error('Error loading Quran data:', error);
            alert('Не удалось загрузить данные Корана.');
            // undo(); // No undo here as we didn't push yet? Or state might be partial. 
            // Better to not call undo if we failed before touching table structure, but here we rebuild inside.
            // If error happened during fetch, table is untouched.
        }
    };

    const saveEditedTimestamp = (newTimeInSeconds) => {
        if (editingTimestampRowIndex === -1) return;

        const row = mainTable.querySelector('tbody').rows[editingTimestampRowIndex];
        const timeCell = row.cells[0]?.querySelector('.cell-content');
        sortAndCompactTable();
        saveState();
    };

    const deleteTimestamp = (rowIndex) => {
        const tBody = mainTable.querySelector('tbody');
        if (tBody && tBody.rows.length > rowIndex) {
            const timeCell = tBody.rows[rowIndex].cells[0]?.querySelector('.cell-content');
            if (timeCell) {
                timeCell.innerText = ''; // Clear only the timestamp
            }
            // The rest of the row's content remains untouched.
            
            window.Subtitles.parseTable();
            saveTable();
                    sortAndCompactTable();
                    saveState(); // User explicitly asked for sorting to be called
        }
    };


    const addColumn = () => {
        const header = mainTable.querySelector('thead tr');
        const newHeaderCell = document.createElement('th');
        newHeaderCell.innerHTML = `<div class="header-content"><div class="header-text" contenteditable="true">New Language</div><button class="btn btn--small btn-delete-col"><span class="icon icon-x"></span></button></div>`;
        header.appendChild(newHeaderCell);

        const rows = mainTable.querySelectorAll('tbody tr');
        rows.forEach(row => {
            const newCell = document.createElement('td');
            newCell.innerHTML = '<div class="cell-content-wrapper"><div class="cell-content" contenteditable="true"></div></div>';
            row.appendChild(newCell);
        });
        updateAllEventListeners();
        window.Subtitles.parseTable();
        saveTable();
        saveState();
    };

    const addRow = () => {
        const tBody = mainTable.querySelector('tbody');
        const newRow = document.createElement('tr');
        const colCount = mainTable.querySelector('thead tr').children.length;
        let cells = `<td><div class="cell-content-wrapper"><button class="btn btn--small btn-delete-row"><span class="icon icon-x"></span></button><div class="cell-content"></div></div></td>`;
        for (let i = 1; i < colCount; i++) {
            cells += '<td><div class="cell-content-wrapper"><div class="cell-content" contenteditable="true"></div></div></td>';
        }
        newRow.innerHTML = cells;
        tBody.appendChild(newRow);
        updateAllEventListeners();
        window.Subtitles.parseTable();
        saveTable();
        saveState();
    };
    
    const insertRowAfter = (currentRow) => {
        const tBody = mainTable.querySelector('tbody');
        const newRow = document.createElement('tr');
        const colCount = mainTable.querySelector('thead tr').children.length;
        let cells = `<td><div class="cell-content-wrapper"><button class="btn btn--small btn-delete-row"><span class="icon icon-x"></span></button><div class="cell-content"></div></div></td>`;
        for (let i = 1; i < colCount; i++) {
            cells += '<td><div class="cell-content-wrapper"><div class="cell-content" contenteditable="true"></div></div></td>';
        }
        newRow.innerHTML = cells;
        tBody.insertBefore(newRow, currentRow.nextSibling);
        updateAllEventListeners();
        return newRow;
    };

    const isRowEmpty = (row) => {
        if (!row) return false;
        const cells = row.querySelectorAll('.cell-content[contenteditable="true"]');
        return Array.from(cells).every(cell => cell.innerText.trim() === '');
    };

    const updateSplitButtonState = () => {
        if (!activeCellForSplit) {
            btnSplitText.disabled = true;
            return;
        }

        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) {
            btnSplitText.disabled = true;
            return;
        }

        const range = selection.getRangeAt(0);
        const cellText = activeCellForSplit.innerText;
        const cursorPosition = range.startOffset;

        // Check if the cursor is inside the active cell
        if (!activeCellForSplit.contains(range.commonAncestorContainer)) {
             btnSplitText.disabled = true;
             return;
        }

        if (cursorPosition > 0 && cursorPosition < cellText.length) {
            btnSplitText.disabled = false;
        } else {
            btnSplitText.disabled = true;
        }
    };

    const splitText = () => {
        if (!activeCellForSplit) {
            return;
        }

        isSplittingText = true; // Set flag to true

        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);
        const cursorPosition = range.startOffset;

        const originalText = activeCellForSplit.innerText;
        const textBeforeCursor = originalText.substring(0, cursorPosition);
        const textAfterCursor = originalText.substring(cursorPosition);

        activeCellForSplit.innerText = textBeforeCursor;

        const currentRow = activeCellForSplit.closest('tr');
        const nextRow = currentRow.nextElementSibling;
        const cellIndex = activeCellForSplit.closest('td').cellIndex;

        if (nextRow && isRowEmpty(nextRow)) {
            const targetCell = nextRow.cells[cellIndex].querySelector('.cell-content');
            if (targetCell) {
                targetCell.innerText = textAfterCursor;
            }
        } else {
            const newRow = insertRowAfter(currentRow);
            const targetCell = newRow.cells[cellIndex].querySelector('.cell-content');
            if (targetCell) {
                targetCell.innerText = textAfterCursor;
            }
        }

        activeCellForSplit.blur();
        updateSplitButtonState();
        window.Subtitles.parseTable();
        saveTable();
        sortAndCompactTable();
        saveState();
        isSplittingText = false; // Reset flag to false
    };

    const deleteColumn = (e) => {
        const btn = e.target.closest('.btn-delete-col');
        if (!btn) return;
        const th = btn.closest('th');
        const index = Array.from(th.parentNode.children).indexOf(th);
        if (index < 2) return;

        const header = mainTable.querySelector('thead tr');
        header.removeChild(header.children[index]);

        const rows = mainTable.querySelectorAll('tbody tr');
        rows.forEach(row => {
            if (row.children[index]) {
                row.removeChild(row.children[index]);
            }
        });
        updateAllEventListeners();
        window.Subtitles.parseTable();
        saveTable();
        saveState();
    };

    const deleteRow = (e) => {
        const btn = e.target.closest('.btn-delete-row');
        if (!btn) return;
        if (mainTable.querySelector('tbody').rows.length <= 1) return;
        
        const row = btn.closest('tr');
        row.parentNode.removeChild(row);
        updateAllEventListeners();
        window.Subtitles.parseTable();
        saveTable();
        saveState();
    };
    
    const clearTable = () => {
        const tBody = mainTable.querySelector('tbody');
        tBody.innerHTML = '';
        const header = mainTable.querySelector('thead tr');
        while (header.children.length > 2) {
            header.removeChild(header.lastChild);
        }

        const newRow = document.createElement('tr');
        const colCount = mainTable.querySelector('thead tr').children.length;
        let cells = `<td><div class="cell-content-wrapper"><button class="btn btn--small btn-delete-row"><span class="icon icon-x"></span></button><div class="cell-content"></div></div></td>`;
        for (let i = 1; i < colCount; i++) {
            cells += '<td><div class="cell-content-wrapper"><div class="cell-content" contenteditable="true"></div></div></td>';
        }
        newRow.innerHTML = cells;
        tBody.appendChild(newRow);

        updateAllEventListeners();
        window.Subtitles.parseTable();
        saveTable();
        saveState();
    };

    const clearAllTimestamps = () => {
        const timeCells = mainTable.querySelectorAll('tbody tr td:first-child .cell-content');
        timeCells.forEach(cell => {
            cell.innerText = '';
        });
        sortAndCompactTable();
        saveState();
    };

    const sortAndCompactTable = () => {
        const tBody = mainTable.querySelector('tbody');
        if (!tBody) return;

        const timeCells = Array.from(tBody.querySelectorAll('tr td:first-child .cell-content'));
        const timeValues = timeCells
            .map(cell => window.Subtitles.parseTimestamp(cell.innerText))
            .filter(time => time !== null);

        timeValues.sort((a, b) => a - b);

        timeCells.forEach((cell, index) => {
            cell.innerText = (index < timeValues.length) ? formatTime(timeValues[index]) : '';
        });
        
        window.Subtitles.parseTable();
        saveTable();
    };

    const updateDeleteColumnButtons = () => {
        const headers = mainTable.querySelectorAll('thead th');
        headers.forEach((th, index) => {
            const btn = th.querySelector('.btn-delete-col');
            if(btn) {
                btn.style.visibility = index < 2 ? 'hidden' : 'visible';
                btn.removeEventListener('click', deleteColumn);
                btn.addEventListener('click', deleteColumn);
            }
        });
    };
    const updateDeleteRowButtons = () => {
        const deleteButtons = mainTable.querySelectorAll('.btn-delete-row');
        deleteButtons.forEach(btn => {
            btn.removeEventListener('click', deleteRow);
            btn.addEventListener('click', deleteRow);
        });
    };

    const addCellInputListeners = () => {
        const cells = mainTable.querySelectorAll('td .cell-content[contenteditable="true"], th .header-text[contenteditable="true"]');
        cells.forEach(cell => {
            let initialValue = '';

            const onFocus = (event) => {
                initialValue = event.target.innerText;
                const td = event.target.closest('td');
                if (td && td.cellIndex === 1) { // Second column
                    activeCellForSplit = event.target;
                    updateSplitButtonState();
                }
            };
            const onBlur = (event) => {
                if (event.target.innerText !== initialValue && !isSplittingText) { // Only saveState if not splitting
                    saveState();
                }
                if (activeCellForSplit === event.target) {
                    activeCellForSplit = null;
                    updateSplitButtonState();
                }
            };
            const onInput = () => {
                window.Subtitles.parseTable();
                saveTable();
            };
            
            cell.removeEventListener('focus', onFocus);
            cell.addEventListener('focus', onFocus);
            cell.removeEventListener('blur', onBlur);
            cell.addEventListener('blur', onBlur);
            cell.removeEventListener('input', onInput);
            cell.addEventListener('input', onInput);
        });

        // Add click listener for timestamp cells (first column)
        const timestampCells = mainTable.querySelectorAll('tbody tr td:first-child .cell-content');
        timestampCells.forEach((cell, index) => {
            cell.removeEventListener('click', handleTimestampCellClick); // Prevent duplicate listeners
            cell.addEventListener('click', (event) => handleTimestampCellClick(event, index));
        });
    };

    const handleTimestampCellClick = (event, rowIndex) => {
        const cellContent = event.target.innerText;
        const timeInSeconds = window.Subtitles.parseTimestamp(cellContent);
        if (timeInSeconds !== null) {
            showEditTimestampModal(rowIndex, timeInSeconds);
        } else {
            showEditTimestampModal(rowIndex, 0); // Open with 0 if timestamp is empty/invalid
        }
    };
    
    let isSelectionListenerAttached = false;
    const updateAllEventListeners = () => {
        updateDeleteColumnButtons();
        updateDeleteRowButtons();
        addCellInputListeners();

        if (!isSelectionListenerAttached) {
            document.addEventListener('selectionchange', () => {
                if(activeCellForSplit && document.activeElement === activeCellForSplit) {
                    updateSplitButtonState();
                }
            });
            isSelectionListenerAttached = true;
        }
    };

    const formatTime = (seconds) => {
        if (isNaN(seconds)) return '00:00:00.00';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        const cs = Math.floor((seconds - Math.floor(seconds)) * 100);
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`;
    };

    const insertTimestampRow = (time) => {
        const subtitles = window.Subtitles.getSubtitles();
        for (const sub of subtitles) {
            if (sub.time !== null && Math.abs(sub.time - time) < 0.5) {
                alert(`Timestamp is too close to an existing one (${formatTime(sub.time)}).`);
                return;
            }
        }
        
        const formattedTime = formatTime(time);
        const tBody = mainTable.querySelector('tbody');
        
        const emptyCell = Array.from(tBody.querySelectorAll('tr td:first-child .cell-content')).find(cell => cell.innerText.trim() === '');

        if (emptyCell) {
            emptyCell.innerText = formattedTime;
        } else {
            const colCount = mainTable.querySelector('thead tr').children.length;
            const newRow = document.createElement('tr');
            let cells = `<td><div class="cell-content-wrapper"><button class="btn btn--small btn-delete-row"><span class="icon icon-x"></span></button><div class="cell-content">${formattedTime}</div></div></td>`;
            for (let i = 1; i < colCount; i++) {
                cells += '<td><div class="cell-content-wrapper"><div class="cell-content" contenteditable="true"></div></div></td>';
            }
            newRow.innerHTML = cells;
            tBody.appendChild(newRow);
        }
        
        sortAndCompactTable();
        saveState();
    };

    const clearTimestampByIndex = (index) => {
        const tBody = mainTable.querySelector('tbody');
        if (tBody && tBody.rows.length > index) {
            const cell = tBody.rows[index].cells[0]?.querySelector('.cell-content');
            if (cell) cell.innerText = '';
            sortAndCompactTable();
            saveState();
        }
    };

    const exportTable = () => {
        const table = mainTable;
        let csv = [];
        const headers = [];
        table.querySelectorAll('thead th').forEach(th => {
            const text = th.querySelector('.header-text')?.innerText || th.innerText;
            headers.push(`"${(text || '').replace(/"/g, '""').trim()}"`);
        });
        csv.push(headers.join(','));

        table.querySelectorAll('tbody tr').forEach(row => {
            const rowData = [];
            row.querySelectorAll('td').forEach(td => {
                const text = td.querySelector('.cell-content')?.innerText || '';
                rowData.push(`"${text.replace(/"/g, '""')}"`);
            });
            csv.push(rowData.join(','));
        });

        const csvString = '\uFEFF' + csv.join('\n');
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rqit-table-export-${new Date().toISOString()}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const exportJSON = () => {
        window.Subtitles.parseTable();
        const subtitles = window.Subtitles.getSubtitles();
        const jsonString = JSON.stringify(subtitles, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rqit-subtitles-${new Date().toISOString()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // --- CapCut Export Modal ---
    const capcutExportModal = document.getElementById('capcut-export-modal');
    const capcutColumnsList = document.getElementById('capcut-columns-list');
    const capcutExportConfirmBtn = document.getElementById('capcut-export-confirm-btn');
    const capcutExportCancelBtn = document.getElementById('capcut-export-cancel-btn');

    const positionOptions = [
        { value: '8', label: 'Верх по центру' },
        { value: '7', label: 'Верх слева' },
        { value: '9', label: 'Верх справа' },
        { value: '5', label: 'По центру' },
        { value: '4', label: 'Середина слева' },
        { value: '6', label: 'Середина справа' },
        { value: '2', label: 'Низ по центру' },
        { value: '1', label: 'Низ слева' },
        { value: '3', label: 'Низ справа' }
    ];

    const showCapCutExportModal = () => {
        // Получаем заголовки столбцов (кроме первого - таймкоды)
        const headers = [];
        mainTable.querySelectorAll('thead th').forEach((th, index) => {
            if (index > 0) {
                const text = th.querySelector('.header-text')?.innerText || th.innerText || `Column${index}`;
                headers.push({ index, name: text.trim() });
            }
        });

        if (headers.length === 0) {
            alert('Нет столбцов для экспорта.');
            return;
        }

        // Заполняем список колонок
        capcutColumnsList.innerHTML = '';
        headers.forEach((header, i) => {
            const item = document.createElement('div');
            item.className = 'capcut-column-item';
            item.style.cssText = 'display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid #333;';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `capcut-col-${i}`;
            checkbox.checked = true;
            checkbox.dataset.colIndex = i;
            checkbox.dataset.colName = header.name;

            const label = document.createElement('label');
            label.htmlFor = `capcut-col-${i}`;
            label.textContent = header.name;
            label.style.flex = '1';

            const select = document.createElement('select');
            select.id = `capcut-pos-${i}`;
            select.style.cssText = 'padding: 5px; background: #222; color: #fff; border: 1px solid #444; border-radius: 4px;';
            positionOptions.forEach(opt => {
                const option = document.createElement('option');
                option.value = opt.value;
                option.textContent = opt.label;
                // По умолчанию: первый столбец (арабский) вверху, остальные внизу
                if (i === 0 && opt.value === '8') option.selected = true;
                else if (i > 0 && opt.value === '2') option.selected = true;
                select.appendChild(option);
            });

            item.appendChild(checkbox);
            item.appendChild(label);
            item.appendChild(select);
            capcutColumnsList.appendChild(item);
        });

        capcutExportModal.classList.remove('hidden');
    };

    const hideCapCutExportModal = () => {
        capcutExportModal.classList.add('hidden');
    };

    const exportCapCutASS = () => {
        // Собираем выбранные колонки и их позиции
        const selectedColumns = [];
        capcutColumnsList.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => {
            const colIndex = parseInt(cb.dataset.colIndex);
            const colName = cb.dataset.colName;
            const posSelect = document.getElementById(`capcut-pos-${colIndex}`);
            const position = posSelect ? posSelect.value : '2';
            selectedColumns.push({ colIndex, colName, position });
        });

        if (selectedColumns.length === 0) {
            alert('Выберите хотя бы один столбец для экспорта.');
            return;
        }

        // Функция форматирования времени в ASS формат (H:MM:SS.cc)
        const formatAssTime = (seconds) => {
            if (seconds === null || isNaN(seconds)) seconds = 0;
            const h = Math.floor(seconds / 3600);
            const m = Math.floor((seconds % 3600) / 60);
            const s = Math.floor(seconds % 60);
            const cs = Math.floor((seconds - Math.floor(seconds)) * 100);
            return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`;
        };

        // Собираем данные из таблицы
        const tableRows = [];
        mainTable.querySelectorAll('tbody tr').forEach((row) => {
            const rowData = { texts: [] };
            row.querySelectorAll('td').forEach((td, colIndex) => {
                const text = td.querySelector('.cell-content')?.innerText?.trim() || '';
                if (colIndex === 0) {
                    rowData.timestamp = window.Subtitles.parseTimestamp(text);
                } else {
                    rowData.texts.push(text);
                }
            });
            tableRows.push(rowData);
        });

        // Экспортируем каждую выбранную колонку в отдельный ASS файл
        selectedColumns.forEach(({ colIndex, colName, position }) => {
            // ASS Header
            let assContent = `[Script Info]
Title: ${colName}
ScriptType: v4.00+
Collisions: Normal
PlayDepth: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,2,1,${position},20,20,20,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

            for (let i = 0; i < tableRows.length; i++) {
                const currentRow = tableRows[i];
                const text = currentRow.texts[colIndex] || '';

                if (!text) continue;

                const startTime = currentRow.timestamp;
                let endTime = null;
                for (let j = i + 1; j < tableRows.length; j++) {
                    if (tableRows[j].timestamp !== null) {
                        endTime = tableRows[j].timestamp;
                        break;
                    }
                }
                if (endTime === null) {
                    endTime = (startTime !== null ? startTime : 0) + 3;
                }

                // Заменяем переносы строк на \N для ASS
                const assText = text.replace(/\n/g, '\\N');
                assContent += `Dialogue: 0,${formatAssTime(startTime)},${formatAssTime(endTime)},Default,,0,0,0,,${assText}\n`;
            }

            const blob = new Blob([assContent], { type: 'text/plain;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const safeHeader = colName.replace(/[/\\?%*:|"<>]/g, '_');
            a.download = `${safeHeader}.ass`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });

        hideCapCutExportModal();
    };

    capcutExportConfirmBtn.addEventListener('click', exportCapCutASS);
    capcutExportCancelBtn.addEventListener('click', hideCapCutExportModal);

    const exportCapCut = () => {
        showCapCutExportModal();
    };

    const parseCSV = (str) => {
        const arr = [];
        let quote = false, row = 0, col = 0;
        for (let i = 0; i < str.length; i++) {
            let cc = str[i], nc = str[i + 1];
            arr[row] = arr[row] || [];
            arr[row][col] = arr[row][col] || '';
            if (cc == '"' && quote && nc == '"') { arr[row][col] += cc; ++i; continue; }
            if (cc == '"') { quote = !quote; continue; }
            if (cc == ',' && !quote) { ++col; continue; }
            if (cc == '\n' && !quote) { ++row; col = 0; continue; }
            arr[row][col] += cc;
        }
        return arr;
    };

    const importTable = (event) => {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const csvData = e.target.result;
                const parsedData = parseCSV(csvData);
                if (!parsedData || parsedData.length < 1) throw new Error("CSV data is empty.");
                const tableData = { headers: parsedData.shift() || [], body: parsedData.filter(row => row.length > 0 && (row.length > 1 || row[0] !== '')) };
                restoreTableFromData(tableData);
                saveTable(); 
                saveState();
            } catch (error) {
                console.error('Error parsing or building from CSV:', error);
                alert('Ошибка: Не удалось импортировать таблицу из CSV файла.');
                undo();
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    };

    const saveTable = () => {
        const tableHead = mainTable.querySelector('thead').innerHTML;
        const tableBody = mainTable.querySelector('tbody').innerHTML;
        localStorage.setItem('tableHead', tableHead);
        localStorage.setItem('tableBody', tableBody);
    };

    const loadTable = () => {
        const tableHead = localStorage.getItem('tableHead');
        const tableBody = localStorage.getItem('tableBody');
        if (tableHead) mainTable.querySelector('thead').innerHTML = tableHead;
        if (tableBody) mainTable.querySelector('tbody').innerHTML = tableBody;
        updateAllEventListeners();
        window.Subtitles.parseTable();
    };

    // --- Initial setup and Event Listeners ---
    loadTable();
    saveState();

    btnAddLanguage.addEventListener('click', addColumn);
    btnAddRowBottom.addEventListener('click', addRow);
    btnClearTable.addEventListener('click', () => showConfirmationModal('Вы уверены, что хотите очистить всю таблицу?', clearTable));
    btnAddManual.addEventListener('click', showManualAddModal);
    btnAddFromQuran.addEventListener('click', showQuranImportModal);
    btnExportTable.addEventListener('click', exportTable);
    btnExportJSON.addEventListener('click', exportJSON);
    btnExportCapCut.addEventListener('click', exportCapCut);
    importTableInput.addEventListener('change', importTable);
    btnUndo.addEventListener('click', undo);
    btnRedo.addEventListener('click', redo);

    btnSplitText.addEventListener('mousedown', (event) => {
        event.preventDefault();
    });
    btnSplitText.addEventListener('click', splitText);


    const enableDragToScroll = (element) => {
        let isDragging = false, startX, scrollLeft, hasDragged = false;
        element.addEventListener('mousedown', (e) => {
            if (e.target.closest('.btn-table-action')) return;
            isDragging = true; hasDragged = false;
            startX = e.pageX - element.offsetLeft;
            scrollLeft = element.scrollLeft;
            element.style.cursor = 'grabbing';
            element.style.userSelect = 'none';
        });
        element.addEventListener('mouseleave', () => { isDragging = false; element.style.cursor = 'grab'; element.style.userSelect = 'auto'; });
        element.addEventListener('mouseup', () => { isDragging = false; element.style.cursor = 'grab'; element.style.userSelect = 'auto'; });
        element.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            hasDragged = true; e.preventDefault();
            const x = e.pageX - element.offsetLeft;
            const walk = (x - startX) * 2;
            element.scrollLeft = scrollLeft - walk;
        });
        element.addEventListener('click', (e) => { if (hasDragged) { e.preventDefault(); e.stopPropagation(); } }, true);
        element.style.cursor = 'grab';
    };

    const bottomBar = document.querySelector('.table-bottom-bar');
    if (bottomBar) enableDragToScroll(bottomBar);

    window.Table = { showConfirmationModal, clearAllTimestamps, addRow, insertTimestampRow, clearTimestampByIndex, mainTable };
});
