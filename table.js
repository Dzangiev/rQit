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
    const quranLangCollapsibleTrigger = document.getElementById('quran-lang-collapsible-trigger');
    const quranLangListContainer = document.getElementById('quran-lang-list-container');

    let onConfirmCallback = null;

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

    const populateLanguageList = () => {
        quranLangListContainer.innerHTML = ''; // Clear previous
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
            const allChecked = Array.from(langCheckboxes).every(cb => cb.checked);
            selectAllCheckbox.checked = allChecked;
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
        const selectedLangCheckboxes = quranLangListContainer.querySelectorAll('.quran-lang-checkbox:checked');
        const selectedLangNames = Array.from(selectedLangCheckboxes).map(cb => cb.value);

        localStorage.setItem(QURAN_LANG_STORAGE_KEY, JSON.stringify(selectedLangNames));

        const languages = ALL_QURAN_LANGUAGES.filter(lang => selectedLangNames.includes(lang.name));

        if (languages.length === 0) {
            alert('Пожалуйста, выберите хотя бы один язык для импорта.');
            return;
        }

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


            updateAllEventListeners();
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
        updateAllEventListeners();
        window.Subtitles.parseTable();
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
        updateAllEventListeners();
        window.Subtitles.parseTable();
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
        updateAllEventListeners();
        window.Subtitles.parseTable();
        saveTable();
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
    const onCellInput = () => {
        window.Subtitles.parseTable();
        saveTable();
    };

    const addCellInputListeners = () => {
        const cells = mainTable.querySelectorAll('.cell-content[contenteditable="true"]');
        cells.forEach(cell => {
            cell.removeEventListener('input', onCellInput);
            cell.addEventListener('input', onCellInput);
        });
    };
    
    const updateAllEventListeners = () => {
        updateDeleteColumnButtons();
        updateDeleteRowButtons();
        addCellInputListeners();
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

    const exportTable = () => {
        const table = mainTable;
        let csv = [];
        
        // Head
        const headers = [];
        table.querySelectorAll('thead th').forEach(th => {
            const text = th.querySelector('.header-text')?.innerText || th.innerText;
            headers.push(`"${(text || '').replace(/"/g, '""').trim()}"`);
        });
        csv.push(headers.join(','));

        // Body
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
        let quote = false;
        let row = 0;
        let col = 0;
        let c = '';
        for (let i = 0; i < str.length; i++) {
            let cc = str[i];
            let nc = str[i + 1];
            arr[row] = arr[row] || [];
            arr[row][col] = arr[row][col] || '';

            if (cc == '"' && quote && nc == '"') {
                arr[row][col] += cc;
                ++i;
                continue;
            }
            if (cc == '"') {
                quote = !quote;
                continue;
            }
            if (cc == ',' && !quote) {
                ++col;
                continue;
            }
            if (cc == '\n' && !quote) {
                ++row;
                col = 0;
                continue;
            }

            arr[row][col] += cc;
        }
        return arr;
    };

    const importTable = (event) => {
        const file = event.target.files[0];
        if (!file) {
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const csvData = e.target.result;
                const parsedData = parseCSV(csvData);

                if (!parsedData || parsedData.length < 1) {
                    throw new Error("CSV data is empty or invalid.");
                }
                
                const newHead = mainTable.querySelector('thead');
                const newBody = mainTable.querySelector('tbody');
                
                newHead.innerHTML = '';
                newBody.innerHTML = '';

                const headerRow = document.createElement('tr');
                const headers = parsedData.shift(); 
                headers.forEach((headerText, index) => {
                    const th = document.createElement('th');
                    if (index === 0) { // First header is special
                         th.innerHTML = `<div class="header-content">${headerText}<button class="btn btn--small btn-delete-col" style="visibility: hidden;"><span class="icon icon-x"></span></button></div>`;
                    } else {
                        th.innerHTML = `<div class="header-content"><div class="header-text" contenteditable="true">${headerText}</div><button class="btn btn--small btn-delete-col"><span class="icon icon-x"></span></button></div>`;
                    }
                    headerRow.appendChild(th);
                });
                newHead.appendChild(headerRow);

                parsedData.forEach(rowData => {
                    if (rowData.length === 0 || (rowData.length === 1 && rowData[0] === '')) return; // Skip empty rows
                    const tr = document.createElement('tr');
                    const firstCellText = rowData.shift() || '';
                    const tdFirst = document.createElement('td');
                    tdFirst.innerHTML = `<div class="cell-content-wrapper"><button class="btn btn--small btn-delete-row"><span class="icon icon-x"></span></button><div class="cell-content">${firstCellText}</div></div>`;
                    tr.appendChild(tdFirst);

                    rowData.forEach(cellText => {
                        const td = document.createElement('td');
                        td.innerHTML = `<div class="cell-content-wrapper"><div class="cell-content" contenteditable="true">${cellText}</div></div>`;
                        tr.appendChild(td);
                    });
                    newBody.appendChild(tr);
                });

                saveTable();
                loadTable();
                
            } catch (error) {
                console.error('Error parsing or building from CSV:', error);
                alert('Ошибка: Не удалось импортировать таблицу из CSV файла.');
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
    btnExportTable.addEventListener('click', exportTable);
    importTableInput.addEventListener('change', importTable);

    loadTable();

    const enableDragToScroll = (element) => {
        let isDragging = false;
        let startX;
        let scrollLeft;
        let hasDragged = false;

        element.addEventListener('mousedown', (e) => {
            if (e.target.closest('.btn-table-action')) {
                return;
            }
            isDragging = true;
            hasDragged = false;
            startX = e.pageX - element.offsetLeft;
            scrollLeft = element.scrollLeft;
            element.style.cursor = 'grabbing';
            element.style.userSelect = 'none';
        });

        element.addEventListener('mouseleave', () => {
            if (isDragging) {
                isDragging = false;
                element.style.cursor = 'grab';
                element.style.userSelect = 'auto';
            }
        });

        element.addEventListener('mouseup', () => {
            isDragging = false;
            element.style.cursor = 'grab';
            element.style.userSelect = 'auto';
        });

        element.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            hasDragged = true;
            e.preventDefault();
            const x = e.pageX - element.offsetLeft;
            const walk = (x - startX) * 2; // scroll-fast
            element.scrollLeft = scrollLeft - walk;
        });

        element.addEventListener('click', (e) => {
            if (hasDragged) {
                e.preventDefault();
                e.stopPropagation();
            }
        }, true); // Use capture phase to prevent clicks after dragging

        element.style.cursor = 'grab';
    };

    const bottomBar = document.querySelector('.table-bottom-bar');
    if (bottomBar) {
        enableDragToScroll(bottomBar);
    }

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