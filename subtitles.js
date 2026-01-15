// subtitles.js
window.Subtitles = (() => {
    let subtitles = [];
    let headers = [];

    const parseTimestamp = (ts) => {
        if (!ts || typeof ts !== 'string' || ts.trim() === '') return null;
        const parts = ts.split(/[:.]/);
        if (parts.length !== 4) return null;
        const h = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const s = parseInt(parts[2], 10);
        const cs = parseInt(parts[3], 10);
        if (isNaN(h) || isNaN(m) || isNaN(s) || isNaN(cs)) return null;
        return h * 3600 + m * 60 + s + cs / 100;
    };

    const parseTable = () => {
        const table = document.getElementById('main-table');
        if (!table) {
            subtitles = [];
            headers = [];
            return;
        }

        // Parse Headers
        const headerCells = table.querySelectorAll('thead th');
        const newHeaders = [];
        headerCells.forEach(th => {
            const headerText = th.querySelector('.header-text');
            if (headerText) {
                newHeaders.push(headerText.innerText.trim());
            } else {
                 newHeaders.push(th.querySelector('.header-content').innerText.trim());
            }
        });
        headers = newHeaders;

        // Parse Body
        const rows = table.querySelectorAll('tbody tr');
        const newSubtitles = [];
        rows.forEach(row => {
            const timeCell = row.cells[0]?.querySelector('.cell-content');
            const time = timeCell ? parseTimestamp(timeCell.innerText) : null;
            
            const texts = [];
            for (let i = 1; i < row.cells.length; i++) {
                const textCell = row.cells[i]?.querySelector('.cell-content');
                texts.push(textCell ? textCell.innerText.trim() : '');
            }

            newSubtitles.push({ time, texts });
        });
        
        subtitles = newSubtitles;
        
        document.dispatchEvent(new CustomEvent('subtitlesUpdated'));
    };

    const getSubtitles = () => {
        return subtitles;
    };

    const getHeaders = () => {
        return headers;
    };

    return {
        parseTable,
        getSubtitles,
        getHeaders,
        parseTimestamp 
    };
})();