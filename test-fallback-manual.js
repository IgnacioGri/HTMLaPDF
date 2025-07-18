// Manual test to verify fallback system - simulates different failure scenarios
import { generatePdf } from './server/services/pdf-generator.js';
import { storage } from './server/storage.js';

const testConfig = {
  pageSize: 'A4',
  orientation: 'portrait',
  margin: { top: '1cm', right: '1cm', bottom: '1cm', left: '1cm' }
};

const testHtml = `
<!DOCTYPE html>
<html>
<head><title>Fallback Test</title></head>
<body>
  <h1>Testing Fallback System</h1>
  <table>
    <tr><th>Test</th><th>Status</th></tr>
    <tr><td>Primary System</td><td>Testing...</td></tr>
    <tr><td>Fallback System</td><td>Testing...</td></tr>
  </table>
</body>
</html>
`;

async function testFallbackMechanisms() {
  console.log('🔧 Testing fallback mechanisms...\n');
  
  // Test 1: Normal operation
  console.log('Test 1: Normal operation');
  try {
    const result = await generatePdf(testHtml, testConfig, 'test-normal.html', 1);
    console.log('✅ Normal operation successful:', result);
  } catch (error) {
    console.log('❌ Normal operation failed:', error.message);
  }
  
  // Test 2: Force Chrome failure by setting invalid path
  console.log('\nTest 2: Force Chrome failure (invalid executable path)');
  const originalPath = process.env.PUPPETEER_EXECUTABLE_PATH;
  process.env.PUPPETEER_EXECUTABLE_PATH = '/invalid/chrome/path';
  
  try {
    const result = await generatePdf(testHtml, testConfig, 'test-chrome-fail.html', 2);
    console.log('✅ Chrome failure handled successfully:', result);
  } catch (error) {
    console.log('❌ Chrome failure not handled:', error.message);
  }
  
  // Restore original path
  if (originalPath) {
    process.env.PUPPETEER_EXECUTABLE_PATH = originalPath;
  } else {
    delete process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  
  // Test 3: Large file optimization
  console.log('\nTest 3: Large file optimization');
  const largeHtml = generateLargeTestHtml();
  try {
    const result = await generatePdf(largeHtml, testConfig, 'test-large.html', 3);
    console.log('✅ Large file handled successfully:', result);
  } catch (error) {
    console.log('❌ Large file failed:', error.message);
  }
  
  console.log('\n🎯 Fallback test completed!');
}

function generateLargeTestHtml() {
  let html = '<!DOCTYPE html><html><head><title>Large Test</title></head><body>';
  
  // Generate over 500KB of content
  for (let i = 0; i < 100; i++) {
    html += `
      <div class="section-${i}">
        <h2>Section ${i + 1}</h2>
        <p>This is a large section with lots of content to test optimization.</p>
        <table class="data-table">
          <thead>
            <tr>
              <th>ID</th><th>Name</th><th>Value</th><th>Status</th><th>Date</th>
            </tr>
          </thead>
          <tbody>
    `;
    
    for (let j = 0; j < 10; j++) {
      html += `
        <tr>
          <td>${i * 10 + j}</td>
          <td>Item ${i}-${j}</td>
          <td>Value ${Math.random().toFixed(2)}</td>
          <td>Active</td>
          <td>2025-01-18</td>
        </tr>
      `;
    }
    
    html += `
          </tbody>
        </table>
      </div>
    `;
  }
  
  html += '</body></html>';
  return html;
}

// Run the test
testFallbackMechanisms().catch(console.error);