document.addEventListener('DOMContentLoaded', () => {
    // --- Table Page DOM Elements ---
    const mainTable = document.getElementById('main-table');
    const btnAddLanguage = document.getElementById('btn-add-language');
    const btnAddRowBottom = document.getElementById('btn-add-row-bottom');
    const btnClearTable = document.getElementById('btn-clear-table');
    const btnAddManual = document.getElementById('btn-add-manual');
    const btnAddFromQuran = document.getElementById('btn-add-from-quran');
    const btnExportTable = document.getElementById('btn-export-table');
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
    const quranSurahInput = document.getElementById('quran-surah');
    const quranAyahStartInput = document.getElementById('quran-ayah-start');
    const quranAyahEndInput = document.getElementById('quran-ayah-end');
    const quranImportConfirmBtn = document.getElementById('quran-import-confirm-btn');
    const quranImportCancelBtn = document.getElementById('quran-import-cancel-btn');
    const quranLangCollapsibleTrigger = document.getElementById('quran-lang-collapsible-trigger');
    const quranLangListContainer = document.getElementById('quran-lang-list-container');

    let onConfirmCallback = null;
    let activeCellForSplit = null;

    // --- Undo/Redo State ---
    let history = [];
    let historyIndex = -1;

    const ALL_QURAN_LANGUAGES = [
        { name: 'quran', file: 'quran.json' },
        { name: 'en', file: 'en.json' },
        { name: 'ru', file: 'ru.json' },
        { name: 'bn', file: 'bn.json' },
        { name: 'es', file: 'es.json' },
        { name: 'id', file: 'id.json' }
    ];
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

    const populateLanguageList = () => {
        quranLangListContainer.innerHTML = '';
        const savedLangs = JSON.parse(localStorage.getItem(QURAN_LANG_STORAGE_KEY)) || ALL_QURAN_LANGUAGES.map(l => l.name);

        const allLabel = document.createElement('label');
        allLabel.innerHTML = `<strong><input type="checkbox" id="quran-lang-select-all"> Выбрать все</strong>`;
        quranLangListContainer.appendChild(allLabel);

        ALL_QURAN_LANGUAGES.forEach(lang => {
            const label = document.createElement('label');
            const isChecked = savedLangs.includes(lang.name);
            label.innerHTML = `<input type="checkbox" class="quran-lang-checkbox" value="${lang.name}" ${isChecked ? 'checked' : ''}> ${lang.name}`;
            quranLangListContainer.appendChild(label);
        });

        const selectAllCheckbox = document.getElementById('quran-lang-select-all');
        const langCheckboxes = quranLangListContainer.querySelectorAll('.quran-lang-checkbox');

        const updateSelectAllState = () => {
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


    const showQuranImportModal = () => {
        quranSurahInput.value = '';
        quranAyahStartInput.value = '';
        quranAyahEndInput.value = '';
        populateLanguageList();
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

    quranImportConfirmBtn.addEventListener('click', () => {
        const surah = parseInt(quranSurahInput.value, 10);
        const ayahStart = parseInt(quranAyahStartInput.value, 10);
        const ayahEnd = parseInt(quranAyahEndInput.value, 10);

        if (isNaN(surah) || isNaN(ayahStart) || isNaN(ayahEnd) || surah < 1 || surah > 114 || ayahStart < 1 || ayahEnd < ayahStart) {
            alert('Пожалуйста, введите корректные значения для суры и аятов.');
            return;
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

    const importFromQuran = async (surah, ayahStart, ayahEnd) => {
        try {
            const selectedLangCheckboxes = quranLangListContainer.querySelectorAll('.quran-lang-checkbox:checked');
            const selectedLangNames = Array.from(selectedLangCheckboxes).map(cb => cb.value);
            localStorage.setItem(QURAN_LANG_STORAGE_KEY, JSON.stringify(selectedLangNames));
            const languages = ALL_QURAN_LANGUAGES.filter(lang => selectedLangNames.includes(lang.name));
            if (languages.length === 0) {
                alert('Пожалуйста, выберите хотя бы один язык для импорта.');
                return;
            }

            const responses = await Promise.all(languages.map(lang => fetch(`quran/${lang.file}`)));
            const datasets = await Promise.all(responses.map(res => res.json()));
            const quranData = {};
            languages.forEach((lang, index) => { quranData[lang.name] = datasets[index]; });

            const header = mainTable.querySelector('thead tr');
            while (header.children.length > 1) header.removeChild(header.lastChild);
            const rows = mainTable.querySelectorAll('tbody tr');
            rows.forEach(row => { while (row.children.length > 1) row.removeChild(row.lastChild); });

            languages.forEach(lang => {
                const newHeaderCell = document.createElement('th');
                newHeaderCell.innerHTML = `<div class="header-content"><div class="header-text" contenteditable="true">${lang.name}</div><button class="btn btn--small btn-delete-col"><span class="icon icon-x"></span></button></div>`;
                header.appendChild(newHeaderCell);
            });

            const tBody = mainTable.querySelector('tbody');
            const numRowsToAdd = ayahEnd - ayahStart + 1;
            const existingRows = tBody.rows.length;
            for (let i = 0; i < numRowsToAdd; i++) {
                const ayah = ayahStart + i;
                let row;
                if (i < existingRows) {
                    row = tBody.rows[i];
                    while (row.cells.length > 1) row.deleteCell(1);
                } else {
                    row = tBody.insertRow();
                    const firstCell = row.insertCell();
                    firstCell.innerHTML = `<div class="cell-content-wrapper"><button class="btn btn--small btn-delete-row"><span class="icon icon-x"></span></button><div class="cell-content"></div></div>`;
                }
                languages.forEach(lang => {
                    const cell = row.insertCell();
                    const surahData = quranData[lang.name][surah];
                    const verseData = surahData ? surahData.find(v => v.verse === ayah) : null;
                    let cellText = verseData ? verseData.text : '';
                    if (lang.name === 'quran' && verseData) {
                        cellText += ` ${toEasternArabicNumerals(ayah)}`;
                    }
                    cell.innerHTML = `<div class="cell-content-wrapper"><div class="cell-content" contenteditable="true">${cellText}</div></div>`;
                });
            }
            
            while (tBody.rows.length > numRowsToAdd) tBody.deleteRow(numRowsToAdd);

            updateAllEventListeners();
            window.Subtitles.parseTable();
            saveTable();
            saveState();
            hideQuranImportModal();
        } catch (error) {
            console.error('Error loading Quran data:', error);
            alert('Не удалось загрузить данные Корана.');
            undo();
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
        saveState();
        sortAndCompactTable();
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
                if (event.target.innerText !== initialValue) {
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
