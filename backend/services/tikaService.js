const axios = require('axios');
const fs = require('fs');

/**
 * Apache Tika 服务封装
 * 用于高效解析 PDF, DOCX, DOC, MD 等多种格式文件
 */
class TikaService {
    constructor() {
        // 默认 Tika Server 地址，生产环境通过环境变量配置
        this.baseUrl = process.env.TIKA_SERVER_URL || 'http://localhost:9998';
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

            const fileStream = fs.createReadStream(filePath);
            
            // 使用 Tika 的 /tika 接口获取纯文本内容
            const response = await axios({
                method: 'put',
                url: `${this.baseUrl}/tika`,
                data: fileStream,
                headers: {
                    'Accept': 'text/plain',
                    'Content-Type': 'application/octet-stream'
                },
                // 设置较长的超时时间，处理大文件解析
                timeout: 30000 
            });

            if (response.status === 200) {
                return response.data;
            } else {
                throw new Error(`Tika 解析失败，状态码: ${response.status}`);
            }
        } catch (error) {
            console.error('[TikaService] 文本提取出错:', error.message);
            // 如果是因为 Tika Server 没启动，可以记录详细错误
            if (error.code === 'ECONNREFUSED') {
                console.error('[TikaService] 无法连接到 Tika Server，请检查服务是否启动。');
            }
            throw error;
        }
    }

    /**
     * 获取文件元数据 (可选)
     * @param {string} filePath 
     */
    async getMetadata(filePath) {
        try {
            const fileStream = fs.createReadStream(filePath);
            const response = await axios({
                method: 'put',
                url: `${this.baseUrl}/meta`,
                data: fileStream,
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/octet-stream'
                }
            });
            return response.data;
        } catch (error) {
            console.error('[TikaService] 获取元数据出错:', error.message);
            return null;
        }
    }

    /**
     * 检查 Tika 服务是否可用
     */
    async isAvailable() {
        try {
            const response = await axios.get(`${this.baseUrl}/tika`, { timeout: 2000 });
            return response.status === 200 || response.status === 405; // 405 是因为 GET 不被允许，但说明服务在运行
        } catch (error) {
            return false;
        }
    }
}

module.exports = new TikaService();
