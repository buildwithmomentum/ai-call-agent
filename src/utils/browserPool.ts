import * as puppeteer from 'puppeteer';

export class BrowserPool {
  private static instance: BrowserPool;
  private browser: puppeteer.Browser | null = null;

  private constructor() {}

  public static async getInstance(): Promise<BrowserPool> {
    if (!BrowserPool.instance) {
      BrowserPool.instance = new BrowserPool();
      await BrowserPool.instance.initBrowser();
    }
    return BrowserPool.instance;
  }

  private async initBrowser() {
    const options: puppeteer.LaunchOptions = {
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
      ],
      headless: true,
    };
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      options.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    }
    this.browser = await puppeteer.launch(options);
  }

  public getBrowser(): puppeteer.Browser {
    if (!this.browser) {
      throw new Error("Browser not initialized");
    }
    return this.browser;
  }

  public async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
