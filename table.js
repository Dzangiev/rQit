document.addEventListener('DOMContentLoaded', () => {
    // --- Table Page DOM Elements ---
    const mainTable = document.getElementById('main-table');
    const btnAddLanguage = document.getElementById('btn-add-language');
    const btnAddRowBottom = document.getElementById('btn-add-row-bottom');
    const btnClearTable = document.getElementById('btn-clear-table');
    const btnAddManual = document.getElementById('btn-add-manual');
    const btnAddFromQuran = document.getElementById('btn-add-from-quran');

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
    const manualInputDS = document.getElementById('manual-ds');
    const manualAddSaveBtn = document.getElementById('manual-add-save-btn');
    const manualAddCancelBtn = document.getElementById('manual-add-cancel-btn');

    // --- Quran Import Modal DOM Elements ---
    const quranImportModal = document.getElementById('quran-import-modal');
    const quranSurahInput = document.getElementById('quran-surah');
    const quranAyahStartInput = document.getElementById('quran-ayah-start');
    const quranAyahEndInput = document.getElementById('quran-ayah-end');
    const quranImportConfirmBtn = document.getElementById('quran-import-confirm-btn');
    const quranImportCancelBtn = document.getElementById('quran-import-cancel-btn');

    let onConfirmCallback = null;

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
        // Clear old values
        manualInputH.value = '';
        manualInputM.value = '';
        manualInputS.value = '';
        manualInputDS.value = '';
        manualAddModal.classList.remove('hidden');
    };

    const hideManualAddModal = () => {
        manualAddModal.classList.add('hidden');
    };

    const showQuranImportModal = () => {
        quranSurahInput.value = '';
        quranAyahStartInput.value = '';
        quranAyahEndInput.value = '';
        quranImportModal.classList.remove('hidden');
    };

    const hideQuranImportModal = () => {
        quranImportModal.classList.add('hidden');
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

    manualAddSaveBtn.addEventListener('click', () => {
        const h = parseInt(manualInputH.value || 0, 10);
        const m = parseInt(manualInputM.value || 0, 10);
        const s = parseInt(manualInputS.value || 0, 10);
        const ds = parseInt(manualInputDS.value || 0, 10);

        if (h > 99 || m > 59 || s > 59 || ds > 9 || h < 0 || m < 0 || s < 0 || ds < 0) {
            alert('Неверный формат времени.');
            return;
        }

        const timeInSeconds = h * 3600 + m * 60 + s + ds / 10;
        insertTimestampRow(timeInSeconds);
        hideManualAddModal();
        saveTable();
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

    // --- Table Manipulation Logic ---
    const importFromQuran = async (surah, ayahStart, ayahEnd) => {
        const languages = [
            { name: 'quran', file: 'quran.json' },
            { name: 'en', file: 'en.json' },
            { name: 'ru', file: 'ru.json' },
            { name: 'bn', file: 'bn.json' },
            { name: 'es', file: 'es.json' },
            { name: 'id', file: 'id.json' }
        ];

        try {
            const responses = await Promise.all(
                languages.map(lang => fetch(`quran/${lang.file}`))
            );

            const datasets = await Promise.all(
                responses.map(res => res.json())
            );

            const quranData = {};
            languages.forEach((lang, index) => {
                quranData[lang.name] = datasets[index];
            });

            // Clear table columns except the first one
            const header = mainTable.querySelector('thead tr');
            while (header.children.length > 1) {
                header.removeChild(header.lastChild);
            }
            const rows = mainTable.querySelectorAll('tbody tr');
            rows.forEach(row => {
                 while (row.children.length > 1) {
                    row.removeChild(row.lastChild);
                }
            });

            // Add new language columns
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
                    // Clear existing cells in the row
                    while(row.cells.length > 1) {
                        row.deleteCell(1);
                    }
                } else {
                    row = tBody.insertRow();
                    const firstCell = row.insertCell();
                    firstCell.innerHTML = `<div class="cell-content-wrapper"><button class="btn btn--small btn-delete-row"><span class="icon icon-x"></span></button><div class="cell-content"></div></div>`;
                }
                
                languages.forEach(lang => {
                    const cell = row.insertCell();
                    const surahData = quranData[lang.name][surah];
                    const verseData = surahData ? surahData.find(v => v.verse === ayah) : null;
                    cell.innerHTML = `<div class="cell-content-wrapper"><div class="cell-content" contenteditable="true">${verseData ? verseData.text : ''}</div></div>`;
                });
            }
            
            // Remove extra rows if any
            while (tBody.rows.length > numRowsToAdd) {
                tBody.deleteRow(numRowsToAdd);
            }


            updateDeleteColumnButtons();
            updateDeleteRowButtons();
            addCellInputListeners();
            window.Subtitles.parseTable();
            saveTable();
            hideQuranImportModal();

        } catch (error) {
            console.error('Error loading Quran data:', error);
            alert('Не удалось загрузить данные Корана.');
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
        updateDeleteColumnButtons();
        window.Subtitles.parseTable();
        addCellInputListeners();
        saveTable();
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
        updateDeleteRowButtons();
        window.Subtitles.parseTable();
        addCellInputListeners();
        saveTable();
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
        updateDeleteColumnButtons();
        window.Subtitles.parseTable();
        saveTable();
    };

    const deleteRow = (e) => {
        const btn = e.target.closest('.btn-delete-row');
        if (!btn) return;

        if (mainTable.querySelector('tbody').rows.length <= 1) return;

        const row = btn.closest('tr');
        row.parentNode.removeChild(row);
        updateDeleteRowButtons();
        window.Subtitles.parseTable();
        saveTable();
    };
    
    const clearTable = () => {
        const tBody = mainTable.querySelector('tbody');
        while (tBody.firstChild) {
            tBody.removeChild(tBody.firstChild);
        }
        const header = mainTable.querySelector('thead tr');
        while (header.children.length > 2) {
            header.removeChild(header.lastChild);
        }
        const rows = mainTable.querySelectorAll('tbody tr');
        rows.forEach(row => {
             while (row.children.length > 2) {
                row.removeChild(row.lastChild);
            }
        });
        addRow();
        window.Subtitles.parseTable();
        saveTable();
    };

    const clearAllTimestamps = () => {
        const timeCells = mainTable.querySelectorAll('tbody tr td:first-child .cell-content');
        timeCells.forEach(cell => {
            cell.innerText = '';
        });
        sortAndCompactTable();
        saveTable();
    };

    const sortAndCompactTable = () => {
        const tBody = mainTable.querySelector('tbody');
        if (!tBody) return;

        // 1. Get all timestamp cells
        const timeCells = Array.from(tBody.querySelectorAll('tr td:first-child .cell-content'));
        
        // 2. Read all timestamp values
        const timeValues = timeCells
            .map(cell => window.Subtitles.parseTimestamp(cell.innerText))
            .filter(time => time !== null); // Filter out null/invalid times

        // 3. Sort the valid time values
        timeValues.sort((a, b) => a - b);

        // 4. Write the sorted values back into the cells
        timeCells.forEach((cell, index) => {
            if (index < timeValues.length) {
                cell.innerText = formatTime(timeValues[index]);
            } else {
                cell.innerText = '';
            }
        });
        
        // 5. Re-parse subtitles to update waveform markers
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
        const cells = mainTable.querySelectorAll('.cell-content');
        cells.forEach(cell => {
            cell.removeEventListener('input', () => {
                window.Subtitles.parseTable();
                saveTable();
            });
            cell.addEventListener('input', () => {
                window.Subtitles.parseTable();
                saveTable();
            });
        });
    };

    const formatTime = (seconds) => {
        if (isNaN(seconds)) return '00:00:00.0';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        const ds = Math.floor((seconds - Math.floor(seconds)) * 10);
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ds}`;
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
        saveTable();
    };

    const clearTimestampByIndex = (index) => {
        const tBody = mainTable.querySelector('tbody');
        if (tBody && tBody.rows.length > index) {
            const cell = tBody.rows[index].cells[0]?.querySelector('.cell-content');
            if (cell) cell.innerText = '';
            sortAndCompactTable();
            saveTable();
        }
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
        if (tableHead) {
            mainTable.querySelector('thead').innerHTML = tableHead;
        }
        if (tableBody) {
            mainTable.querySelector('tbody').innerHTML = tableBody;
        }
        
        // Re-initialize the table after loading
        updateDeleteColumnButtons();
        updateDeleteRowButtons();
        addCellInputListeners();
        window.Subtitles.parseTable();
    };

    // --- Initial setup and Event Listeners ---
    updateDeleteColumnButtons();
    updateDeleteRowButtons();
    addCellInputListeners();
    window.Subtitles.parseTable();

    btnAddLanguage.addEventListener('click', addColumn);
    btnAddRowBottom.addEventListener('click', addRow);
    btnClearTable.addEventListener('click', () => showConfirmationModal('Вы уверены, что хотите очистить всю таблицу?', clearTable));
    btnAddManual.addEventListener('click', showManualAddModal);
    btnAddFromQuran.addEventListener('click', showQuranImportModal);

    loadTable();

    // --- Expose functions globally ---
    window.Table = {
        showConfirmationModal,
        clearAllTimestamps,
        addRow,
        insertTimestampRow,
        clearTimestampByIndex,
        mainTable
    };
});