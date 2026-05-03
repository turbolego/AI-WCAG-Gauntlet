FROM node:24-bookworm-slim

# Install Chrome, Python 3, jq, bc, git
RUN apt-get update && apt-get install -y --no-install-recommends \
        gnupg wget ca-certificates \
        python3 jq bc git \
    && wget -q -O - https://dl.google.com/linux/linux_signing_key.pub \
       | gpg --dearmor -o /usr/share/keyrings/google-chrome.gpg \
    && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-chrome.gpg] \
       http://dl.google.com/linux/chrome/deb/ stable main" \
       > /etc/apt/sources.list.d/google-chrome.list \
    && apt-get update && apt-get install -y --no-install-recommends google-chrome-stable \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_DOWNLOAD=1 \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome \
    CHROME_PATH=/usr/bin/google-chrome

# Install a ChromeDriver version that matches the installed Chrome,
# then the test-suite CLI tools: axe, pa11y, qualweb.
RUN CHROME_MAJOR=$(google-chrome --version | grep -oP '\d+' | head -1) \
    && npm install -g \
       "chromedriver@^${CHROME_MAJOR}" \
       @axe-core/cli \
       pa11y \
       @qualweb/cli

WORKDIR /workspace
