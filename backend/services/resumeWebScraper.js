const puppeteer = require('puppeteer');
const { URL } = require('url');

class ResumeWebScraper {
  constructor() {
    this.platforms = {
      'zhipin.com': 'BOSS直聘',
      'lagou.com': '拉勾网',
      'liepin.com': '猎聘网',
      'zhaopin.com': '智联招聘',
      '51job.com': '前程无忧'
    };
  }

  async scrapeResume(url) {
    try {
      const hostname = this.extractHostname(url);
      const platform = this.identifyPlatform(hostname);

      if (!platform) {
        throw new Error('不支持的招聘平台');
      }

      console.log(`开始从 ${platform} 抓取简历信息...`);

      let resumeData;
      switch (platform) {
        case 'BOSS直聘':
          resumeData = await this.scrapeZhipin(url);
          break;
        case '拉勾网':
          resumeData = await this.scrapeLagou(url);
          break;
        case '猎聘网':
          resumeData = await this.scrapeLiepin(url);
          break;
        case '智联招聘':
          resumeData = await this.scrapeZhaopin(url);
          break;
        case '前程无忧':
          resumeData = await this.scrape51Job(url);
          break;
        default:
          throw new Error('不支持的招聘平台');
      }

      return {
        success: true,
        platform: platform,
        url: url,
        data: resumeData
      };
    } catch (error) {
      console.error('网页抓取失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  extractHostname(url) {
    try {
      const parsed = new URL(url);
      return parsed.hostname;
    } catch (error) {
      return '';
    }
  }

  identifyPlatform(hostname) {
    for (const [domain, name] of Object.entries(this.platforms)) {
      if (hostname.includes(domain)) {
        return name;
      }
    }
    return null;
  }

  async scrapeZhipin(url) {
    const browser = await puppeteer.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

      const resumeData = await page.evaluate(() => {
        const data = {
          name: '',
          phone: '',
          email: '',
          location: '',
          jobTitle: '',
          experience: '',
          education: '',
          skills: [],
          workExperience: [],
          educationBackground: []
        };

        const nameEl = document.querySelector('.name, .resume-name, .user-name, h1.name');
        if (nameEl) data.name = nameEl.textContent.trim();

        const phoneEl = document.querySelector('.phone, .mobile, .contact-phone');
        if (phoneEl) data.phone = phoneEl.textContent.trim();

        const emailEl = document.querySelector('.email, .contact-email');
        if (emailEl) data.email = emailEl.textContent.trim();

        const locationEl = document.querySelector('.location, .city, .work-city');
        if (locationEl) data.location = locationEl.textContent.trim();

        const jobTitleEl = document.querySelector('.job-title, .position, .expect-job');
        if (jobTitleEl) data.jobTitle = jobTitleEl.textContent.trim();

        const experienceEl = document.querySelector('.experience, .work-years');
        if (experienceEl) data.experience = experienceEl.textContent.trim();

        const educationEl = document.querySelector('.education, .degree');
        if (educationEl) data.education = educationEl.textContent.trim();

        const skillEls = document.querySelectorAll('.skill, .tag, .skill-tag');
        skillEls.forEach(el => {
          const skill = el.textContent.trim();
          if (skill) data.skills.push(skill);
        });

        const workExpEls = document.querySelectorAll('.work-experience, .experience-item, .job-item');
        workExpEls.forEach(el => {
          const company = el.querySelector('.company, .company-name')?.textContent.trim() || '';
          const position = el.querySelector('.position, .job-title')?.textContent.trim() || '';
          const duration = el.querySelector('.time, .duration')?.textContent.trim() || '';
          const description = el.querySelector('.description, .content')?.textContent.trim() || '';
          
          if (company || position) {
            data.workExperience.push({ company, position, duration, description });
          }
        });

        const eduEls = document.querySelectorAll('.education-item, .edu-item');
        eduEls.forEach(el => {
          const school = el.querySelector('.school, .university')?.textContent.trim() || '';
          const degree = el.querySelector('.degree, .education')?.textContent.trim() || '';
          const major = el.querySelector('.major, .profession')?.textContent.trim() || '';
          const time = el.querySelector('.time, .duration')?.textContent.trim() || '';
          
          if (school) {
            data.educationBackground.push({ school, degree, major, time });
          }
        });

        return data;
      });

      return resumeData;
    } finally {
      await browser.close();
    }
  }

  async scrapeLagou(url) {
    const browser = await puppeteer.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

      const resumeData = await page.evaluate(() => {
        const data = {
          name: '',
          phone: '',
          email: '',
          location: '',
          jobTitle: '',
          experience: '',
          education: '',
          skills: [],
          workExperience: [],
          educationBackground: []
        };

        const nameEl = document.querySelector('.resume-name, .user-name, h1');
        if (nameEl) data.name = nameEl.textContent.trim();

        const phoneEl = document.querySelector('.phone, .mobile');
        if (phoneEl) data.phone = phoneEl.textContent.trim();

        const emailEl = document.querySelector('.email');
        if (emailEl) data.email = emailEl.textContent.trim();

        const locationEl = document.querySelector('.city, .location');
        if (locationEl) data.location = locationEl.textContent.trim();

        const jobTitleEl = document.querySelector('.position, .job-title');
        if (jobTitleEl) data.jobTitle = jobTitleEl.textContent.trim();

        const experienceEl = document.querySelector('.work-year, .experience');
        if (experienceEl) data.experience = experienceEl.textContent.trim();

        const educationEl = document.querySelector('.education-degree, .degree');
        if (educationEl) data.education = educationEl.textContent.trim();

        const skillEls = document.querySelectorAll('.skill, .tag');
        skillEls.forEach(el => {
          const skill = el.textContent.trim();
          if (skill) data.skills.push(skill);
        });

        const workExpEls = document.querySelectorAll('.work-item, .experience-item');
        workExpEls.forEach(el => {
          const company = el.querySelector('.company')?.textContent.trim() || '';
          const position = el.querySelector('.position')?.textContent.trim() || '';
          const duration = el.querySelector('.time')?.textContent.trim() || '';
          const description = el.querySelector('.content')?.textContent.trim() || '';
          
          if (company || position) {
            data.workExperience.push({ company, position, duration, description });
          }
        });

        const eduEls = document.querySelectorAll('.education-item');
        eduEls.forEach(el => {
          const school = el.querySelector('.school')?.textContent.trim() || '';
          const degree = el.querySelector('.degree')?.textContent.trim() || '';
          const major = el.querySelector('.major')?.textContent.trim() || '';
          const time = el.querySelector('.time')?.textContent.trim() || '';
          
          if (school) {
            data.educationBackground.push({ school, degree, major, time });
          }
        });

        return data;
      });

      return resumeData;
    } finally {
      await browser.close();
    }
  }

  async scrapeLiepin(url) {
    const browser = await puppeteer.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

      const resumeData = await page.evaluate(() => {
        const data = {
          name: '',
          phone: '',
          email: '',
          location: '',
          jobTitle: '',
          experience: '',
          education: '',
          skills: [],
          workExperience: [],
          educationBackground: []
        };

        const nameEl = document.querySelector('.name, .resume-name');
        if (nameEl) data.name = nameEl.textContent.trim();

        const phoneEl = document.querySelector('.phone, .mobile');
        if (phoneEl) data.phone = phoneEl.textContent.trim();

        const emailEl = document.querySelector('.email');
        if (emailEl) data.email = emailEl.textContent.trim();

        const locationEl = document.querySelector('.city, .location');
        if (locationEl) data.location = locationEl.textContent.trim();

        const jobTitleEl = document.querySelector('.position, .job-title');
        if (jobTitleEl) data.jobTitle = jobTitleEl.textContent.trim();

        const experienceEl = document.querySelector('.work-year, .experience');
        if (experienceEl) data.experience = experienceEl.textContent.trim();

        const educationEl = document.querySelector('.education, .degree');
        if (educationEl) data.education = educationEl.textContent.trim();

        const skillEls = document.querySelectorAll('.skill, .tag');
        skillEls.forEach(el => {
          const skill = el.textContent.trim();
          if (skill) data.skills.push(skill);
        });

        const workExpEls = document.querySelectorAll('.work-item, .experience-item');
        workExpEls.forEach(el => {
          const company = el.querySelector('.company')?.textContent.trim() || '';
          const position = el.querySelector('.position')?.textContent.trim() || '';
          const duration = el.querySelector('.time')?.textContent.trim() || '';
          const description = el.querySelector('.content')?.textContent.trim() || '';
          
          if (company || position) {
            data.workExperience.push({ company, position, duration, description });
          }
        });

        const eduEls = document.querySelectorAll('.education-item');
        eduEls.forEach(el => {
          const school = el.querySelector('.school')?.textContent.trim() || '';
          const degree = el.querySelector('.degree')?.textContent.trim() || '';
          const major = el.querySelector('.major')?.textContent.trim() || '';
          const time = el.querySelector('.time')?.textContent.trim() || '';
          
          if (school) {
            data.educationBackground.push({ school, degree, major, time });
          }
        });

        return data;
      });

      return resumeData;
    } finally {
      await browser.close();
    }
  }

  async scrapeZhaopin(url) {
    const browser = await puppeteer.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

      const resumeData = await page.evaluate(() => {
        const data = {
          name: '',
          phone: '',
          email: '',
          location: '',
          jobTitle: '',
          experience: '',
          education: '',
          skills: [],
          workExperience: [],
          educationBackground: []
        };

        const nameEl = document.querySelector('.name, .resume-name');
        if (nameEl) data.name = nameEl.textContent.trim();

        const phoneEl = document.querySelector('.phone, .mobile');
        if (phoneEl) data.phone = phoneEl.textContent.trim();

        const emailEl = document.querySelector('.email');
        if (emailEl) data.email = emailEl.textContent.trim();

        const locationEl = document.querySelector('.city, .location');
        if (locationEl) data.location = locationEl.textContent.trim();

        const jobTitleEl = document.querySelector('.position, .job-title');
        if (jobTitleEl) data.jobTitle = jobTitleEl.textContent.trim();

        const experienceEl = document.querySelector('.work-year, .experience');
        if (experienceEl) data.experience = experienceEl.textContent.trim();

        const educationEl = document.querySelector('.education, .degree');
        if (educationEl) data.education = educationEl.textContent.trim();

        const skillEls = document.querySelectorAll('.skill, .tag');
        skillEls.forEach(el => {
          const skill = el.textContent.trim();
          if (skill) data.skills.push(skill);
        });

        const workExpEls = document.querySelectorAll('.work-item, .experience-item');
        workExpEls.forEach(el => {
          const company = el.querySelector('.company')?.textContent.trim() || '';
          const position = el.querySelector('.position')?.textContent.trim() || '';
          const duration = el.querySelector('.time')?.textContent.trim() || '';
          const description = el.querySelector('.content')?.textContent.trim() || '';
          
          if (company || position) {
            data.workExperience.push({ company, position, duration, description });
          }
        });

        const eduEls = document.querySelectorAll('.education-item');
        eduEls.forEach(el => {
          const school = el.querySelector('.school')?.textContent.trim() || '';
          const degree = el.querySelector('.degree')?.textContent.trim() || '';
          const major = el.querySelector('.major')?.textContent.trim() || '';
          const time = el.querySelector('.time')?.textContent.trim() || '';
          
          if (school) {
            data.educationBackground.push({ school, degree, major, time });
          }
        });

        return data;
      });

      return resumeData;
    } finally {
      await browser.close();
    }
  }

  async scrape51Job(url) {
    const browser = await puppeteer.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

      const resumeData = await page.evaluate(() => {
        const data = {
          name: '',
          phone: '',
          email: '',
          location: '',
          jobTitle: '',
          experience: '',
          education: '',
          skills: [],
          workExperience: [],
          educationBackground: []
        };

        const nameEl = document.querySelector('.name, .resume-name');
        if (nameEl) data.name = nameEl.textContent.trim();

        const phoneEl = document.querySelector('.phone, .mobile');
        if (phoneEl) data.phone = phoneEl.textContent.trim();

        const emailEl = document.querySelector('.email');
        if (emailEl) data.email = emailEl.textContent.trim();

        const locationEl = document.querySelector('.city, .location');
        if (locationEl) data.location = locationEl.textContent.trim();

        const jobTitleEl = document.querySelector('.position, .job-title');
        if (jobTitleEl) data.jobTitle = jobTitleEl.textContent.trim();

        const experienceEl = document.querySelector('.work-year, .experience');
        if (experienceEl) data.experience = experienceEl.textContent.trim();

        const educationEl = document.querySelector('.education, .degree');
        if (educationEl) data.education = educationEl.textContent.trim();

        const skillEls = document.querySelectorAll('.skill, .tag');
        skillEls.forEach(el => {
          const skill = el.textContent.trim();
          if (skill) data.skills.push(skill);
        });

        const workExpEls = document.querySelectorAll('.work-item, .experience-item');
        workExpEls.forEach(el => {
          const company = el.querySelector('.company')?.textContent.trim() || '';
          const position = el.querySelector('.position')?.textContent.trim() || '';
          const duration = el.querySelector('.time')?.textContent.trim() || '';
          const description = el.querySelector('.content')?.textContent.trim() || '';
          
          if (company || position) {
            data.workExperience.push({ company, position, duration, description });
          }
        });

        const eduEls = document.querySelectorAll('.education-item');
        eduEls.forEach(el => {
          const school = el.querySelector('.school')?.textContent.trim() || '';
          const degree = el.querySelector('.degree')?.textContent.trim() || '';
          const major = el.querySelector('.major')?.textContent.trim() || '';
          const time = el.querySelector('.time')?.textContent.trim() || '';
          
          if (school) {
            data.educationBackground.push({ school, degree, major, time });
          }
        });

        return data;
      });

      return resumeData;
    } finally {
      await browser.close();
    }
  }

  convertScrapedDataToText(resumeData) {
    const lines = [];
    
    if (resumeData.name) lines.push(`姓名：${resumeData.name}`);
    if (resumeData.phone) lines.push(`电话：${resumeData.phone}`);
    if (resumeData.email) lines.push(`邮箱：${resumeData.email}`);
    if (resumeData.location) lines.push(`地址：${resumeData.location}`);
    if (resumeData.jobTitle) lines.push(`求职意向：${resumeData.jobTitle}`);
    if (resumeData.experience) lines.push(`工作经验：${resumeData.experience}`);
    if (resumeData.education) lines.push(`学历：${resumeData.education}`);
    
    if (resumeData.skills && resumeData.skills.length > 0) {
      lines.push(`技能：${resumeData.skills.join(', ')}`);
    }
    
    if (resumeData.workExperience && resumeData.workExperience.length > 0) {
      lines.push('\n工作经历：');
      resumeData.workExperience.forEach((exp, index) => {
        lines.push(`${index + 1}. ${exp.company} - ${exp.position}`);
        if (exp.duration) lines.push(`   时间：${exp.duration}`);
        if (exp.description) lines.push(`   描述：${exp.description}`);
      });
    }
    
    if (resumeData.educationBackground && resumeData.educationBackground.length > 0) {
      lines.push('\n教育背景：');
      resumeData.educationBackground.forEach((edu, index) => {
        lines.push(`${index + 1}. ${edu.school}`);
        if (edu.degree) lines.push(`   学历：${edu.degree}`);
        if (edu.major) lines.push(`   专业：${edu.major}`);
        if (edu.time) lines.push(`   时间：${edu.time}`);
      });
    }
    
    return lines.join('\n');
  }
}

module.exports = ResumeWebScraper;
