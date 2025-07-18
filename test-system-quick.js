// Quick test to verify current system status
import fetch from 'node-fetch';

async function quickTest() {
  console.log('🔍 Quick system health check...\n');
  
  // Check if server is running
  try {
    const response = await fetch('http://localhost:5000/api/recent');
    const data = await response.json();
    console.log('✅ Server is running');
    console.log('Recent jobs:', data.length);
  } catch (error) {
    console.log('❌ Server not accessible:', error.message);
    return;
  }
  
  // Submit a simple test
  const testHtml = `
    <html>
      <head><title>Quick Test</title></head>
      <body>
        <h1>System Health Check</h1>
        <p>This is a quick test to verify the system is working.</p>
        <table>
          <tr><th>Test</th><th>Status</th></tr>
          <tr><td>HTML Processing</td><td>✅ Working</td></tr>
          <tr><td>PDF Generation</td><td>🔄 Testing...</td></tr>
        </table>
      </body>
    </html>
  `;
  
  try {
    console.log('\n🧪 Submitting test conversion...');
    const response = await fetch('http://localhost:5000/api/convert', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        htmlContent: testHtml,
        config: {
          pageSize: 'A4',
          orientation: 'portrait',
          margin: { top: '1cm', right: '1cm', bottom: '1cm', left: '1cm' }
        },
        filename: 'health-check.html'
      })
    });
    
    const result = await response.json();
    console.log('Job created:', result.jobId);
    
    // Monitor for 10 seconds
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const jobResponse = await fetch(`http://localhost:5000/api/job/${result.jobId}`);
      const job = await jobResponse.json();
      
      console.log(`Status: ${job.status}`);
      
      if (job.status === 'completed') {
        console.log('✅ PDF generation successful!');
        console.log('Generated file:', job.pdfPath);
        break;
      } else if (job.status === 'failed') {
        console.log('❌ PDF generation failed:', job.error);
        break;
      }
    }
    
  } catch (error) {
    console.log('❌ Test failed:', error.message);
  }
}

quickTest().catch(console.error);