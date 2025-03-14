const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const puppeteer = require('puppeteer-core');
const TurndownService = require('turndown');
const path = require('path');
const fs = require('fs');
const { URL } = require('url');

const app = express();
const PORT = process.env.PORT || 3000;
const userDataDir = path.join(__dirname, 'chrome-user-data');

// Ensure userDataDir exists
if (!fs.existsSync(userDataDir)) {
  fs.mkdirSync(userDataDir, { recursive: true });
}

// Middleware
app.use(express.json());
app.use(cors());
app.use(helmet());

// Variable to store browser instance
let browser = null;
let browserPage = null;

// Initialize the browser
async function initBrowser() {
  try {
    // For Mac, the default path is:
    const executablePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    
    console.log('Launching browser...');
    browser = await puppeteer.launch({
      executablePath,
      headless: true,
      userDataDir,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920x1080'
      ],
      defaultViewport: {
        width: 1920,
        height: 1080
      }
    });

    console.log('Browser launched successfully');
    
    // Create a default page
    browserPage = await browser.newPage();
    
    // Handle browser disconnection
    browser.on('disconnected', async () => {
      console.log('Browser disconnected. Restarting...');
      browser = null;
      browserPage = null;
      await initBrowser();
    });
    
    return true;
  } catch (error) {
    console.error('Error launching browser:', error);
    browser = null;
    browserPage = null;
    return false;
  }
}

// Utility functions
function sanitizeUrl(url) {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.toString();
  } catch (error) {
    throw new Error('Invalid URL format');
  }
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sanitizeHtml(html) {
  // Replace null characters
  let sanitized = html.replace(/\0/g, '');
  
  // Replace other problematic characters
  sanitized = sanitized.replace(/[\u2028\u2029]/g, ' ');
  
  return sanitized;
}

// Initialize turndown service for HTML to Markdown conversion
const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-'
});

// Custom rules for better markdown conversion
turndownService.addRule('preserveImages', {
  filter: 'img',
  replacement: function(content, node) {
    const alt = node.getAttribute('alt') || '';
    const src = node.getAttribute('src') || '';
    const title = node.getAttribute('title') || '';
    
    if (src) {
      return '![' + alt + '](' + src + (title ? ' "' + title + '"' : '') + ')';
    } else {
      return '';
    }
  }
});

// API routes
app.get('/api/status', async (req, res) => {
  res.json({
    status: browser ? 'Browser running' : 'Browser not running',
    uptime: browser ? process.uptime() : 0
  });
});

app.post('/api/start-browser', async (req, res) => {
  if (browser) {
    return res.json({ status: 'Browser already running' });
  }
  
  const success = await initBrowser();
  if (success) {
    res.json({ status: 'Browser started successfully' });
  } else {
    res.status(500).json({ error: 'Failed to start browser' });
  }
});

app.post('/api/stop-browser', async (req, res) => {
  if (!browser) {
    return res.json({ status: 'Browser not running' });
  }
  
  try {
    await browser.close();
    browser = null;
    browserPage = null;
    res.json({ status: 'Browser stopped successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to stop browser: ' + error.message });
  }
});

app.post('/api/get-markdown', async (req, res) => {
  try {
    const { url, waitTime = 2000, selector } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    
    // Sanitize URL
    const sanitizedUrl = sanitizeUrl(url);
    
    // Ensure browser is running
    if (!browser) {
      const success = await initBrowser();
      if (!success) {
        return res.status(500).json({ error: 'Failed to start browser' });
      }
    }
    
    if (!browserPage) {
      browserPage = await browser.newPage();
    }
    
    // Navigate to the URL
    await browserPage.goto(sanitizedUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    // Wait for specified time to ensure dynamic content is loaded
    await browserPage.waitForTimeout(waitTime);
    
    // If selector provided, wait for it
    if (selector) {
      try {
        await browserPage.waitForSelector(selector, { timeout: 5000 });
      } catch (error) {
        console.warn(`Selector "${selector}" not found, continuing anyway`);
      }
    }
    
    // Get the HTML content
    let html;
    if (selector) {
      // Get HTML from specific selector
      const element = await browserPage.$(selector);
      if (element) {
        html = await browserPage.evaluate(el => el.outerHTML, element);
      } else {
        // Fallback to full page if selector not found
        html = await browserPage.content();
      }
    } else {
      // Get full page HTML
      html = await browserPage.content();
    }
    
    // Sanitize HTML to remove problematic characters
    const sanitizedHtml = sanitizeHtml(html);
    
    // Convert HTML to Markdown
    const markdown = turndownService.turndown(sanitizedHtml);
    
    res.json({ 
      url: sanitizedUrl,
      markdown,
      title: await browserPage.title()
    });
    
  } catch (error) {
    console.error('Error fetching page:', error);
    res.status(500).json({ 
      error: 'Failed to process URL',
      message: error.message
    });
  }
});

// Application startup
async function startServer() {
  // Start the server
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
  
  // Initialize browser on startup
  await initBrowser();
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  if (browser) {
    console.log('Closing browser...');
    await browser.close();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  if (browser) {
    console.log('Closing browser...');
    await browser.close();
  }
  process.exit(0);
});

// Start the server
startServer().catch(error => {
  console.error('Failed to start server:', error);
});
