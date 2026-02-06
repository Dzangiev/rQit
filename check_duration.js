const API_BASE_URL = 'https://api.quran.com/api/v4';

async function checkDuration() {
    console.log("Checking API for duration field...");
    
    // 1. Check Recitations Default
    try {
        const url = `${API_BASE_URL}/recitations/7/by_chapter/1`;
        console.log(`Fetching: ${url}`);
        const res = await fetch(url);
        const data = await res.json();
        if (data.audio_files && data.audio_files.length > 0) {
            console.log("Default Response (First Verse):", JSON.stringify(data.audio_files[0]));
        } else {
            console.log("No audio files found.");
        }
    } catch (e) { console.error(e); }

    // 2. Check Recitations with segments=true
    try {
        const url = `${API_BASE_URL}/recitations/7/by_chapter/1?segments=true`;
        console.log(`Fetching: ${url}`);
        const res = await fetch(url);
        const data = await res.json();
        if (data.audio_files && data.audio_files.length > 0) {
            console.log("Segments Response (First Verse):", JSON.stringify(data.audio_files[0]));
        } else {
            console.log("No audio files found.");
        }
    } catch (e) { console.error(e); }
}

checkDuration();
