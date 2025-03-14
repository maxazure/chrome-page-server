const axios = require('axios');

async function testAllEndpoints() {
  const baseUrl = 'http://localhost:3000/api';
  
  try {
    console.log('=== Chrome Page Server Comprehensive Test ===');
    
    // Test 1: Check status
    console.log('\n1. Testing /status endpoint...');
    const statusRes = await axios.get(`${baseUrl}/status`);
    console.log('Status response:', statusRes.data);
    
    // Test 2: Stop browser if running
    if (statusRes.data.status === 'Browser running') {
      console.log('\n2. Testing /stop-browser endpoint...');
      const stopRes = await axios.post(`${baseUrl}/stop-browser`);
      console.log('Stop browser response:', stopRes.data);
      
      // Verify browser is stopped
      const statusAfterStop = await axios.get(`${baseUrl}/status`);
      console.log('Status after stopping:', statusAfterStop.data);
    }
    
    // Test 3: Start browser
    console.log('\n3. Testing /start-browser endpoint...');
    const startRes = await axios.post(`${baseUrl}/start-browser`);
    console.log('Start browser response:', startRes.data);
    
    // Verify browser is running
    const statusAfterStart = await axios.get(`${baseUrl}/status`);
    console.log('Status after starting:', statusAfterStart.data);
    
    // Test 4: Get markdown from a simple website
    console.log('\n4. Testing /get-markdown endpoint with example.com...');
    const markdownRes = await axios.post(`${baseUrl}/get-markdown`, {
      url: 'https://example.com',
      waitTime: 2000
    });
    
    console.log('Got markdown response:');
    console.log('Title:', markdownRes.data.title);
    console.log('Markdown preview (first 300 chars):');
    console.log(markdownRes.data.markdown.substring(0, 300));
    
    // Test 5: Get markdown with a selector
    console.log('\n5. Testing /get-markdown endpoint with selector...');
    const markdownWithSelectorRes = await axios.post(`${baseUrl}/get-markdown`, {
      url: 'https://example.com',
      waitTime: 2000,
      selector: 'h1'
    });
    
    console.log('Got markdown with selector response:');
    console.log('Title:', markdownWithSelectorRes.data.title);
    console.log('Markdown (should only contain h1):');
    console.log(markdownWithSelectorRes.data.markdown);
    
    // Test 6: Get markdown from a more complex website
    console.log('\n6. Testing /get-markdown endpoint with a more complex website...');
    const complexMarkdownRes = await axios.post(`${baseUrl}/get-markdown`, {
      url: 'https://nodejs.org',
      waitTime: 3000
    });
    
    console.log('Got complex markdown response:');
    console.log('Title:', complexMarkdownRes.data.title);
    console.log('Markdown preview (first 300 chars):');
    console.log(complexMarkdownRes.data.markdown.substring(0, 300));
    
    // Test 7: Error handling - invalid URL
    console.log('\n7. Testing error handling with invalid URL...');
    try {
      await axios.post(`${baseUrl}/get-markdown`, {
        url: 'invalid-url',
        waitTime: 1000
      });
      console.log('Error: Test should have failed but succeeded');
    } catch (error) {
      console.log('Expected error received:', error.response.data);
    }
    
    console.log('\n=== All tests completed successfully! ===');
  } catch (error) {
    console.error('\nTest failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

testAllEndpoints(); 