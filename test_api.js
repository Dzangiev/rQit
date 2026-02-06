const API_BASE_URL = 'https://api.quran.com/api/v4';

async function testFetch() {
    // Surah 1, Reciter 7 (Mishari Rashid), Page 1
    const url = `${API_BASE_URL}/verses/by_chapter/1?language=en&words=false&fields=text_uthmani&page=1&per_page=1&audio=7`;
    console.log("Fetching:", url);
    try {
        const res = await fetch(url);
        const data = await res.json();
        console.log("Data:", JSON.stringify(data, null, 2));
    } catch (e) {
        console.error(e);
    }
}

testFetch();
