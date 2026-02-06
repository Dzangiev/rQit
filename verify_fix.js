// Simulate the logic in table.js
const badChar = '\u06DF'; // Small High Rounded Zero
const goodChar = '\u0652'; // Sukun

const apiString = 'كَفَرُوا' + badChar; // Simulated API output
console.log(`Original String Hex:`);
for(let i=0; i<apiString.length; i++) console.log(apiString.charCodeAt(i).toString(16));

// Apply fix
const fixedString = apiString.replace(/\u06DF/g, '\u0652');
console.log(`Fixed String Hex:`);
for(let i=0; i<fixedString.length; i++) console.log(fixedString.charCodeAt(i).toString(16));

if (fixedString.includes(goodChar) && !fixedString.includes(badChar)) {
    console.log('SUCCESS: Character replaced correctly.');
} else {
    console.error('FAILURE: Character NOT replaced.');
    process.exit(1);
}
