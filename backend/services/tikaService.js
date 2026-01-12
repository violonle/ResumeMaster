const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const util = require('util');
const execPromise = util.promisify(exec);

/**
 * Apache Tika 服务封装 (本地 JAR 版)
 * 用于高效解析 PDF, DOCX, DOC, MD 等多种格式文件
 */
class TikaService {
    constructor() {
        // JAR 包路径：优先检查环境变量，否则使用相对路径
        // 在 Docker 环境中，我们将其放在 backend/docparser/docparser.jar
        this.jarPath = process.env.TIKA_JAR_PATH || path.join(__dirname, '../docparser/docparser.jar');
    }

    /**
     * 从文件中提取文本内容
     * @param {string} filePath 文件绝对路径
     * @returns {Promise<string>} 提取出的纯文本内容
     */
    async extractText(filePath) {
        try {
            if (!fs.existsSync(filePath)) {
                throw new Error(`文件不存在: ${filePath}`);
            }

            if (!fs.existsSync(this.jarPath)) {
                console.error(`[TikaService] JAR 包不存在: ${this.jarPath}，请确保已运行 mvn package`);
                throw new Error('Tika 解析组件未就绪');
            }

            // 调用 Java JAR 包进行解析
            // 使用 maxBuffer 防止大文件解析导致输出溢出 (设置 10MB)
            const { stdout, stderr } = await execPromise(`java -jar "${this.jarPath}" "${filePath}"`, {
                maxBuffer: 10 * 1024 * 1024 
            });

            if (stderr && stderr.trim()) {
                // 有些日志输出在 stderr，如果不影响 stdout 则忽略
                if (!stdout || stdout.trim().length === 0) {
                    console.warn('[TikaService] 解析过程中有错误输出:', stderr);
                }
            }

            return stdout || '';
        } catch (error) {
            console.error('[TikaService] 文本提取出错:', error.message);
            throw error;
        }
    }

    /**
     * 检查 Tika 服务是否可用
     */
    async isAvailable() {
        try {
            const { stdout } = await execPromise('java -version');
            return fs.existsSync(this.jarPath);
        } catch (error) {
            return false;
        }
    }
}

module.exports = new TikaService();
