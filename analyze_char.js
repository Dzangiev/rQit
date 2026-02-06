const fs = require('fs');

const content = fs.readFileSync('c:/My Projec/quran-text-to-video/rQit/quran/quran.json', 'utf8');
const quran = JSON.parse(content);

// Function to print unicode
function printUnicode(str, label) {
    console.log(`Analyzing: ${label}`);
    console.log(`Text: ${str}`);
    for (let i = 0; i < str.length; i++) {
        const charCode = str.charCodeAt(i);
        console.log(`${str[i]} : \\u${charCode.toString(16).padStart(4, '0')}`);
    }
    console.log('---');
}

// 1. Inspect Surah 2 Verse 6 (Index 5 in array if 0-indexed? No vs number is 6)
// data structure: { "1": [...], "2": [...] }
const surah2 = quran["2"];
if (surah2) {
    const verse6 = surah2.find(v => v.verse === 6);
    if (verse6) {
        // Look for "kafaru" -> كَفَرُواْ
        // We want to see how the Alif at the end is represented.
        printUnicode(verse6.text, "Surah 2 Verse 6");
    }
}

// 2. Search for the exact sequence user complained about: Alif (0627) + Rounded Zero (06DF)
console.log("Searching for \\u0627\\u06Df in the whole file...");
let found = false;
for (const chapterKey in quran) {
    const verses = quran[chapterKey];
    for (const verse of verses) {
        if (verse.text.includes('\u0627\u06DF')) {
            console.log(`Found sequence in ${verse.chapter}:${verse.verse}`);
            printUnicode(verse.text, "Match Found");
            found = true;
            break;
        }
    }
    if (found) break;
}

if (!found) console.log("Sequence \\u0627\\u06Df NOT found in quran.json");
