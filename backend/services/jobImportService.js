const axios = require('axios');
const cheerio = require('cheerio');
const logger = require('../utils/logger');

class JobImportService {
  async parseUrl(url) {
    try {
      // 1. Fetch the page
      const makeHeaders = (host) => ({
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Cache-Control': 'no-cache',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'sec-ch-ua': '"Chromium";v="120", "Not?A_Brand";v="24", "Google Chrome";v="120"',
        'sec-ch-ua-platform': '"macOS"',
        'sec-ch-ua-mobile': '?0',
        'Referer': `https://${host || 'www.zhipin.com'}/`,
        'Pragma': 'no-cache'
      });

      const response = await axios.get(url, {
        headers: makeHeaders(new URL(url).hostname),
        timeout: 8000,
        maxRedirects: 5,
        validateStatus: (s) => s >= 200 && s < 400
      });

      let html = response.data;
      const $ = cheerio.load(html);

      // 2. Parse data
      const data = {
        title: '',
        description: '',
        location: '',
        salary: '',
        requirements: '',
        experience: ''
      };

      try {
        const u = new URL(url);
        const h = u.hostname || '';
        const path = u.pathname || '';
        if (h.includes('zhipin.com')) {
          let d = {};
          const nextData = $('script#__NEXT_DATA__').html();
          if (nextData) {
            try {
              const jd = JSON.parse(nextData);
              const p = jd && jd.props && jd.props.pageProps ? jd.props.pageProps : null;
              const j = p && p.detailData ? p.detailData : null;
              if (j) {
                d.title = j.jobName || j.title || '';
                d.salary = j.salaryDesc || j.salary || '';
                const city = (j.city && j.city.name) || '';
                const area = (j.area && j.area.name) || '';
                const addr = (j.address || '').trim();
                d.location = [city, area, addr].filter(Boolean).join(' ');
                const desc1 = (j.jobDesc || '').trim();
                const req1 = (j.jobRequire || '').trim();
                if (desc1) d.description = desc1;
                if (req1) d.requirements = req1;
              }
            } catch (_) {}
          }
          // Boss security fallback: if page is a security wait page, try mobile site
          const pageTitle = $('title').text().trim();
          const isSecurity = pageTitle.includes('请稍候') || /securityCheck|正在加载中/.test(html);
          if (isSecurity) {
            try {
              const mobileUrl = `https://m.zhipin.com${u.pathname}${u.search || ''}`;
              const mResp = await axios.get(mobileUrl, { headers: makeHeaders('m.zhipin.com'), timeout: 8000, maxRedirects: 5, validateStatus: (s)=>s>=200&&s<400 });
              const mHtml = mResp.data;
              const m$ = cheerio.load(mHtml);
              const mt = m$('h1,.job-title,.name').first().text().trim();
              const ms = m$('.salary,.job-salary,.info-primary .salary').first().text().trim();
              const ml = m$('.job-address,.address,.location,.info-primary p').first().text().trim();
              const mDesc = m$('.detail-content,.job-detail,.job-sec-text,.text,.job-description').text().trim();
              if (mt) d.title = d.title || mt;
              if (ms) d.salary = d.salary || ms;
              if (ml) d.location = d.location || ml.replace(/\s+/g,' ');
              if (mDesc) {
                // Attempt split by typical headers
                const descMatch = mDesc.match(/(职位描述|岗位职责|工作职责)[:：]([\s\S]*?)(岗位要求|职位要求|任职要求|$)/);
                const reqMatch = mDesc.match(/(岗位要求|职位要求|任职要求)[:：]([\s\S]*?)(工作地址|$)/);
                if (descMatch && descMatch[2]) d.description = d.description || descMatch[2].trim();
                if (reqMatch && reqMatch[2]) d.requirements = d.requirements || reqMatch[2].trim();
                if (!descMatch && !reqMatch) {
                  d.description = d.description || mDesc;
                }
              }
            } catch (e) {
              logger.warn('Mobile zhipin fallback failed', { message: e.message });
            }
            if ((!d.title && !d.description) || d.title === '请稍候') {
              const hHtml = await tryHeadless(url);
              if (hHtml) {
                const h$ = cheerio.load(hHtml);
                const ht = h$('h1,.job-name,.name').first().text().trim();
                const hs = h$('.salary,.job-banner .salary,.info-primary .salary').first().text().trim();
                const hl = (h$('.job-area .text,.job-address .text,.location,.info-primary p').first().text().trim()||'').replace(/\s+/g,' ');
                let hc = h$('.job-sec .text,.job-detail,.detail-content,.content,.job-sec-text').text().trim();
                if (ht) d.title = d.title || ht;
                if (hs) d.salary = d.salary || hs;
                if (hl) d.location = d.location || hl;
                if (hc) d.description = d.description || hc;
              }
            }
          }

          if (!d.title) {
            d.title = $('.job-name,.name,h1').first().text().trim();
          }
          if (!d.salary) {
            d.salary = $('.salary,.job-banner .salary,.info-primary .salary').first().text().trim();
          }
          if (!d.location) {
            const locText = $('.job-area .text,.job-sec .text:contains("工作地址"),.job-address .text,.location,.info-primary p').first().text().trim();
            if (locText) d.location = locText.replace(/\s+/g,' ');
          }
          if (!d.description || !d.requirements) {
            const secs = $('.job-sec');
            let descBlock = '';
            let reqBlock = '';
            secs.each((i, el) => {
              const t1 = $(el).find('h3,.title').first().text().trim();
              const txt = $(el).find('.text,.job-sec-text').text().trim();
              if (!txt) return;
              if (t1.includes('职位描述') || t1.includes('岗位职责') || t1.includes('工作职责')) {
                if (txt.length > descBlock.length) descBlock = txt;
              } else if (t1.includes('任职要求') || t1.includes('职位要求') || t1.includes('岗位要求')) {
                if (txt.length > reqBlock.length) reqBlock = txt;
              }
            });
            if (!d.description) d.description = descBlock;
            if (!d.requirements) d.requirements = reqBlock;
          }

          if (path.includes('/gongsi/')) {
            if (!d.title) d.title = $('.job-name,.name,h1,.title').first().text().trim();
            if (!d.location) {
              let addrText = '';
              const cand = $('*').filter((i, el) => $(el).text().includes('工作地址'));
              if (cand.length) {
                const t = $(cand[0]).text();
                addrText = t.replace(/.*工作地址[:：]\s*/, '').trim();
              }
              if (addrText) d.location = addrText;
            }
            if (!d.description || !d.requirements) {
              let descBlock = d.description || '';
              let reqBlock = d.requirements || '';
              $('.job-sec,.job-detail,.content,.detail-content,.job-detail-box').each((i, el) => {
                const ht = $(el).find('h3,.title').first().text().trim();
                const tx = $(el).find('.text,.job-sec-text,.content,.detail-content').text().trim();
                if (!tx) return;
                if (!descBlock && (ht.includes('职位描述') || ht.includes('岗位职责') || ht.includes('工作职责'))) descBlock = tx;
                if (!reqBlock && (ht.includes('岗位要求') || ht.includes('任职要求') || ht.includes('职位要求'))) reqBlock = tx;
              });
              if (!descBlock || !reqBlock || !d.location) {
                const bt = $('body').text();
                if (!descBlock) {
                  const m = bt.match(/职位描述[:：]([\s\S]*?)(岗位要求|职位要求|任职要求|工作地址|$)/);
                  if (m) descBlock = m[1].trim();
                }
                if (!reqBlock) {
                  const m2 = bt.match(/(岗位要求|职位要求|任职要求)[:：]([\s\S]*?)(工作地址|$)/);
                  if (m2) reqBlock = m2[2].trim();
                }
                if (!d.location) {
                  const m3 = bt.match(/工作地址[:：]\s*([\s\S]*?)(点击查看地图|查看更多信息|$)/);
                  if (m3) d.location = m3[1].trim();
                }
              }
              if (!d.description && descBlock) d.description = descBlock;
              if (!d.requirements && reqBlock) d.requirements = reqBlock;
            }
          }

          if (d.title || d.description || d.location || d.salary || d.requirements) {
            if (d.title) data.title = d.title;
            if (d.description) data.description = d.description;
            if (d.requirements) data.requirements = d.requirements;
            if (d.location) data.location = d.location;
            if (d.salary) data.salary = d.salary;
          }
        }
        // Lagou adapter
        if (h.includes('lagou.com')) {
          let d = {};
          const pageTitle = $('title').text().trim();
          const isGate = pageTitle.includes('访问验证') || /滑动验证|访问验证/.test(html);
          // Try mobile with job id
          const idMatch = path.match(/wn\/jobs\/(\d+)/);
          if (isGate && idMatch) {
            try {
              const id = idMatch[1];
              const mUrl = `https://m.lagou.com/wn/jobs/${id}.html`;
              const mResp = await axios.get(mUrl, { headers: makeHeaders('m.lagou.com'), timeout: 8000, maxRedirects: 5, validateStatus: s=>s>=200&&s<400 });
              const mHtml = mResp.data;
              const m$ = cheerio.load(mHtml);
              d.title = (m$('h1,.job-name,.position-title').first().text().trim()) || '';
              d.salary = m$('.salary,.job-salary,.compensation').first().text().trim() || '';
              d.location = (m$('.address,.job-address,.workaddress').first().text().trim() || '').replace(/\s+/g,' ');
              let content = m$('.job-detail,.detail-content,.content,.position-description,.job-description,.text').text().trim();
              if (content) {
                const descMatch = content.match(/(职位描述|岗位职责|工作职责)[:：]([\s\S]*?)(岗位要求|职位要求|任职要求|$)/);
                const reqMatch = content.match(/(岗位要求|职位要求|任职要求)[:：]([\s\S]*?)(工作地址|$)/);
                if (descMatch && descMatch[2]) d.description = descMatch[2].trim();
                if (reqMatch && reqMatch[2]) d.requirements = reqMatch[2].trim();
                if (!d.description) d.description = content;
              }
              const needHeadless = (!d.title && !d.description) || /访问验证|滑动验证/.test(mHtml);
              if (needHeadless) {
                const hHtml = await tryHeadless(mUrl, true);
                if (hHtml) {
                  const h$ = cheerio.load(hHtml);
                  const ht = h$('h1,.position-title,.job-name').first().text().trim();
                  const hs = h$('.salary,.job-salary,.compensation').first().text().trim();
                  const hl = (h$('.address,.job-address,.workaddress').first().text().trim()||'').replace(/\s+/g,' ');
                  let hc = h$('.job-detail,.detail-content,.content,.position-description,.job-description,.text').text().trim();
                  if (ht) d.title = d.title || ht;
                  if (hs) d.salary = d.salary || hs;
                  if (hl) d.location = d.location || hl;
                  if (hc) d.description = d.description || hc;
                }
              }
            } catch (e) {
              logger.warn('Lagou mobile fallback failed', { message: e.message });
              try {
                const id = idMatch[1];
                const mUrl = `https://m.lagou.com/wn/jobs/${id}.html`;
                const hHtml = await tryHeadless(mUrl, true);
                if (hHtml) {
                  const h$ = cheerio.load(hHtml);
                  const ht = h$('h1,.position-title,.job-name').first().text().trim();
                  const hs = h$('.salary,.job-salary,.compensation').first().text().trim();
                  const hl = (h$('.address,.job-address,.workaddress').first().text().trim()||'').replace(/\s+/g,' ');
                  let hc = h$('.job-detail,.detail-content,.content,.position-description,.job-description,.text').text().trim();
                  if (ht) d.title = d.title || ht;
                  if (hs) d.salary = d.salary || hs;
                  if (hl) d.location = d.location || hl;
                  if (hc) d.description = d.description || hc;
                }
              } catch (_) {}
            }
          }
          if ((!d.title || d.title.includes('访问验证')) && idMatch) {
            const hHtml = await tryHeadless(url);
            if (hHtml) {
              const h$ = cheerio.load(hHtml);
              d.title = d.title || h$('h1,.position-title,.job-name').first().text().trim();
              d.salary = d.salary || h$('.salary,.job-salary,.compensation').first().text().trim();
              d.location = d.location || (h$('.address,.job-address,.workaddress').first().text().trim()||'').replace(/\s+/g,' ');
              let hc = h$('.job-detail,.detail-content,.content,.position-description,.job-description,.text').text().trim();
              if (hc) d.description = d.description || hc;
            }
          }
          // If still empty, attempt direct DOM
          if (!d.title) d.title = $('h1,.position-title,.job-name').first().text().trim();
          if (!d.salary) d.salary = $('.salary,.job-salary,.compensation').first().text().trim();
          if (!d.location) d.location = ($('.address,.job-address,.workaddress').first().text().trim()||'').replace(/\s+/g,' ');
          if (!d.description || !d.requirements) {
            let txt = $('.job-detail,.detail-content,.content,.position-description,.job-description,.text').text().trim();
            if (!txt) txt = $('body').text().trim();
            if (txt) {
              const descMatch = txt.match(/(职位描述|岗位职责|工作职责)[:：]([\s\S]*?)(岗位要求|职位要求|任职要求|$)/);
              const reqMatch = txt.match(/(岗位要求|职位要求|任职要求)[:：]([\s\S]*?)(工作地址|$)/);
              if (descMatch && descMatch[2]) d.description = d.description || descMatch[2].trim();
              if (reqMatch && reqMatch[2]) d.requirements = d.requirements || reqMatch[2].trim();
              if (!d.description) d.description = txt.slice(0, 1200);
            }
          }
          if (d.title || d.description || d.location || d.salary || d.requirements) {
            if (d.title) data.title = d.title;
            if (d.description) data.description = d.description;
            if (d.requirements) data.requirements = d.requirements;
            if (d.location) data.location = d.location;
            if (d.salary) data.salary = d.salary;
          }
        }
        // Boss listing fallback: find a detail link and follow
        if (h.includes('zhipin.com') && /\/web\/geek\/jobs/.test(path)) {
          try {
            let links = [];
            $('a').each((i, el) => {
              const href = String($(el).attr('href')||'');
              if (/\/job_detail\//.test(href) || /\/gongsi\/job\//.test(href)) { links.push(href); }
            });
            links = Array.from(new Set(links)).slice(0, 5);
            if (links.length === 0) {
              try {
                const pw = require('playwright');
                const browser = await pw.chromium.launch({ headless: true });
                const context = await browser.newContext({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36' });
                const page = await context.newPage();
                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
                try { await page.waitForSelector('a[href*="/job_detail/"], a[href*="/gongsi/job/"]', { timeout: 10000 }); } catch (_) {}
                links = await page.evaluate(() => Array.from(document.querySelectorAll('a[href*="/job_detail/"], a[href*="/gongsi/job/"]')).map(a => a.href));
                await browser.close();
              } catch (e) {
                logger.warn('Boss listing headless link extraction failed', { message: e.message });
              }
            }
            for (const href of links) {
              try {
                const full = href.startsWith('http') ? href : `https://www.zhipin.com${href}`;
                const r2 = await axios.get(full, { headers: makeHeaders('www.zhipin.com'), timeout: 10000, maxRedirects:5, validateStatus:s=>s>=200&&s<400 });
                const h2 = r2.data;
                const $2 = cheerio.load(h2);
                const jTitle = ($2('.job-name,.name,h1,.title').first().text().trim()) || ($2('meta[property="og:title"]').attr('content')||'');
                const jSalary = $2('.salary,.job-banner .salary,.info-primary .salary').first().text().trim();
                const jLoc = ($2('.job-area .text,.job-address .text,.location,.info-primary p').first().text().trim()||'').replace(/\s+/g,' ');
                let jDesc = $2('.job-sec .text,.job-detail,.detail-content,.content,.job-sec-text').text().trim();
                if (!jDesc) jDesc = $2('body').text().trim();
                if (jTitle && jDesc) { data.title = jTitle; data.salary = jSalary; data.location = jLoc; data.description = jDesc; break; }
              } catch (e) { continue }
            }
          } catch (e) {
            logger.warn('Boss listing fallback failed', { message: e.message });
          }
        }
      } catch (_) {}

      const jsonLdScripts = $('script[type="application/ld+json"]').toArray();
      let jsonLd = null;
      for (const s of jsonLdScripts) {
        const t = $(s).html();
        if (!t) continue;
        try {
          const j = JSON.parse(t.trim());
          if (Array.isArray(j)) {
            for (const item of j) {
              if (item && (item['@type'] === 'JobPosting' || (Array.isArray(item['@type']) && item['@type'].includes('JobPosting')))) { jsonLd = item; break; }
            }
          } else if (j && (j['@type'] === 'JobPosting' || (Array.isArray(j['@type']) && j['@type'].includes('JobPosting')))) {
            jsonLd = j;
          }
          if (jsonLd) break;
        } catch (_) {}
      }
      if (jsonLd) {
        data.title = jsonLd.title || jsonLd.name || data.title;
        data.description = (jsonLd.description || '').toString().trim() || data.description;
        if (jsonLd.jobLocation) {
          const jl = Array.isArray(jsonLd.jobLocation) ? jsonLd.jobLocation[0] : jsonLd.jobLocation;
          const addr = jl && jl.address ? jl.address : null;
          const locParts = [];
          if (addr && addr.addressRegion) locParts.push(addr.addressRegion);
          if (addr && addr.addressLocality) locParts.push(addr.addressLocality);
          if (addr && addr.streetAddress) locParts.push(addr.streetAddress);
          if (!data.location && locParts.length) data.location = locParts.join(' ');
        }
        if (jsonLd.baseSalary) {
          const bs = jsonLd.baseSalary;
          if (typeof bs === 'string') data.salary = bs;
          else if (bs && bs.value) {
            const v = bs.value;
            const min = v.minValue || v.value || '';
            const max = v.maxValue || '';
            const unit = v.unitText || '';
            const cur = bs.currency || '';
            const parts = [];
            if (min) parts.push(min);
            if (max) parts.push(max);
            const range = parts.join('-');
            const tail = [cur, unit].filter(Boolean).join('/');
            data.salary = [range, tail].filter(Boolean).join(' ');
          }
        }
      }

      // Title extraction
      // Priority: h1 -> og:title -> title tag
      data.title = $('h1').first().text().trim();
      if (!data.title) {
        data.title = $('meta[property="og:title"]').attr('content') || $('meta[name="title"]').attr('content');
      }
      if (!data.title) {
        data.title = $('title').text().split('-')[0].trim();
      }

      // Location extraction
      // Common selectors for location
      const locationSelectors = ['.job-location', '.work_addr', '.job_addr', '[itemprop="addressLocality"]', '.info-area', '.address', '.workaddress', '.job-address', '.summary-plane__city'];
      for (const sel of locationSelectors) {
        const text = $(sel).text().trim();
        if (text) {
          data.location = text.replace(/\s+/g, ' ');
          break;
        }
      }
      
      // Salary extraction
      const salarySelectors = ['.job-salary', '.salary', '.offer-salary', '.summary-plane__salary', '.job-pay', '.compensation'];
      for (const sel of salarySelectors) {
        const text = $(sel).text().trim();
        if (text) {
          data.salary = text;
          break;
        }
      }

      // Description & Requirements extraction
      // Try to find the main content area
      const contentSelectors = [
        '.job-detail', '.job_detail', '.job-description', '.description', 
        '[itemprop="description"]', '.job_bt', '.post-description',
        '.position-description', '.content', '.detail-content', '.duty', '.requirement', '.text', '.article', '.jd', '.job-sec', '.job-sec-text'
      ];
      
      let fullContent = '';
      let bestLen = 0;
      for (const sel of contentSelectors) {
        if ($(sel).length) {
          $(sel).find('script, style').remove();
          let contentHtml = $(sel).html() || '';
          contentHtml = contentHtml.replace(/<br\s*\/?>(?=)/gi, '\n').replace(/<\/p>/gi, '\n');
          const txt = cheerio.load(contentHtml).text().split('\n').map(s=>s.trim()).filter(Boolean).join('\n');
          if (txt.length > bestLen) { bestLen = txt.length; fullContent = txt; }
        }
      }

      if (!fullContent) {
        const metaDesc = $('meta[name="description"]').attr('content') || '';
        const bodyTxt = $('body').text();
        fullContent = [metaDesc, bodyTxt].join('\n');
      }

      // Clean up whitespace
      fullContent = fullContent.split('\n').map(line => line.trim()).filter(line => line).join('\n');

      // Attempt to split into Description and Requirements
      const reqKeywords = ['任职要求', '任职资格', '职位要求', '岗位要求', 'Requirements', 'Qualifications', '必备条件', '加分项'];
      const descKeywords = ['职位描述', '岗位职责', '工作职责', 'Responsibilities', 'Job Description', '岗位介绍'];

      let splitIndex = -1;
      for (const kw of reqKeywords) {
        const idx = fullContent.indexOf(kw);
        if (idx !== -1) {
          splitIndex = idx;
          break;
        }
      }

      if (splitIndex !== -1) {
        // Split found
        let descPart = fullContent.substring(0, splitIndex);
        let reqPart = fullContent.substring(splitIndex);

        // Remove the keywords themselves if they are headers
        // (Simple cleanup)
        
        data.description = descPart.trim();
        data.requirements = reqPart.trim();
      } else {
        data.description = fullContent.substring(0, 1000); // Limit length if no split found
      }
      
      // Experience extraction (Regex from full content or specific selectors)
      const expRegex = /(\d+[-到]\d+年经验|\d+\+?年以上经验|至少\d+年|经验不限|应届生)/;
      const expMatch = fullContent.match(expRegex);
      if (expMatch) {
        data.experience = expMatch[1];
      } else {
        // Try specific selectors
        const expSelectors = ['.job-exp', '.experience', '.summary-plane__exp'];
        for (const sel of expSelectors) {
            const text = $(sel).text().trim();
            if (text) {
                data.experience = text;
                break;
            }
        }
      }

      if (!data.requirements && fullContent.length > 0) {
        const pos = descKeywords.reduce((p, kw) => (p === -1 ? fullContent.indexOf(kw) : p), -1);
        if (pos !== -1) {
          const after = fullContent.substring(pos + 4);
          data.requirements = after.substring(0, 1000);
        }
      }

      if (!data.salary) {
        const s1 = fullContent.match(/(\d+\.?\d*)\s*[kK]\s*[-~至]\s*(\d+\.?\d*)\s*[kK]/);
        const s2 = fullContent.match(/(\d+)\s*[-~至]\s*(\d+)\s*(元|人民币|RMB|CNY)\s*\/?\s*(月|年)?/);
        if (s1) {
          data.salary = `${s1[1]}k-${s1[2]}k`;
        } else if (s2) {
          const unit = s2[5] || '';
          data.salary = `${s2[1]}-${s2[2]}${unit ? '/' + unit : ''}`;
        }
      }

      return data;

    } catch (error) {
      logger.error(`Error parsing URL ${url}: ${error.message}`);
      throw new Error(`无法解析该网页: ${error.message}`);
    }
  }
}

module.exports = new JobImportService();
      const tryHeadless = async (targetUrl, emulateMobile = false) => {
        try {
          const pw = require('playwright');
          const browser = await pw.chromium.launch({ headless: true });
          let context;
          if (emulateMobile) {
            const device = pw.devices['iPhone 12'];
            context = await browser.newContext({
              ...device,
              locale: 'zh-CN',
              userAgent: device.userAgent
            });
          } else {
            context = await browser.newContext({
              locale: 'zh-CN',
              userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
              viewport: { width: 1366, height: 900 }
            });
          }
          await context.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => false });
          });
          await context.setExtraHTTPHeaders({
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
          });
          const page = await context.newPage();
          await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
          try { await page.waitForLoadState('networkidle', { timeout: 10000 }); } catch (_) {}
          try { await page.waitForTimeout(1200); } catch (_) {}
          try {
            await page.evaluate(() => { window.scrollTo(0, document.body.scrollHeight); });
            await page.waitForTimeout(800);
          } catch (_) {}
          const content = await page.content();
          await browser.close();
          return content;
        } catch (e) {
          logger.warn('Headless render failed', { message: e.message });
          return '';
        }
      };
