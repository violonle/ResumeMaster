const { chromium } = require('playwright');

async function main() {
  const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:5173';
  const phone = process.env.TEST_PHONE || '18605355138';
  const password = process.env.TEST_PASSWORD || 'Longkou7';
  const resumeId = process.env.TEST_RESUME_ID || '1';

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(`${baseUrl}/pages/login.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');

    await page.locator('#passwordLoginTab').click();
    await page.locator('#emailPhoneInput').fill(phone);
    await page.locator('#passwordInput').fill(password);
    await page.locator('#passwordLoginBtn').click();

    await page.waitForURL(/dashboard\.html/, { timeout: 20000 });
    await page.waitForLoadState('networkidle');

    await page.goto(`${baseUrl}/pages/librarypool.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');

    const analysisBtn = page.locator(`[onclick*="analysis-detail.html?resume_id=${resumeId}"]`).first();
    const detailsBtn = page.locator(`[onclick*="resume-details.html?id=${resumeId}"]`).first();
    await Promise.all([
      analysisBtn.waitFor({ state: 'visible', timeout: 20000 }),
      detailsBtn.waitFor({ state: 'visible', timeout: 20000 })
    ]);

    let container = detailsBtn.locator('xpath=ancestor::div[contains(@class,"border-b")][1]');
    if ((await container.count()) === 0) {
      container = detailsBtn.locator('xpath=ancestor::div[contains(@class,"resume-card")][1]');
    }
    if ((await container.count()) === 0) {
      container = detailsBtn.locator('xpath=ancestor::div[1]');
    }

    const containerText = ((await container.first().textContent()) || '').trim();
    const matches = [...containerText.matchAll(/(\d+)\s*分/g)].map((x) => x[1]);
    if (matches.length === 0) {
      throw new Error(`人才库条目未找到有效分数字样，内容片段: ${containerText.slice(0, 200) || '(empty)'}`);
    }
    const listScore = matches.map((x) => parseInt(x, 10)).sort((a, b) => b - a)[0].toString();

    await page.screenshot({ path: '/tmp/librarypool-verified.png', fullPage: true });

    await analysisBtn.click();
    await page.waitForURL(/analysis-detail\.html/, { timeout: 20000 });
    await page.waitForLoadState('networkidle');

    await page.locator('#res-score').waitFor({ state: 'visible', timeout: 20000 });
    const detailScore = (await page.locator('#res-score').textContent())?.trim() || '';
    if (!/^\d+$/.test(detailScore)) {
      throw new Error(`解析详情分数不是数字：${detailScore || '(empty)'}`);
    }
    if (detailScore !== listScore) {
      throw new Error(`解析详情分数与列表不一致：列表 ${listScore}，详情 ${detailScore}`);
    }

    const aiReportText = ((await page.locator('#ai-report').textContent()) || '').trim();
    if (aiReportText.includes('当前暂无深度分析报告')) {
      throw new Error('解析详情页仍显示“当前暂无深度分析报告”占位，未展示深度报告内容');
    }

    await page.screenshot({ path: '/tmp/analysis-detail-verified.png', fullPage: true });

    process.stdout.write(
      JSON.stringify(
        {
          ok: true,
          baseUrl,
          resumeId,
          listScore,
          detailScore,
          screenshots: ['/tmp/librarypool-verified.png', '/tmp/analysis-detail-verified.png']
        },
        null,
        2
      ) + '\n'
    );
  } finally {
    await page.close();
    await browser.close();
  }
}

main().catch((err) => {
  process.stderr.write(`UI_VERIFY_FAILED: ${err.message}\n`);
  process.exit(1);
});
