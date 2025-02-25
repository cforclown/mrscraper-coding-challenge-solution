import puppeteer, { Page } from "puppeteer";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const openai = new OpenAI({
  baseURL: 'https://api.deepseek.com',
  apiKey: process.env.DEEPSEEK_API_KEY
});

const extractDataWithDeepseek = async (htmlContent: string): Promise<Record<string, any>[] | null> => {
  try {
    const completion = await openai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `
            I have specified HTML Content and converted result of products data as JSON:
            HTML: 
              <ul class="srp-results srp-grid clearfix">
                <li>
                  <div>
                    <div><a>
                        <div><span>Nike Air Max 90 x OFF-WHITE The Ten 2017</span></div><span>Opens in a new window or tab</span>
                      </a>
                      <div>
                        <div>
                          <div><span>IDR9,247,938.75</span></div>
                          <div><span>0 bids<span> · </span></span><span><span>Time left</span><span>6d 23h</span></span></div>
                          <div><span>IDR13,358,133.75</span></div>
                          <div><span>Buy It Now</span></div>
                          <div><span>+IDR411,019.50 delivery</span></div>
                          <div><span>from United Kingdom</span></div>
                          <div><span><span>Benefits charity</span></span></div>
                          <div><span><span>
                                <div>Sponsored</div>
                              </span></span><span></span></div>
                        </div>
                        <div></div>
                        <div></div>
                      </div>
                    </div>
                  </div>
                </li>
                <li>
                  <div>
                    <div><a>
                        <div><span>Nike Air Max 90 SE Lucha Libre DM6178-010</span></div><span>Opens in a new window or tab</span>
                      </a>
                      <div>
                        <div>
                          <div><span>IDR2,708,659.20<span> to </span>IDR3,050,497.20</span></div>
                          <div><span>Buy It Now</span></div>
                          <div><span>Free International Shipping</span></div>
                          <div><span>from Japan</span></div>
                          <div><span>Free returns</span></div>
                          <div><span><span>13+ sold</span></span></div>
                          <div><span><span>
                                <div>Sponsored</div>
                              </span></span><span></span></div>
                        </div>
                        <div></div>
                        <div><span><span><span>Top Rated Seller</span><svg>
                                <use></use>
                              </svg></span></span></div>
                      </div>
                    </div>
                  </div>
                </li>
              </ul>
            Converted JSON:
              [
                {
                  "name": "Nike Air Max 90 x OFF-WHITE The Ten 2017",
                  "price": "IDR9,247,938.75",
                  "description": "+IDR411,019.50 delivery from United Kingdom"
                },
                {
                  "name": "Nike Air Max 90 SE Lucha Libre DM6178-010",
                  "price": "IDR2,708,659.20 to IDR3,050,497.20",
                  "description": "Free International Shipping from Japan"
              ]

            If any field (e.g., product price or description) does not have a value, return '-'
          `,
        },
        {
          role: 'user',
          content: `
            <ul class="srp-results srp-grid clearfix">
              <li>
                <div>
                  <div><a>
                      <div><span>Nike WMNS Air Rift Triple Black HF5389-001</span></div><span>Opens in a new window or tab</span>
                    </a>
                    <div>
                      <div>
                        <div><span>IDR1,823,136.00<span> to </span>IDR3,434,658.00</span></div>
                        <div><span>Buy It Now</span></div>
                        <div><span>Free International Shipping</span></div>
                        <div><span>from Japan</span></div>
                        <div><span>Free returns</span></div>
                        <div><span><span>34+ sold</span></span></div>
                        <div><span><span>
                              <div>Sponsored</div>
                            </span></span><span></span></div>
                      </div>
                      <div></div>
                      <div><span><span><span>Top Rated Seller</span><svg>
                              <use></use>
                            </svg></span></span></div>
                    </div>
                  </div>
                </div>
              </li>
              <li>
                <div>
                  <div><a>
                      <div><span>Nike React Pegasus Trail 4 GTX V2 Gore-Tex Black Men Trail Running HM9728-002</span></div>
                      <span>Opens in a new window or tab</span>
                    </a>
                    <div>
                      <div>
                        <div><span></span></div>
                        <div><span>Buy It Now</span></div>
                        <div><span>Free International Shipping</span></div>
                        <div><span>from Taiwan</span></div>
                        <div><span><span>
                              <div>Sponsored</div>
                            </span></span><span></span></div>
                      </div>
                      <div></div>
                      <div></div>
                    </div>
                  </div>
                </div>
              </li>
            </ul>
          `,
        },
        {
          role: "assistant", 
          content: `[
            {"name":"Nike WMNS Air Rift Triple Black HF5389-001","price":"IDR1,823,136.00 to IDR3,434,658.00","description":"Free International Shipping from Japan"},
            {"name":"Nike React Pegasus Trail 4 GTX V2 Gore","price":"-","description":"Free International Shipping from Taiwan"}`
        },
        {
          role: "user", 
          content: htmlContent
        }
      ],
      model: "deepseek-chat",
    });

    // console.log(completion.choices[0].message.content);
    if(!completion.choices[0].message.content) {
      return null;
    }

    try {
      const parsedData = JSON.parse(completion.choices[0].message.content);
      return parsedData;
    } catch (error: any) {
      throw new Error('Result is not valid JSON');
    }
  } catch (error: any) {
    console.error('Error extracting products data using Deepseek API:', error.message);
    return null;
  }
}

const MAX_PAGE_TO_CRAWL = 5;
const ITEM_STACK_SELECTOR = '.srp-results.srp-grid.clearfix';
const NEXT_PAGE_BTN_SELECTOR = 'pagination__next.icon-link'
const pageHasSelector = async (page: Page, selector: string): Promise<boolean> => {
  return !!(await page.$(selector).catch(() => false));
}
// Function to scrape product data
async function scrapeProductData(url: string) {
  const browser = await puppeteer.launch({
    headless: true,
  });
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  const blockedResourceTypes = [
    'image',
    'stylesheet',
    'font',
    'media',
    'object',
    'texttrack',
    'imageset',
    'csp_report',
  ];
  page.on('request', (req) => {
    if (blockedResourceTypes.includes(req.resourceType())) {
      req.abort();
    } else {
      req.continue();
    }
  });

  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector(ITEM_STACK_SELECTOR);

  let products = [];

  // iterate through pagination
  let currentPage = 1;
  let hasNextPage = true;
  while (hasNextPage && currentPage <= MAX_PAGE_TO_CRAWL) {
    const itemStackHTMLContent = await extractDataFromProductPage(page);
    if(itemStackHTMLContent) {
      const currentPageProducts = await extractDataWithDeepseek(itemStackHTMLContent);
      if(currentPageProducts) {
        products.push(...currentPageProducts);
      }
    }

    hasNextPage = await pageHasSelector(page, NEXT_PAGE_BTN_SELECTOR);
    if(hasNextPage) {
      const nextPageBtn = await page.$(NEXT_PAGE_BTN_SELECTOR);
      if(nextPageBtn) {
        await nextPageBtn.click();
        await page.waitForNavigation({ waitUntil: 'domcontentloaded' });
        currentPage++;
      } else {
        break;
      }
    } else {
      break;
    }
  }

  await browser.close();
  return products;
}

const extractDataFromProductPage = async (page: Page): Promise<string | null> => {
  let itemStackHTMLContent = await page.evaluate((selector) => {
    const element = document.querySelector(selector);
    if(element) {
      // remove unnecessary elements
      element.querySelectorAll('[class="s-item__image-section"]').forEach(el => el.remove());
      element.querySelectorAll('[class="s-item__caption"]').forEach(el => el.remove());
      element.querySelectorAll('[class="s-item__subtitle"]').forEach(el => el.remove());
      element.querySelectorAll('[class="s-item__reviews"]').forEach(el => el.remove());
      element.querySelectorAll('script').forEach(el => el.remove());
      element.querySelectorAll('*').forEach(el => {
        for (const attr of Array.from(el.attributes)) {
            el.removeAttribute(attr.name);
        }
      });
      // remove the comment node
      const removeComments = (el: Element | ChildNode) => {
        for (let i = el.childNodes.length - 1; i >= 0; i--) {
            const child = el.childNodes[i];
            if (child.nodeType === Node.COMMENT_NODE) {
                child.remove(); 
            } else if (child.nodeType === Node.ELEMENT_NODE) {
                removeComments(child);
            }
        }
      };
      removeComments(element);

      return element.outerHTML;
    }

    return null;
  }, ITEM_STACK_SELECTOR);

  return itemStackHTMLContent;
}

// Main function
(async () => {
  const url = 'https://www.ebay.com/sch/i.html?_from=R40&_nkw=nike&_sacat=0&rt=nc&_pgn=1';
  const products = await scrapeProductData(url);
  console.log(products);
})();
