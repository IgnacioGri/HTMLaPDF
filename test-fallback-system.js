// Test script to verify fallback system works correctly
import { exec } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

const TEST_HTML = `
<!DOCTYPE html>
<html>
<head><title>Test Report</title></head>
<body>
  <h1>Test Cohen Report</h1>
  <table>
    <tr><th>Column 1</th><th>Column 2</th></tr>
    <tr><td>Data 1</td><td>Data 2</td></tr>
  </table>
</body>
</html>
`;

async function testFallbackSystem() {
  console.log('🧪 Testing PDF generation fallback system...\n');
  
  // Test 1: Force Chrome path to be invalid
  console.log('Test 1: Invalid Chrome path (should trigger fallback)');
  process.env.PUPPETEER_EXECUTABLE_PATH = '/invalid/path/to/chrome';
  
  try {
    const response = await fetch('http://localhost:5000/api/convert', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        htmlContent: TEST_HTML,
        config: {
          pageSize: 'A4',
          orientation: 'portrait',
          margin: { top: '1cm', right: '1cm', bottom: '1cm', left: '1cm' }
        },
        filename: 'test-fallback.html'
      })
    });
    
    const result = await response.json();
    console.log('✓ Test 1 Response:', result);
    
    // Monitor the job
    if (result.jobId) {
      await monitorJob(result.jobId, 'Test 1 (Chrome fallback)');
    }
    
  } catch (error) {
    console.log('✗ Test 1 failed:', error.message);
  }
  
  // Test 2: Reset Chrome path and test normal operation
  console.log('\nTest 2: Normal operation (should use primary system)');
  delete process.env.PUPPETEER_EXECUTABLE_PATH;
  
  try {
    const response = await fetch('http://localhost:5000/api/convert', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        htmlContent: TEST_HTML,
        config: {
          pageSize: 'A4',
          orientation: 'portrait',
          margin: { top: '1cm', right: '1cm', bottom: '1cm', left: '1cm' }
        },
        filename: 'test-normal.html'
      })
    });
    
    const result = await response.json();
    console.log('✓ Test 2 Response:', result);
    
    if (result.jobId) {
      await monitorJob(result.jobId, 'Test 2 (Normal operation)');
    }
    
  } catch (error) {
    console.log('✗ Test 2 failed:', error.message);
  }
  
  // Test 3: Large file test
  console.log('\nTest 3: Large file test (should use optimization)');
  const largeHtml = generateLargeHtml();
  
  try {
    const response = await fetch('http://localhost:5000/api/convert', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        htmlContent: largeHtml,
        config: {
          pageSize: 'A4',
          orientation: 'landscape',
          margin: { top: '5mm', right: '5mm', bottom: '5mm', left: '5mm' }
        },
        filename: 'test-large.html'
      })
    });
    
    const result = await response.json();
    console.log('✓ Test 3 Response:', result);
    
    if (result.jobId) {
      await monitorJob(result.jobId, 'Test 3 (Large file)');
    }
    
  } catch (error) {
    console.log('✗ Test 3 failed:', error.message);
  }
}

async function monitorJob(jobId, testName) {
  console.log(`Monitoring job ${jobId} for ${testName}...`);
  
  for (let i = 0; i < 30; i++) { // Wait up to 30 seconds
    try {
      const response = await fetch(`http://localhost:5000/api/job/${jobId}`);
      const job = await response.json();
      
      console.log(`  Status: ${job.status}`);
      
      if (job.status === 'completed') {
        console.log(`✅ ${testName} completed successfully!`);
        console.log(`  PDF Path: ${job.pdfPath}`);
        break;
      } else if (job.status === 'failed') {
        console.log(`❌ ${testName} failed: ${job.error}`);
        break;
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.log(`Error monitoring job: ${error.message}`);
      break;
    }
  }
}

function generateLargeHtml() {
  let html = '<html><head><title>Large Test</title></head><body>';
  
  for (let i = 0; i < 50; i++) {
    html += `
      <h2>Section ${i + 1}</h2>
      <table>
        <thead>
          <tr>
            <th>Column 1</th><th>Column 2</th><th>Column 3</th><th>Column 4</th><th>Column 5</th>
          </tr>
        </thead>
        <tbody>
    `;
    
    for (let j = 0; j < 20; j++) {
      html += `
        <tr>
          <td>Data ${i}-${j}-1</td>
          <td>Data ${i}-${j}-2</td>
          <td>Data ${i}-${j}-3</td>
          <td>Data ${i}-${j}-4</td>
          <td>Data ${i}-${j}-5</td>
        </tr>
      `;
    }
    
    html += '</tbody></table>';
  }
  
  html += '</body></html>';
  return html;
}

// Run tests
if (process.argv[2] === 'run') {
  testFallbackSystem().catch(console.error);
} else {
  console.log('To run tests: node test-fallback-system.js run');
}