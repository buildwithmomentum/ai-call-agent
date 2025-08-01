import axios from 'axios';
import * as cheerio from 'cheerio';
import { Injectable } from '@nestjs/common';
import { JSDOM } from 'jsdom';
import * as TurndownService from 'turndown';
import * as puppeteer from 'puppeteer';
import { BrowserPool } from '../../utils/browserPool';

const headersForWorkAround = {
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
  'Accept-Encoding': 'gzip, deflate, br, zstd',
  'Accept-Language': 'en-GB,en;q=0.9',
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache',
  Priority: 'u=0, i',
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
};

@Injectable()
export class ScrapingService {
  private readonly turndownService: TurndownService;

  constructor() {
    this.turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
    });
  }

  private async isClientSideRendered(html: string): Promise<boolean> {
    const $ = cheerio.load(html);

    const hasReactRoot = $('#root').length > 0 || $('#app').length > 0;
    const hasAngularRoot = $('[ng-app]').length > 0 || $('app-root').length > 0;
    const hasVueRoot = $('#__nuxt').length > 0 || $('#__vue').length > 0;

    const mainContent = $('main, article, .content, #content, .post').first();
    const hasEmptyContent =
      mainContent.length > 0 && mainContent.text().trim().length === 0;

    const hasLoadingIndicators =
      $(
        '[class*="loading"], [id*="loading"], [class*="spinner"], [id*="spinner"]',
      ).length > 0;

    const scriptTags = $('script').toArray();
    const frameworkScripts = scriptTags.filter((script) => {
      const src = $(script).attr('src') || '';
      return (
        src.includes('react') ||
        src.includes('vue') ||
        src.includes('angular') ||
        src.includes('next') ||
        src.includes('nuxt')
      );
    });

    return (
      hasReactRoot ||
      hasAngularRoot ||
      hasVueRoot ||
      hasEmptyContent ||
      hasLoadingIndicators ||
      frameworkScripts.length > 0
    );
  }

  private async scrapeWithPuppeteer(
    url: string,
  ): Promise<{ title: string; content: string }> {
    const browser = (await BrowserPool.getInstance()).getBrowser();
    const page = await browser.newPage();
    try {
      await page.setViewport({ width: 1920, height: 1080 });
      await page.setUserAgent('Mozilla/5.0 (compatible; ChatbuddyBot/1.0;)');

      // Enable request interception to abort images, styles and fonts
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        const resourceType = req.resourceType();
        if (['image', 'stylesheet', 'font'].includes(resourceType)) {
          req.abort();
        } else {
          req.continue();
        }
      });

      // Updated navigation options for quicker/lightweight loading
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
      
      await page.evaluate(() => {
        ['script', 'style', 'iframe'].forEach((tag) => {
          document.querySelectorAll(tag).forEach((el) => el.remove());
        });

        document.querySelectorAll('*').forEach((el) => {
          Array.from(el.attributes).forEach((attr) => {
            if (attr.value.trim() === '') {
              el.remove();
            }
          });
        });
      });

      const content = await page.evaluate(() => {
        return document.body.innerHTML;
      });

      const title = await page.title();

      return { title, content };
    } finally {
      await page.close();
    }
  }

  private async scrapeWithAxios(
    url: string,
  ): Promise<{ title: string; content: string }> {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ChatbuddyBot/1.0;)',
      },
    });

    const dom = new JSDOM(response.data);
    const document = dom.window.document;

    ['script', 'style', 'iframe', 'nav', 'footer', 'header'].forEach((tag) => {
      const elements = document.getElementsByTagName(tag);
      for (let i = elements.length - 1; i >= 0; i--) {
        elements[i].remove();
      }
    });

    const $ = cheerio.load(response.data);
    const title = document.title || $('h1').first().text() || url;
    const mainContent = $('main, article, .content, #content, .post').first();
    const content = mainContent.length ? mainContent.html() : $('body').html();

    return { title, content };
  }

  async scrapeWebsite(url: string): Promise<{
    title: string;
    content: string;
    link: string;
    size: number;
    isCSR: boolean;
  }> {
    try {
      const response = await axios.get(url, {
        headers: headersForWorkAround,
      });
      const isCSR = await this.isClientSideRendered(response.data);
      const { title, content } = isCSR
        ? await this.scrapeWithPuppeteer(url)
        : await this.scrapeWithAxios(url);

      let markdown = this.turndownService.turndown(content);

      markdown = markdown.replace(/\[\]\(\/[^)]*\)/g, '');
      markdown = markdown.replace(/\[[^\]]*\]\(#[^)]*\)/g, '');

      return {
        title: title.trim(),
        content: markdown.trim(),
        link: url,
        size: Buffer.byteLength(markdown, 'utf8'),
        isCSR: isCSR,
      };
    } catch (error) {
      if (error.response && error.response.status === 404) {
        console.warn(`Skipping URL ${url} due to 404 error`);
        return {
          title: '',
          content: '',
          link: url,
          size: 0,
          isCSR: false,
        };
      }
      throw new Error(`Failed to scrape website ${url}: ${error.message}`);
    }
  }

  async scrapeMultipleUrls(urls: string[]): Promise<
    {
      title: string;
      content: string;
      link: string;
      size: number;
    }[]
  > {
    const results = await Promise.allSettled(
      urls.map((url) => this.scrapeWebsite(url)),
    );

    return results
      .filter(
        (result): result is PromiseFulfilledResult<any> =>
          result.status === 'fulfilled',
      )
      .map((result) => result.value);
  }

  async getAllUrlsFromPage(url: string): Promise<string[]> {
    if (!url || !url.trim()) {
      throw new Error('URL cannot be empty');
    }

    try {
      const validUrl = new URL(url);

      const browser = (await BrowserPool.getInstance()).getBrowser();
      const page = await browser.newPage();
      await page.setExtraHTTPHeaders(headersForWorkAround);

      // Enable request interception to abort non-critical resources
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        if (['image', 'stylesheet', 'font'].includes(req.resourceType())) {
          req.abort();
        } else {
          req.continue();
        }
      });

      // Updated navigation options for quicker/lightweight loading
      await page.goto(validUrl.toString(), { waitUntil: 'domcontentloaded', timeout: 10000 });

      const urls = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a'));
        return links
          .map((link) => link.href)
          .filter((href) => href && href.startsWith('http'));
      });

      await page.close();
      return [...new Set(urls)];
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('Invalid URL')) {
        throw new Error(`Invalid URL format: ${url}`);
      }
      throw new Error(`Failed to get URLs from page: ${error.message}`);
    }
  }
}
