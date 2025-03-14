const axios = require('axios');

// Make sure to install axios: npm install axios
// This is just for testing, not a project dependency

async function testApi() {
  const baseUrl = 'http://localhost:3000/api';
  
  try {
    // Test 1: Check status
    console.log('Testing /status endpoint...');
    const statusRes = await axios.get(`${baseUrl}/status`);
    console.log('Status response:', statusRes.data);
    
    // Test 2: Start browser if not running
    if (statusRes.data.status !== 'Browser running') {
      console.log('Starting browser...');
      const startRes = await axios.post(`${baseUrl}/start-browser`);
      console.log('Start browser response:', startRes.data);
    }
    
    // Test 3: Get markdown from a simple website
    console.log('Testing get-markdown endpoint...');
    const markdownRes = await axios.post(`${baseUrl}/get-markdown`, {
      url: 'https://example.com',
      waitTime: 1000
    });
    
    console.log('Got markdown response:');
    console.log('Title:', markdownRes.data.title);
    console.log('Markdown preview (first 300 chars):');
    console.log(markdownRes.data.markdown.substring(0, 300));
    
    console.log('\nAll tests completed successfully!');
  } catch (error) {
    console.error('Test failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

testApi();
