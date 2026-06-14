// Standalone PDF Parser Test
// mimics backend/index.ts polyfills
if (typeof (global as any).DOMMatrix === 'undefined') {
  (global as any).DOMMatrix = class DOMMatrix {
    constructor() { }
    static fromFloat32Array() { return new DOMMatrix(); }
  };
}
if (typeof (global as any).Path2D === 'undefined') { (global as any).Path2D = class Path2D { }; }
if (typeof (global as any).ImageData === 'undefined') { (global as any).ImageData = class ImageData { }; }

const pdf = require('pdf-parse');
const fs = require('fs');

async function testPdf() {
  console.log('🧪 Starting Standalone PDF Parse Test...');
  
  // Create a dummy PDF buffer if no real file is passed, or try to find one in workspace
  // For this test, we can try to look for any .pdf in the root
  try {
    const testFile = './sample.pdf'; // Adjust if you have a real one
    if (fs.existsSync(testFile)) {
        const buffer = fs.readFileSync(testFile);
        console.log(`📂 Found ${testFile}, parsing...`);
        const data = await pdf(buffer);
        console.log('✅ PDF Parsed Successfully!');
        console.log('Text Snippet:', data.text.substring(0, 100));
    } else {
        console.warn('⚠️ No sample.pdf found. Tests will skip actual parsing.');
    }
    
    // Testing the function call itself for known issues
    console.log('🔍 Checking if "pdf" function is valid:', typeof pdf === 'function');
  } catch (err: any) {
    console.error('❌ PDF Test Failed:', err.message);
    if (err.stack) console.error(err.stack);
  }
}

testPdf();
