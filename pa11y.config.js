module.exports = {
  standard: "WCAG2AAA",
  runners: ["axe"],
  timeout: Number.parseInt(process.env.PA11Y_TIMEOUT_MS || "300000", 10),
  wait: Number.parseInt(process.env.PA11Y_WAIT_MS || "1000", 10),
  chromeLaunchConfig: {
    executablePath: process.env.CHROME_PATH,
    protocolTimeout: Number.parseInt(process.env.PA11Y_TIMEOUT_MS || "300000", 10),
    args: ["--disable-gpu", "--no-sandbox", "--headless=new"],
  },
};
