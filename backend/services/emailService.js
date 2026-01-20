const nodemailer = require('nodemailer');
const logger = require('../utils/logger');
const { sequelize } = require('../models');
const { Op } = require('sequelize');

/**
 * 邮件发送服务
 */
class EmailService {
    constructor() {
        this.transporter = null;
    }

    _renderTemplate(template, data = {}) {
        if (!template) return '';
        const str = String(template);
        return str.replace(/(\{\{\s*([\w.]+)\s*\}\}|\$\{\s*([\w.]+)\s*\})/g, (_m, _all, k1, k2) => {
            const key = k1 || k2;
            if (!key) return '';
            const parts = String(key).split('.');
            let cur = data;
            for (const p of parts) {
                if (cur && Object.prototype.hasOwnProperty.call(cur, p)) cur = cur[p];
                else return '';
            }
            if (cur === null || cur === undefined) return '';
            return String(cur);
        });
    }

    _mergeEmailSettings(base, incoming) {
        const b = base || {};
        const i = incoming || {};
        return {
            ...b,
            ...i,
            scenarios: {
                ...(b.scenarios || {}),
                ...(i.scenarios || {}),
            },
        };
    }

    async getSettings() {
        const defaultCfg = {
            host: process.env.SMTP_HOST || 'smtp.qq.com',
            port: parseInt(process.env.SMTP_PORT || '465'),
            secure: process.env.SMTP_SECURE !== 'false',
            user: process.env.SMTP_USER || '',
            pass: process.env.SMTP_PASS || '',
            fromName: '争湃·简历大师',
            enabled: false,
            siteName: '',
            scenarios: {
                interview: {
                    subject: '【面试邀请】{{type}}安排 - {{siteName}}',
                    html: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif; max-width: 640px; margin: 0 auto; padding: 24px; color: #0f172a;">
  <div style="padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
    <div style="font-size: 20px; font-weight: 700; color: #2563eb; margin-bottom: 12px;">面试邀请</div>
    <div style="font-size: 14px; line-height: 1.7; margin-bottom: 16px;">
      <div><strong>{{name}}</strong> 您好：</div>
      <div>我们已为您安排了 <strong>{{type}}</strong>，具体信息如下：</div>
    </div>

    <div style="background: #f8fafc; padding: 14px 16px; border-radius: 10px; font-size: 14px; line-height: 1.8;">
      <div><strong>时间/截止时间：</strong>{{time}}</div>
      <div><strong>面试地点：</strong>{{location}}</div>
      <div><strong>面试链接：</strong><a href="{{link}}" style="color: #2563eb; word-break: break-all; text-decoration: none;">{{link}}</a></div>
      <div><strong>面试题量：</strong>{{aiQuestionCount}} 题</div>
    </div>

    <div style="text-align: center; margin: 22px 0 12px;">
      <a href="{{link}}" style="display: inline-block; background: #2563eb; color: #ffffff; padding: 12px 18px; border-radius: 10px; text-decoration: none; font-weight: 700;">立即开始面试</a>
    </div>
    <div style="font-size: 12px; color: #64748b; line-height: 1.7;">
      如按钮无法点击，请复制链接到浏览器打开：<span style="word-break: break-all;">{{link}}</span>
    </div>

    <div style="margin-top: 18px; font-size: 14px; line-height: 1.7;">祝您面试顺利！</div>

    <div style="border-top: 1px solid #e2e8f0; margin: 20px 0 0; padding-top: 12px; font-size: 12px; color: #94a3b8; text-align: center;">
      此邮件由 {{siteName}} 系统自动发送，请勿直接回复。
    </div>
  </div>
</div>`,
                    text: `面试邀请

{{name}} 您好：

我们已为您安排了 {{type}}，具体信息如下：
- 时间/截止时间：{{time}}
- 面试地点：{{location}}
- 面试链接：{{link}}
- 面试题量：{{aiQuestionCount}} 题

如无法打开链接，请复制到浏览器访问：{{link}}

祝您面试顺利！

此邮件由 {{siteName}} 系统自动发送，请勿直接回复。`,
                },
                offer: {
                    subject: '【Offer通知】{{company}} - {{siteName}}',
                    html: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif; max-width: 640px; margin: 0 auto; padding: 24px; color: #0f172a;">
  <div style="padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
    <div style="font-size: 20px; font-weight: 700; color: #16a34a; margin-bottom: 12px;">Offer 通知</div>
    <div style="font-size: 14px; line-height: 1.7; margin-bottom: 16px;">
      <div><strong>{{name}}</strong> 您好：</div>
      <div>恭喜您！{{company}} 已向您发出 Offer。</div>
    </div>

    <div style="background: #f8fafc; padding: 14px 16px; border-radius: 10px; font-size: 14px; line-height: 1.8;">
      <div><strong>公司：</strong>{{company}}</div>
      <div><strong>截止日期：</strong>{{time}}</div>
    </div>

    <div style="margin-top: 16px; background: #f8fafc; padding: 14px 16px; border-radius: 10px;">
      <div style="font-size: 14px; font-weight: 700; margin-bottom: 8px;">附加说明</div>
      <div style="white-space: pre-wrap; font-size: 14px; line-height: 1.8; color: #334155;">{{message}}</div>
    </div>

    <div style="margin-top: 18px; font-size: 14px; line-height: 1.7;">期待您的回复！</div>

    <div style="border-top: 1px solid #e2e8f0; margin: 20px 0 0; padding-top: 12px; font-size: 12px; color: #94a3b8; text-align: center;">
      此邮件由 {{siteName}} 系统自动发送，请勿直接回复。
    </div>
  </div>
</div>`,
                    text: `Offer 通知

{{name}} 您好：

恭喜您！{{company}} 已向您发出 Offer。

- 公司：{{company}}
- 截止日期：{{time}}

附加说明：
{{message}}

期待您的回复！

此邮件由 {{siteName}} 系统自动发送，请勿直接回复。`,
                },
            },
        };

        try {
            const SystemConfig = sequelize.models.SystemConfig;
            if (!SystemConfig) return defaultCfg;

            const rows = await SystemConfig.findAll({
                where: {
                    key: {
                        [Op.in]: ['email', 'settings'],
                    },
                },
            });

            let emailVal = null;
            let settingsVal = null;
            for (const r of rows) {
                if (r.key === 'email') emailVal = r.value;
                if (r.key === 'settings') settingsVal = r.value;
            }

            let merged = defaultCfg;
            if (emailVal) {
                try {
                    const v = typeof emailVal === 'string' ? JSON.parse(emailVal) : emailVal;
                    merged = this._mergeEmailSettings(merged, v);
                } catch (_) {}
            }

            if (settingsVal) {
                try {
                    const v = typeof settingsVal === 'string' ? JSON.parse(settingsVal) : settingsVal;
                    if (v && v.siteName) merged.siteName = String(v.siteName);
                } catch (_) {}
            }

            if (!merged.siteName) merged.siteName = merged.fromName || '争湃·简历大师';

            if (merged.port) merged.port = parseInt(merged.port);
            if (merged.secure !== undefined) merged.secure = merged.secure === true || merged.secure === 'true';
            if (merged.enabled !== undefined) merged.enabled = merged.enabled === true || merged.enabled === 'true';

            return merged;
        } catch (error) {
            logger.error(`获取邮件设置失败: ${error.message}`);
            return defaultCfg;
        }
    }

    /**
     * 获取邮件配置 (优先从数据库获取，其次从环境变量获取)
     */
    async getConfig() {
        const cfg = {
            host: process.env.SMTP_HOST || 'smtp.qq.com',
            port: parseInt(process.env.SMTP_PORT || '465'),
            secure: process.env.SMTP_SECURE !== 'false',
            user: process.env.SMTP_USER || '',
            pass: process.env.SMTP_PASS || '',
            fromName: "争湃·简历大师",
            enabled: false
        };

        try {
            const SystemConfig = sequelize.models.SystemConfig;
            if (SystemConfig) {
                // 1. 尝试读取聚合的 'email' 配置
                const emailCfg = await SystemConfig.findOne({ where: { key: 'email' } });
                if (emailCfg && emailCfg.value) {
                    try {
                        const v = typeof emailCfg.value === 'string' ? JSON.parse(emailCfg.value) : emailCfg.value;
                        if (v.host) cfg.host = v.host;
                        if (v.port) cfg.port = parseInt(v.port);
                        if (v.secure !== undefined) cfg.secure = v.secure === true || v.secure === 'true';
                        if (v.user) cfg.user = v.user;
                        if (v.pass) cfg.pass = v.pass;
                        if (v.fromName) cfg.fromName = v.fromName;
                        if (v.enabled !== undefined) cfg.enabled = v.enabled === true || v.enabled === 'true';
                    } catch (e) {}
                }

                // 2. 尝试读取单个 key (email.host, email.port 等)
                const rows = await SystemConfig.findAll({
                    where: {
                        key: {
                            [Op.in]: ['email.host', 'email.port', 'email.secure', 'email.user', 'email.pass', 'email.fromName', 'settings']
                        }
                    }
                });

                for (const r of rows) {
                    const val = typeof r.value === 'string' ? r.value.trim() : r.value;
                    if (!val) continue;

                    if (r.key === 'email.host') cfg.host = val;
                    if (r.key === 'email.port') cfg.port = parseInt(val);
                    if (r.key === 'email.secure') cfg.secure = val === 'true' || val === true;
                    if (r.key === 'email.user') cfg.user = val;
                    if (r.key === 'email.pass') cfg.pass = val;
                    if (r.key === 'email.fromName') cfg.fromName = val;
                    
                    if (r.key === 'settings') {
                        try {
                            const v = typeof r.value === 'string' ? JSON.parse(r.value) : r.value;
                            if (v.siteName) cfg.fromName = v.siteName;
                            
                            // 同时也尝试从 settings 对象中读取邮件配置 (如果 UI 是这样保存的)
                            if (v.emailHost || v.smtpHost) cfg.host = v.emailHost || v.smtpHost;
                            if (v.emailPort || v.smtpPort) cfg.port = parseInt(v.emailPort || v.smtpPort);
                            if (v.emailUser || v.smtpUser) cfg.user = v.emailUser || v.smtpUser;
                            if (v.emailPass || v.smtpPass) cfg.pass = v.emailPass || v.smtpPass;
                            if (v.emailSecure !== undefined) cfg.secure = v.emailSecure === true || v.emailSecure === 'true';
                            if (v.emailFromName) cfg.fromName = v.emailFromName;
                        } catch (e) {}
                    }
                }
            }
        } catch (error) {
            logger.error(`获取邮件配置失败: ${error.message}`);
        }

        return cfg;
    }

    /**
     * 获取或创建 Transporter
     */
    async getTransporter() {
        const cfg = await this.getConfig();
        
        // 如果配置不完整，记录警告
        if (cfg.enabled !== true) {
            return null;
        }
        if (!cfg.user || !cfg.pass) {
            return null;
        }

        return nodemailer.createTransport({
            host: cfg.host,
            port: cfg.port,
            secure: cfg.secure,
            auth: {
                user: cfg.user,
                pass: cfg.pass
            }
        });
    }

    async buildScenarioMail(scenario, variables, fallback) {
        const settings = await this.getSettings();
        const sc = settings.scenarios && settings.scenarios[scenario] ? settings.scenarios[scenario] : {};
        const data = {
            ...(variables || {}),
            siteName: settings.siteName || settings.fromName || '争湃·简历大师',
        };

        const fallbackSubject = fallback && fallback.subject ? String(fallback.subject) : '';
        const fallbackHtml = fallback && fallback.html ? String(fallback.html) : '';
        const fallbackText = fallback && fallback.text ? String(fallback.text) : '';

        const subject = this._renderTemplate(sc.subject, data) || this._renderTemplate(fallbackSubject, data);
        const html = (sc.html && String(sc.html).trim())
            ? this._renderTemplate(sc.html, data)
            : this._renderTemplate(fallbackHtml, data);
        const text = (sc.text && String(sc.text).trim())
            ? this._renderTemplate(sc.text, data)
            : (fallbackText ? this._renderTemplate(fallbackText, data) : '');

        return { to: '', subject, html, text };
    }

    /**
     * 发送邮件
     * @param {string} to 收件人
     * @param {string} subject 主题
     * @param {string} html 内容 (HTML格式)
     * @param {string} text 内容 (纯文本格式)
     */
    async sendMail(to, subject, html, text) {
        try {
            const cfg = await this.getConfig();
            const transporter = await this.getTransporter();

            if (!transporter) {
                logger.warn('SMTP 未配置，邮件发送已跳过。请在后台管理系统或 .env 中配置 SMTP 信息');
                return { success: false, error: 'SMTP_NOT_CONFIGURED' };
            }

            const info = await transporter.sendMail({
                from: `"${cfg.fromName}" <${cfg.user}>`,
                to,
                subject,
                text: text || '',
                html: html || ''
            });

            logger.info(`邮件已发送: ${info.messageId}`);
            return { success: true, messageId: info.messageId };
        } catch (error) {
            logger.error(`邮件发送失败: ${error.message}`);
            return { success: false, error: error.message };
        }
    }
}

module.exports = new EmailService();
