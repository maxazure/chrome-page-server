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
    console.log('Using Chrome at:', executablePath);
    
    // Create a new temporary directory for this browser instance
    const tempUserDataDir = path.join(userDataDir, `chrome-${Date.now()}`);
    console.log('Temporary user data directory:', tempUserDataDir);
    
    fs.mkdirSync(tempUserDataDir, { recursive: true });
    
    browser = await puppeteer.launch({
      executablePath,
      headless: true,
      userDataDir,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--window-size=1920,1080',
        '--start-maximized',
        '--disable-blink-features=AutomationControlled',
        '--disable-infobars',
        '--ignore-certificate-errors',
        '--ignore-certificate-errors-spki-list',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-notifications',
        '--disable-popup-blocking',
        '--disable-save-password-bubble',
        '--disable-translate',
        '--disable-extensions',
        '--disable-default-apps',
        '--disable-sync',
        '--disable-background-networking',
        '--metrics-recording-only',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-breakpad',
        '--disable-component-extensions-with-background-pages',
        '--disable-features=TranslateUI,BlinkGenPropertyTrees',
        '--disable-ipc-flooding-protection',
        '--enable-features=NetworkService,NetworkServiceInProcess',
        '--force-color-profile=srgb',
        '--hide-scrollbars',
        '--ignore-gpu-blacklist',
        '--mute-audio',
        '--no-zygote',
        '--password-store=basic',
        '--use-gl=swiftshader',
        '--use-mock-keychain',
        '--window-position=0,0'
      ]
    });

    console.log('Browser launched successfully');
    
    // Create a default page
    browserPage = await browser.newPage();
    
    // Handle browser disconnection
    browser.on('disconnected', async () => {
      console.log('Browser disconnected. Cleaning up...');
      try {
        if (fs.existsSync(tempUserDataDir)) {
          fs.rmSync(tempUserDataDir, { recursive: true, force: true });
        }
      } catch (error) {
        console.warn('Cleanup warning:', error.message);
      }
      browser = null;
      browserPage = null;
      await initBrowser();
    });
    
    // 设置页面视口大小
    await browserPage.setViewport({
      width: 1920,
      height: 1080
    });

    // 设置 User-Agent
    await browserPage.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

    // 注入 JavaScript 来修改 navigator.webdriver
    await browserPage.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined
      });
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5]
      });
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en']
      });
    });
    
    return true;
  } catch (error) {
    console.error('Error launching browser:', error);
    console.error('Error details:', error.stack);
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

    // 设置页面超时时间
    await browserPage.setDefaultNavigationTimeout(60000); // 60秒导航超时
    await browserPage.setDefaultTimeout(60000); // 60秒默认超时
    
    // Navigate to the URL with more comprehensive wait conditions
    await browserPage.goto(sanitizedUrl, {
      waitUntil: ['networkidle0', 'domcontentloaded', 'load'],
      timeout: 60000
    });

    // 等待页面加载完成
    await Promise.all([
      // 等待网络请求完成
      browserPage.waitForNetworkIdle({ timeout: 60000, idleTime: 5000 }),
      // 等待页面渲染完成
      browserPage.evaluate(() => {
        return new Promise((resolve) => {
          if (document.readyState === 'complete') {
            resolve();
          } else {
            window.addEventListener('load', resolve);
          }
        });
      }),
      // 等待动态内容加载
      new Promise(resolve => setTimeout(resolve, waitTime))
    ]);
    
    // 如果页面有动态加载的内容,等待一段时间确保加载完成
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // If selector provided, wait for it with increased timeout
    if (selector) {
      try {
        await browserPage.waitForSelector(selector, { 
          timeout: 10000,
          visible: true 
        });
      } catch (error) {
        console.warn(`Selector "${selector}" not found or not visible, continuing anyway`);
      }
    }
    
    // 检查页面是否完全加载
    const isPageLoaded = await browserPage.evaluate(() => {
      return document.readyState === 'complete' && 
             !document.querySelector('loading') && 
             !document.querySelector('.loading') &&
             !document.querySelector('#loading') &&
             !document.querySelector('[aria-busy="true"]');
    });

    if (!isPageLoaded) {
      console.warn('Page may not be fully loaded, waiting additional time...');
      await new Promise(resolve => setTimeout(resolve, 5000));
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
  // Kill any existing node processes on port 3000
  try {
    await new Promise((resolve) => {
      require('child_process').exec('lsof -ti:3000 | xargs kill -9', () => resolve());
    });
  } catch (error) {
    console.warn('No existing process on port 3000');
  }

  // Kill any existing Chrome processes
  try {
    if (process.platform === 'darwin') {
      console.log('Cleaning up any existing Chrome processes...');
      await new Promise((resolve) => {
        require('child_process').exec('pkill -f "Google Chrome"', () => resolve());
      });
    }
  } catch (error) {
    console.warn('Chrome cleanup warning:', error.message);
  }

  // Clean up chrome-user-data directory
  try {
    console.log('Cleaning up user data directory...');
    if (fs.existsSync(userDataDir)) {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    }
    fs.mkdirSync(userDataDir, { recursive: true });
  } catch (error) {
    console.warn('Directory cleanup warning:', error.message);
  }

  // Wait for cleanup to complete
  await new Promise(resolve => setTimeout(resolve, 2000));

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
  // Clean up chrome-user-data directory
  try {
    if (fs.existsSync(userDataDir)) {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    }
  } catch (error) {
    console.warn('Cleanup warning:', error.message);
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  if (browser) {
    console.log('Closing browser...');
    await browser.close();
  }
  // Clean up chrome-user-data directory
  try {
    if (fs.existsSync(userDataDir)) {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    }
  } catch (error) {
    console.warn('Cleanup warning:', error.message);
  }
  process.exit(0);
});

// Start the server
startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
