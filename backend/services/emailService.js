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
            fromName: "争湃·简历大师"
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
