# Chrome Page Server

A RESTful API service that maintains a persistent Chrome browser instance using puppeteer-core. The service can navigate to requested URLs and return the page content as Markdown.

## Features

- Persistent Chrome browser instance with shared user directory
- RESTful API for fetching web pages as Markdown
- Handles special characters and edge cases
- Browser auto-reconnection if disconnected

## Installation

```bash
npm install
```

## Usage

Start the server:

```bash
npm start
```

For development with auto-restart:

```bash
npm run dev
```

## API Endpoints

### GET /api/status

Check if the browser is running.

### POST /api/start-browser

Start the Chrome browser instance.

### POST /api/stop-browser

Stop the Chrome browser instance.

### POST /api/get-markdown

Fetch a webpage and convert it to Markdown.

Request body:

```json
{
  "url": "https://example.com",
  "waitTime": 2000,
  "selector": "body"
}
```

- `url` (required): The URL to navigate to
- `waitTime` (optional): Time to wait after page load in milliseconds (default: 2000)
- `selector` (optional): CSS selector to extract specific content

Response:

```json
{
  "url": "https://example.com",
  "markdown": "# Example Domain\n\nThis domain is...",
  "title": "Example Domain"
}
```

## Configuration

The server runs on port 3000 by default. You can change this by setting the `PORT` environment variable.
