const axios = require('axios');
const cheerio = require('cheerio');
const logger = require('../utils/logger');
const pw = require('playwright');

class JobImportService {
  constructor() {
    this.browser = null;
  }

  async parseUrl(url) {
    try {
      const u = new URL(url);
      const host = u.hostname;
      let data = null;

      logger.info(`Starting job import for URL: ${url}`);

      // Strategy Pattern for different platforms
      if (host.includes('zhipin.com')) {
        data = await this.parseBoss(url, u);
      } else if (host.includes('lagou.com')) {
        data = await this.parseLagou(url, u);
      } else if (host.includes('liepin.com')) {
        data = await this.parseLiepin(url, u);
      } else if (host.includes('51job.com')) {
        data = await this.parse51Job(url, u);
      } else if (host.includes('zhaopin.com')) {
        data = await this.parseZhaopin(url, u);
      }

      // If specific parser failed or not matched, try generic
      if (!data || !data.title) {
        logger.info('Using generic parser fallback');
        data = await this.parseGeneric(url, data);
      }

      return data;
    } catch (error) {
      logger.error(`Error parsing URL ${url}: ${error.message}`);
      throw new Error(`无法解析该网页: ${error.message}`);
    }
  }

  // --- Common Helpers ---

  makeHeaders(host, isMobile = false) {
    return {
      'User-Agent': isMobile 
        ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1'
        : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Cache-Control': 'no-cache',
      'Upgrade-Insecure-Requests': '1',
      'Referer': `https://${host || 'www.google.com'}/`,
    };
  }

  async fetchHtml(url, headers) {
    try {
      const response = await axios.get(url, {
        headers: headers || this.makeHeaders(new URL(url).hostname),
        timeout: 10000,
        maxRedirects: 5,
        validateStatus: (s) => s >= 200 && s < 400
      });
      return response.data;
    } catch (e) {
      logger.warn(`Fetch failed for ${url}: ${e.message}`);
      return null;
    }
  }

  async tryHeadless(url, isMobile = false) {
    let browser = null;
    try {
      browser = await pw.chromium.launch({ 
          headless: true,
          args: [
            '--disable-blink-features=AutomationControlled',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-infobars',
            '--window-position=0,0',
            '--ignore-certifcate-errors',
            '--ignore-certifcate-errors-spki-list',
            '--user-agent=' + (isMobile 
                ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1'
                : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36')
          ]
      });

      let context;
      if (isMobile) {
        const device = pw.devices['iPhone 12'];
        context = await browser.newContext({
          ...device,
          locale: 'zh-CN',
          timezoneId: 'Asia/Shanghai'
        });
      } else {
        context = await browser.newContext({
          locale: 'zh-CN',
          timezoneId: 'Asia/Shanghai',
          viewport: { width: 1440, height: 900 }
        });
      }
      
      // Enhanced Anti-detection
      await context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
        // Mock plugins
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
        // Mock languages
        Object.defineProperty(navigator, 'languages', { get: () => ['zh-CN', 'zh', 'en'] });
        // Mock chrome object
        window.chrome = { runtime: {} };
      });

      const page = await context.newPage();
      
      // Random mouse movements to simulate human behavior
      try {
          await page.mouse.move(Math.floor(Math.random() * 500), Math.floor(Math.random() * 500));
      } catch(e) {}

      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
        
        // Wait for some common elements or next data
        await Promise.race([
          page.waitForSelector('h1', { timeout: 5000 }).catch(()=>{}),
          page.waitForSelector('.job-title', { timeout: 5000 }).catch(()=>{}),
          page.waitForSelector('#__NEXT_DATA__', { timeout: 5000 }).catch(()=>{}),
          page.waitForTimeout(3000)
        ]);
      } catch (e) {
        logger.warn(`Headless navigation partial timeout: ${e.message}`);
      }

      const content = await page.content();
      await browser.close();
      return content;
    } catch (e) {
      logger.warn('Headless render failed', { message: e.message });
      if (browser) await browser.close();
      return null;
    }
  }

  extractFromCheerio($, selectors) {
    let result = '';
    for (const sel of selectors) {
      const el = $(sel);
      if (el.length) {
        // Clean up text
        let text = el.text().trim();
        // Remove excessive whitespace
        text = text.replace(/\s+/g, ' ');
        if (text) {
          result = text;
          break;
        }
      }
    }
    return result;
  }

  extractContentFromCheerio($, selectors) {
    let content = '';
    let maxLen = 0;
    
    for (const sel of selectors) {
      const el = $(sel);
      if (el.length) {
        // Clone to avoid modifying original DOM if needed, but here we just read
        // Remove scripts/styles
        el.find('script, style, iframe, noscript').remove();
        
        // Replace <br> and <p> with newlines for better formatting
        let html = el.html() || '';
        html = html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n\n');
        
        const text = cheerio.load(html).text();
        const cleanText = text.split('\n').map(l => l.trim()).filter(Boolean).join('\n');
        
        if (cleanText.length > maxLen) {
          maxLen = cleanText.length;
          content = cleanText;
        }
      }
    }
    return content;
  }

  // --- Platform Parsers ---

  // 1. Boss Zhipin
  async parseBoss(url, uObj) {
    let d = {};
    const host = uObj.hostname;

    // Handle List Pages (e.g. /web/geek/jobs?...)
    if (url.includes('/web/geek/jobs') || url.includes('query=')) {
        logger.info('Detected Boss Zhipin List Page, attempting to extract first job via API interception...');
        return this.parseBossListViaNetwork(url);
    }
    
    // Handle Detail Pages (e.g. /job_detail/...)
    // Prefer Headless immediately for detail pages as they often have strong anti-bot
    logger.info('Detected Boss Zhipin Detail Page, using Headless mode...');
    
    let html = await this.tryHeadless(url);
    if (!html) {
         // Fallback to mobile if headless failed (rare)
         const mUrl = url.replace('www.zhipin.com', 'm.zhipin.com');
         html = await this.fetchHtml(mUrl, this.makeHeaders('m.zhipin.com', true));
    }

    if (!html) return d;
    const $ = cheerio.load(html);

    // 1. Try to extract from _jobInfo global variable (Common in PC pages)
    try {
        const scriptContent = $('script').filter((i, el) => $(el).html().includes('_jobInfo')).html();
        if (scriptContent) {
             const match = scriptContent.match(/var _jobInfo = ({[\s\S]*?});/);
             if (match && match[1]) {
                 // Relaxed JSON parsing because keys might not be quoted
                 const jsonStr = match[1].replace(/(\w+):/g, '"$1":').replace(/'/g, '"');
                 try {
                     const jobInfo = JSON.parse(jsonStr);
                     d.title = jobInfo.job_name;
                     d.salary = jobInfo.job_salary;
                 } catch (e) {
                     // Regex extraction fallback if JSON parse fails
                     d.title = scriptContent.match(/job_name:\s*'([^']+)'/)?.[1];
                     d.salary = scriptContent.match(/job_salary:\s*'([^']+)'/)?.[1];
                 }
             }
        }
    } catch (e) {
        logger.warn('Failed to extract _jobInfo', e);
    }

    // 2. Try extracting from __NEXT_DATA__ (Mobile/Next.js pages)
    if (!d.title) {
        try {
          const nextData = $('script#__NEXT_DATA__').html();
          if (nextData) {
            const jd = JSON.parse(nextData);
            const job = jd?.props?.pageProps?.detailData?.jobInfo 
                     || jd?.props?.pageProps?.jobInfo 
                     || jd?.props?.pageProps?.detailData; // PC structure varies
            if (job) {
              d.title = job.jobName || job.title || job.positionName;
              d.salary = job.salaryDesc || job.salary;
              d.location = [job.cityName, job.areaName, job.businessName].filter(Boolean).join(' ');
              d.description = job.jobDesc || job.description || job.postDescription;
              d.requirements = job.jobRequire; // Sometimes separate
              d.experience = job.experienceName || job.workingExp;
              d.education = job.degreeName || job.educationalRequirements;
            }
          }
        } catch (_) {}
    }

    // 3. Precise DOM fallback (The most reliable for static PC pages)
    if (!d.title) d.title = this.extractFromCheerio($, ['.job-banner .name h1', '.job-name', 'h1']);
    if (!d.salary) d.salary = this.extractFromCheerio($, ['.job-banner .salary', '.salary']);
    
    // Banner info: Location, Experience, Education
    // Structure: <p><a class="text-city">City</a> <span class="text-experiece">Exp</span> <span class="text-degree">Edu</span></p>
    if (!d.location) d.location = this.extractFromCheerio($, ['.job-banner .text-city', '.location-address']);
    if (!d.experience) d.experience = this.extractFromCheerio($, ['.job-banner .text-experiece', '.job-banner p span:nth-child(2)']);
    if (!d.education) d.education = this.extractFromCheerio($, ['.job-banner .text-degree', '.job-banner p span:last-child']);
    
    // Description: specifically target the first .job-sec-text (Job Desc), avoid Company Desc
    if (!d.description) {
        // Find the section that contains "职位描述" or "岗位职责"
        const descSection = $('.job-sec-text').first();
        if (descSection.length) {
            let html = descSection.html();
            html = html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n\n');
            d.description = cheerio.load(html).text();
        } else {
             d.description = this.extractContentFromCheerio($, ['.job-detail-section', '.text']);
        }
    }

    return d;
  }

  // Specialized method to handle Boss Zhipin List Pages via Network Interception
  async parseBossListViaNetwork(url) {
      let d = {};
      let browser = null;
      try {
          browser = await pw.chromium.launch({ headless: true });
          const context = await browser.newContext({
              userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
              viewport: { width: 1440, height: 900 }
          });
          
          await context.addInitScript(() => {
              Object.defineProperty(navigator, 'webdriver', { get: () => false });
          });

          const page = await context.newPage();
          
          // Promise to wait for the job list
          const jobListPromise = new Promise((resolve) => {
              page.on('response', async response => {
                  const rUrl = response.url();
                  if (rUrl.includes('joblist.json') || rUrl.includes('search/joblist')) {
                      try {
                          const json = await response.json();
                          if (json.zpData && json.zpData.jobList && json.zpData.jobList.length > 0) {
                              resolve(json.zpData.jobList[0]);
                          }
                      } catch (e) {
                          // ignore json parse errors
                      }
                  }
              });
              // Timeout fallback
              setTimeout(() => resolve(null), 15000);
          });

          try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
          } catch(e) {
             logger.warn('Boss list navigation partial fail/timeout', e.message);
          }

          const jobData = await jobListPromise;

          if (jobData) {
              logger.info('Successfully intercepted job data from list API');
              d.title = jobData.jobName;
              d.salary = jobData.salaryDesc;
              d.location = [jobData.cityName, jobData.areaDistrict, jobData.businessDistrict].filter(Boolean).join(' ');
              d.experience = jobData.jobExperience;
              d.education = jobData.jobDegree;
              // Description is usually missing in list API, but we have benefits and skills
              const skills = (jobData.skills || []).join('、');
              const welfare = (jobData.welfareList || []).join('、');
              d.description = `【职位技能】\n${skills}\n\n【福利待遇】\n${welfare}\n\n(注：由于反爬虫限制，完整职位描述请参考原链接，以上为自动提取的关键信息)`;
              
              // Optional: Try to fetch detail page for full description if we have ID
              // But risk getting blocked. For now, returning partial reliable data is better than "Blank Page".
          }

      } catch (e) {
          logger.error('Error in parseBossListViaNetwork:', e);
      } finally {
          if (browser) await browser.close();
      }
      return d;
  }

  // 2. Lagou
  async parseLagou(url, uObj) {
    let d = {};
    
    // Prefer Headless for Lagou New Site (/wn/)
    let html = await this.tryHeadless(url);
    
    // Fallback to mobile if headless failed or blocked
    if (!html || html.includes('访问验证') || html.length < 500) {
        // Try mobile URL logic
        let targetUrl = url;
        // Convert /wn/jobs/123.html to mobile if possible
        const idMatch = url.match(/jobs\/(\d+)\.html/);
        if (idMatch) {
          targetUrl = `https://m.lagou.com/jobs/${idMatch[1]}.html`;
        }
        if (targetUrl !== url) {
             html = await this.fetchHtml(targetUrl, this.makeHeaders('m.lagou.com', true));
             if (!html || html.includes('访问验证')) {
                 html = await this.tryHeadless(targetUrl, true);
             }
        }
    }

    if (!html) return d;
    const $ = cheerio.load(html);
    
    // Check for WAF/Captcha
    if ($('title').text().includes('访问验证') || $('#waf_nc_h5_block').length > 0) {
        logger.warn('Lagou WAF detected');
        throw new Error('拉勾网触发了安全验证(WAF)，请稍后重试或尝试手动填写');
    }

    // 1. Try extracting from __NEXT_DATA__ (Lagou /wn/ uses this)
    try {
        const nextData = $('script#__NEXT_DATA__').html();
        if (nextData) {
            const json = JSON.parse(nextData);
            const posInfo = json?.props?.pageProps?.positionInfo;
            if (posInfo) {
                d.title = posInfo.positionName;
                d.salary = posInfo.salary;
                d.location = [posInfo.city, posInfo.district].filter(Boolean).join(' ');
                d.description = posInfo.positionDetail;
                d.experience = posInfo.workYear;
                d.education = posInfo.education;
                
                // Labels/Tags
                if (posInfo.positionLabels && Array.isArray(posInfo.positionLabels)) {
                     d.requirements = `【职位标签】\n${posInfo.positionLabels.join('、')}\n\n` + d.description;
                }
            }
        }
    } catch (e) {
        logger.warn('Lagou NEXT_DATA parse failed', e);
    }

    // 2. DOM Fallback
    if (!d.title) d.title = this.extractFromCheerio($, ['.position-head-wrap-position-name', '.position-title', '.job-name', 'h1']);
    if (!d.salary) d.salary = this.extractFromCheerio($, ['.salary', '.job-salary']);
    if (!d.location) d.location = this.extractFromCheerio($, ['.work-address', '.workaddress', '.job-address']);
    
    if (!d.description) d.description = this.extractContentFromCheerio($, ['.job-detail', '.position-desc', '.job-description', '.content']);
    
    // Fallback experience/education from text
    if (!d.experience) {
        const text = $('.job-item.workingExp').text() || $('.job-banner').text();
        const expMatch = text.match(/(\d+-\d+年|经验不限|应届生|\d+年以内)/);
        if (expMatch) d.experience = expMatch[0];
    }
    if (!d.education) {
        const text = $('.job-item.education').text() || $('.job-banner').text();
         const eduMatch = text.match(/(本科|大专|硕士|博士|不限)/);
         if (eduMatch) d.education = eduMatch[0];
    }

    return d;
  }

  // 3. Liepin (New)
  async parseLiepin(url, uObj) {
    let d = {};
    // Liepin structure: .job-title-content, .job-item-title, .job-main-title
    
    // Prefer Headless for Liepin as it often renders dynamically or has anti-bot
    let html = await this.tryHeadless(url);
    if (!html) {
        html = await this.fetchHtml(url, this.makeHeaders(uObj.hostname));
    }
    if (!html) return d;

    const $ = cheerio.load(html);

    // 1. Try extracting from __NEXT_DATA__ (New Liepin architecture)
    try {
        const nextData = $('script#__NEXT_DATA__').html();
        if (nextData) {
            const json = JSON.parse(nextData);
            const jobInfo = json?.props?.pageProps?.job?.jobInfo || json?.props?.pageProps?.data?.jobInfo;
            if (jobInfo) {
                d.title = jobInfo.title;
                d.salary = jobInfo.salary;
                d.location = [jobInfo.city, jobInfo.dqName].filter(Boolean).join(' ');
                d.description = jobInfo.desc || jobInfo.jobDesc;
                d.experience = jobInfo.workYear || jobInfo.requireWorkYears;
                d.education = jobInfo.degree || jobInfo.requireEduLevel;
                
                // Labels/Welfare
                if (jobInfo.labels && Array.isArray(jobInfo.labels)) {
                     d.requirements = `【职位标签】\n${jobInfo.labels.join('、')}\n\n`;
                }
            }
        }
    } catch (e) {
        // ignore
    }

    // 2. DOM Fallback
    if (!d.title) d.title = this.extractFromCheerio($, ['.job-apply-content .name-box .name', '.job-title-content', '.name-box .name', 'h1', '.title-info h1']);
    if (!d.salary) d.salary = this.extractFromCheerio($, ['.job-apply-content .salary', '.job-item-title', '.salary', '.job-title-content .salary']);
    if (!d.location) d.location = this.extractFromCheerio($, ['.job-apply-content .job-properties span:first-child', '.job-address', '.job-item-title + span', '.sub-title-box a']);
    
    if (!d.description) {
         d.description = this.extractContentFromCheerio($, ['section.job-intro-container', '.job-item-content', '.job-description', '.job-main-content', '.content-area']);
    }

    // Experience/Education often in .job-properties or .job-qualifications
    if (!d.experience) {
        const text = $('.job-properties').text() || $('.job-qualifications').text();
        const match = text.match(/(\d+-\d+年|经验不限|应届生|\d+年以内)/);
        if (match) d.experience = match[0];
    }
    if (!d.education) {
        const text = $('.job-properties').text() || $('.job-qualifications').text();
        const match = text.match(/(本科|大专|硕士|博士|不限)/);
        if (match) d.education = match[0];
    }

    return d;
  }

  // 4. 51Job (New)
  async parse51Job(url, uObj) {
    let d = {};
    // 51Job has old and new versions.
    // Old: .cn h1, .cn strong
    // New: .tHeader .in .cn h1
    
    // 51job often requires GBK handling if using axios directly, but modern pages are UTF-8 or mixed.
    // Try Headless first as 51job has complex redirect/loading
    let html = await this.tryHeadless(url);
    if (!html) {
        html = await this.fetchHtml(url, this.makeHeaders(uObj.hostname));
    }
    
    if (!html) return d;

    const $ = cheerio.load(html);

    // 1. Try JSON-LD or Embedded Scripts (Common in modern 51job)
    try {
        const scripts = $('script').filter((i, el) => $(el).html().includes('window.__SEARCH_RESULT__') || $(el).html().includes('job_detail_header')).html();
        if (scripts) {
             // Try to extract vars
             const titleMatch = scripts.match(/jobName\s*:\s*['"](.*?)['"]/);
             if (titleMatch) d.title = titleMatch[1];
        }
    } catch (_) {}

    // 2. DOM Selectors (New 2024/2025 layout)
    if (!d.title) d.title = this.extractFromCheerio($, ['.tHeader .in .cn h1', '.j_title', 'h1[title]']);
    if (!d.salary) d.salary = this.extractFromCheerio($, ['.tHeader .in .cn strong', '.j_salary', '.salary']);
    
    // Location, Experience, Education are often in p.msg or similar
    if (!d.location) {
        // <p class="msg ltype" title="长沙-长沙县&nbsp;&nbsp;|&nbsp;&nbsp;10年以上经验&nbsp;&nbsp;|&nbsp;&nbsp;本科">
        const msg = $('.tHeader .in .cn .msg').attr('title') || $('.tHeader .in .cn .msg').text();
        if (msg) {
            const parts = msg.split('|').map(s => s.trim());
            if (parts[0]) d.location = parts[0].replace(/&nbsp;/g, '');
            if (parts.find(s => s.includes('经验'))) d.experience = parts.find(s => s.includes('经验'));
            if (parts.find(s => s.includes('科') || s.includes('专') || s.includes('硕') || s.includes('博'))) d.education = parts.find(s => s.includes('科') || s.includes('专') || s.includes('硕') || s.includes('博'));
        }
    }

    if (!d.description) {
        d.description = this.extractContentFromCheerio($, ['.job_msg', '.bmsg.job_msg', '.j_info', '.tBorderTop_box:has(h2:contains("职位信息")) .bmsg']);
    }

    // Fallback for location if still empty
    if (!d.location) d.location = this.extractFromCheerio($, ['.bmsg .fp', '.lname']);

    return d;
  }

  // 5. Zhaopin (New)
  async parseZhaopin(url, uObj) {
    let d = {};
    // Zhaopin is React/Vue heavy and uses different structures for different job types (e.g. campus vs social)
    
    // Try Headless first as Zhaopin is very dynamic
    let html = await this.tryHeadless(url);
    if (!html) {
        // Fallback to fetch if headless fails
        html = await this.fetchHtml(url, this.makeHeaders(uObj.hostname));
    }
    
    if (!html) return d;

    const $ = cheerio.load(html);

    // 1. Try __INITIAL_STATE__ (Common in React SSR)
    try {
        const scriptContent = $('script').filter((i, el) => $(el).html().includes('__INITIAL_STATE__')).html();
        if (scriptContent) {
            const match = scriptContent.match(/__INITIAL_STATE__=(.*?);/);
            if (match && match[1]) {
                const state = JSON.parse(match[1]);
                const jobInfo = state?.jobDetail?.jobDetail || state?.jobInfo?.jobDetail; // Path varies
                if (jobInfo) {
                    d.title = jobInfo.name || jobInfo.jobName;
                    d.salary = jobInfo.salaryCount || jobInfo.salary;
                    d.location = jobInfo.cityDistrict || jobInfo.city;
                    d.description = jobInfo.jobDesc || jobInfo.description;
                    d.experience = jobInfo.workingExp || jobInfo.workExperience;
                    d.education = jobInfo.education;
                }
            }
        }
    } catch (e) {
        logger.warn('Zhaopin INITIAL_STATE parse failed', e);
    }

    // 2. DOM Fallback
    if (!d.title) d.title = this.extractFromCheerio($, ['.summary-plane__title', '.job-summary .name', 'h1', '.inner-left h1']);
    if (!d.salary) d.salary = this.extractFromCheerio($, ['.summary-plane__salary', '.job-summary .salary', '.salary strong']);
    
    // Location often in a list
    if (!d.location) d.location = this.extractFromCheerio($, ['.job-address__content-text', '.summary-plane__city', '.promulgator-info__address', '.job-summary .city']);

    if (!d.description) d.description = this.extractContentFromCheerio($, ['.describtion__detail-content', '.job-detail-content', '.pos-ul']);
    
    // Experience & Education from tags/lists
    if (!d.experience) {
        const items = $('.summary-plane__info li').map((i, el) => $(el).text()).get();
        d.experience = items.find(t => t.includes('年') && !t.includes('本科') && !t.includes('硕士')) || '';
    }
    if (!d.education) {
        const items = $('.summary-plane__info li').map((i, el) => $(el).text()).get();
        d.education = items.find(t => t.includes('本科') || t.includes('硕士') || t.includes('大专') || t.includes('学历')) || '';
    }

    return d;
  }

  // --- Generic Parser ---
  async parseGeneric(url, partialData = {}) {
    let d = { ...partialData };
    
    // Only fetch if we haven't already tried headless (which returns full html)
    // But since we don't pass HTML between methods here, we might refetch. 
    // Optimization: The specific parsers return what they found. If title is missing, we fetch again here.
    
    let html = await this.fetchHtml(url);
    if (!html) return d;

    const $ = cheerio.load(html);

    // 1. JSON-LD (Standard Schema.org)
    const scripts = $('script[type="application/ld+json"]');
    scripts.each((i, el) => {
      try {
        const json = JSON.parse($(el).html());
        const obj = Array.isArray(json) ? json.find(o => o['@type'] === 'JobPosting') : (json['@type'] === 'JobPosting' ? json : null);
        if (obj) {
          d.title = d.title || obj.title;
          d.description = d.description || obj.description;
          d.salary = d.salary || (obj.baseSalary?.value?.value || obj.baseSalary?.value);
          
          if (!d.location && obj.jobLocation?.address) {
            const a = obj.jobLocation.address;
            d.location = [a.addressLocality, a.addressRegion].filter(Boolean).join(' ');
          }
        }
      } catch (_) {}
    });

    // 2. Open Graph & Meta tags
    if (!d.title) d.title = $('meta[property="og:title"]').attr('content') || $('title').text();
    if (!d.description) d.description = $('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content');

    // 3. Common Selectors fallback
    if (!d.title) d.title = this.extractFromCheerio($, ['h1', '.job-title', '.title']);
    if (!d.description) d.description = this.extractContentFromCheerio($, ['.job-description', '.description', 'article', 'main']);

    return d;
  }
}

module.exports = new JobImportService();
