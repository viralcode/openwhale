# Browser Automation

OpenWhale can browse the web, interact with pages, and automate tasks.

## Capabilities

- Navigate to any URL
- Click elements
- Fill forms
- Take screenshots
- Read page content
- Execute JavaScript

## Basic Commands

### Browse a website
```
Open https://github.com and take a screenshot
```

### Search and interact
```
Go to google.com, search for "OpenWhale AI", and tell me the first 3 results
```

### Fill forms
```
Go to that signup page and fill in my info: name John Doe, email john@example.com
```

## Advanced Examples

### Web scraping
```
Go to news.ycombinator.com and list the top 10 posts with their scores
```

### Monitoring
```
Check if example.com is loading correctly and report any errors
```

### Screenshot documentation
```
Take screenshots of our landing page at mobile, tablet, and desktop widths
```

## BrowserOS Mode

For complex automation, OpenWhale has a dedicated BrowserOS tool:

```
Use browser to login to my dashboard, navigate to settings, and download my data export
```

## Tips

- Browser runs in **headless mode** by default
- Screenshots are saved to `.openwhale-temp/`
- JavaScript execution is available for complex interactions
- Vision AI analyzes screenshots for context

## Troubleshooting

### "Browser failed to launch"
```bash
# Install Playwright browsers
npx playwright install chromium
```

### Slow performance
Consider using `web_fetch` for simple page reads (faster, no rendering).
