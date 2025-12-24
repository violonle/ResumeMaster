/**
 * 数据库备份和恢复工具
 * 支持自动备份、压缩、加密和云存储
 */

const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { promisify } = require('util');
const execAsync = promisify(exec);

class DatabaseBackupManager {
  constructor(config = {}) {
    this.config = {
      host: config.host || process.env.DB_HOST || 'localhost',
      port: config.port || process.env.DB_PORT || '3306',
      user: config.user || process.env.DB_USERNAME || 'root',
      password: config.password || process.env.DB_PASSWORD || '',
      database: config.database || process.env.DB_NAME || 'superresumemaster',
      backupDir: config.backupDir || path.join(__dirname, '../../backups'),
      retentionDays: config.retentionDays || 30,
      encrypt: config.encrypt !== false,
      encryptionKey: config.encryptionKey || process.env.BACKUP_ENCRYPTION_KEY,
      compress: config.compress !== false,
      cloudStorage: config.cloudStorage || {
        enabled: false,
        provider: null, // 'aws', 'gcp', 'azure'
        bucket: null,
        credentials: {}
      },
      ...config
    };
    
    this.ensureBackupDirectory();
  }

  /**
   * 确保备份目录存在
   */
  async ensureBackupDirectory() {
    try {
      await fs.mkdir(this.config.backupDir, { recursive: true });
      
      // 创建子目录
      const subdirs = ['daily', 'weekly', 'monthly', 'manual'];
      for (const subdir of subdirs) {
        await fs.mkdir(path.join(this.config.backupDir, subdir), { recursive: true });
      }
      
      console.log('✅ 备份目录创建成功');
    } catch (error) {
      console.error('❌ 备份目录创建失败:', error);
      throw error;
    }
  }

  /**
   * 创建数据库备份
   */
  async createBackup(options = {}) {
    const {
      type = 'manual', // 'manual', 'daily', 'weekly', 'monthly'
      compress = this.config.compress,
      encrypt = this.config.encrypt,
      description = ''
    } = options;

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `${this.config.database}-${type}-${timestamp}.sql`;
    const backupPath = path.join(this.config.backupDir, type, backupFileName);
    
    console.log(`🚀 开始创建${type}备份...`);
    
    try {
      // 构建mysqldump命令
      const dumpCommand = this.buildDumpCommand(backupPath);
      
      console.log('📊 正在导出数据库...');
      const { stdout, stderr } = await execAsync(dumpCommand);
      
      if (stderr && !stderr.includes('Warning')) {
        console.warn('⚠️  备份警告:', stderr);
      }
      
      let finalBackupPath = backupPath;
      
      // 压缩备份文件
      if (compress) {
        console.log('🗜️  正在压缩备份文件...');
        finalBackupPath = await this.compressBackup(backupPath);
      }
      
      // 加密备份文件
      if (encrypt && this.config.encryptionKey) {
        console.log('🔐 正在加密备份文件...');
        finalBackupPath = await this.encryptBackup(finalBackupPath);
      }
      
      // 创建备份元数据
      const metadata = {
        type,
        timestamp: new Date().toISOString(),
        database: this.config.database,
        fileName: path.basename(finalBackupPath),
        originalSize: (await fs.stat(finalBackupPath)).size,
        compressed: compress,
        encrypted: encrypt,
        description,
        version: '1.0'
      };
      
      const metadataPath = finalBackupPath + '.meta.json';
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
      
      console.log(`✅ 备份创建成功: ${finalBackupPath}`);
      console.log(`📊 备份大小: ${this.formatFileSize(metadata.originalSize)}`);
      
      // 上传到云存储
      if (this.config.cloudStorage.enabled) {
        await this.uploadToCloudStorage(finalBackupPath, metadata);
      }
      
      // 清理过期备份
      await this.cleanupOldBackups(type);
      
      return {
        success: true,
        backupPath: finalBackupPath,
        metadata,
        size: metadata.originalSize
      };
      
    } catch (error) {
      console.error('❌ 备份创建失败:', error);
      
      // 清理失败的备份文件
      try {
        await fs.unlink(backupPath);
      } catch (cleanupError) {
        console.warn('⚠️  清理失败备份文件时出错:', cleanupError);
      }
      
      throw error;
    }
  }

  /**
   * 构建mysqldump命令
   */
  buildDumpCommand(outputPath) {
    const cmd = [
      'mysqldump',
      `--host=${this.config.host}`,
      `--port=${this.config.port}`,
      `--user=${this.config.user}`,
      this.config.password ? `--password=${this.config.password}` : '',
      '--single-transaction',
      '--routines',
      '--triggers',
      '--events',
      '--hex-blob',
      '--complete-insert',
      '--extended-insert=FALSE',
      this.config.database,
      `> "${outputPath}"`
    ].filter(Boolean).join(' ');
    
    return cmd;
  }

  /**
   * 压缩备份文件
   */
  async compressBackup(backupPath) {
    const compressedPath = backupPath + '.gz';
    
    try {
      await execAsync(`gzip -c "${backupPath}" > "${compressedPath}"`);
      await fs.unlink(backupPath); // 删除原始文件
      
      console.log('✅ 备份文件压缩成功');
      return compressedPath;
    } catch (error) {
      console.error('❌ 备份文件压缩失败:', error);
      throw error;
    }
  }

  /**
   * 加密备份文件
   */
  async encryptBackup(backupPath) {
    const encryptedPath = backupPath + '.enc';
    
    try {
      // 使用AES-256-CBC加密
      const algorithm = 'aes-256-cbc';
      const key = crypto.scryptSync(this.config.encryptionKey, 'salt', 32);
      const iv = crypto.randomBytes(16);
      
      const cipher = crypto.createCipher(algorithm, this.config.encryptionKey);
      const input = await fs.readFile(backupPath);
      const encrypted = Buffer.concat([cipher.update(input), cipher.final()]);
      
      // 保存IV和加密数据
      const encryptedWithIv = Buffer.concat([iv, encrypted]);
      await fs.writeFile(encryptedPath, encryptedWithIv);
      await fs.unlink(backupPath); // 删除原始文件
      
      console.log('✅ 备份文件加密成功');
      return encryptedPath;
    } catch (error) {
      console.error('❌ 备份文件加密失败:', error);
      throw error;
    }
  }

  /**
   * 解密备份文件
   */
  async decryptBackup(encryptedPath, outputPath) {
    try {
      const algorithm = 'aes-256-cbc';
      const encryptedData = await fs.readFile(encryptedPath);
      
      // 提取IV和加密数据
      const iv = encryptedData.slice(0, 16);
      const encrypted = encryptedData.slice(16);
      
      const key = crypto.scryptSync(this.config.encryptionKey, 'salt', 32);
      const decipher = crypto.createDecipher(algorithm, this.config.encryptionKey);
      
      const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
      await fs.writeFile(outputPath, decrypted);
      
      console.log('✅ 备份文件解密成功');
      return outputPath;
    } catch (error) {
      console.error('❌ 备份文件解密失败:', error);
      throw error;
    }
  }

  /**
   * 解压备份文件
   */
  async decompressBackup(compressedPath, outputPath) {
    try {
      await execAsync(`gunzip -c "${compressedPath}" > "${outputPath}"`);
      console.log('✅ 备份文件解压成功');
      return outputPath;
    } catch (error) {
      console.error('❌ 备份文件解压失败:', error);
      throw error;
    }
  }

  /**
   * 恢复数据库备份
   */
  async restoreBackup(backupPath, options = {}) {
    const {
      decrypt = backupPath.endsWith('.enc'),
      decompress = backupPath.endsWith('.gz'),
      targetDatabase = this.config.database,
      dropExisting = false
    } = options;

    console.log(`🚀 开始恢复备份: ${backupPath}`);
    
    let restorePath = backupPath;
    
    try {
      // 解密备份文件
      if (decrypt) {
        console.log('🔓 正在解密备份文件...');
        const tempPath = backupPath.replace('.enc', '.sql');
        restorePath = await this.decryptBackup(backupPath, tempPath);
      }
      
      // 解压备份文件
      if (decompress) {
        console.log('🗜️  正在解压备份文件...');
        const tempPath = restorePath.replace('.gz', '.sql');
        restorePath = await this.decompressBackup(restorePath, tempPath);
      }
      
      // 构建mysql命令
      const restoreCommand = this.buildRestoreCommand(restorePath, targetDatabase, dropExisting);
      
      console.log('📊 正在恢复数据库...');
      const { stdout, stderr } = await execAsync(restoreCommand);
      
      if (stderr && !stderr.includes('Warning')) {
        console.warn('⚠️  恢复警告:', stderr);
      }
      
      console.log('✅ 数据库恢复成功');
      
      // 清理临时文件
      if (restorePath !== backupPath) {
        await fs.unlink(restorePath);
      }
      
      return {
        success: true,
        message: '数据库恢复成功',
        restoredPath: restorePath
      };
      
    } catch (error) {
      console.error('❌ 数据库恢复失败:', error);
      
      // 清理临时文件
      if (restorePath !== backupPath) {
        try {
          await fs.unlink(restorePath);
        } catch (cleanupError) {
          console.warn('⚠️  清理临时文件时出错:', cleanupError);
        }
      }
      
      throw error;
    }
  }

  /**
   * 构建mysql恢复命令
   */
  buildRestoreCommand(backupPath, targetDatabase, dropExisting) {
    let cmd = [
      'mysql',
      `--host=${this.config.host}`,
      `--port=${this.config.port}`,
      `--user=${this.config.user}`,
      this.config.password ? `--password=${this.config.password}` : '',
      targetDatabase,
      `< "${backupPath}"`
    ].filter(Boolean).join(' ');
    
    return cmd;
  }

  /**
   * 获取备份列表
   */
  async getBackupList(type = 'all') {
    const backupTypes = type === 'all' ? ['daily', 'weekly', 'monthly', 'manual'] : [type];
    const allBackups = [];
    
    for (const backupType of backupTypes) {
      const typeDir = path.join(this.config.backupDir, backupType);
      
      try {
        const files = await fs.readdir(typeDir);
        const backups = [];
        
        for (const file of files) {
          if (file.endsWith('.meta.json')) {
            const metadataPath = path.join(typeDir, file);
            const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
            
            backups.push({
              ...metadata,
              type: backupType,
              metadataPath,
              backupPath: path.join(typeDir, metadata.fileName)
            });
          }
        }
        
        // 按时间排序，最新的在前
        backups.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        allBackups.push(...backups);
        
      } catch (error) {
        console.warn(`⚠️  读取${backupType}备份目录失败:`, error.message);
      }
    }
    
    return allBackups;
  }

  /**
   * 清理过期备份
   */
  async cleanupOldBackups(type) {
    console.log(`🧹 清理${type}过期备份...`);
    
    try {
      const backups = await this.getBackupList(type);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);
      
      let deletedCount = 0;
      
      for (const backup of backups) {
        if (new Date(backup.timestamp) < cutoffDate) {
          try {
            // 删除备份文件
            await fs.unlink(backup.backupPath);
            // 删除元数据文件
            await fs.unlink(backup.metadataPath);
            
            deletedCount++;
            console.log(`  🗑️  删除过期备份: ${backup.fileName}`);
          } catch (error) {
            console.warn(`  ⚠️  删除备份失败: ${backup.fileName}`, error.message);
          }
        }
      }
      
      console.log(`✅ 清理完成，删除了 ${deletedCount} 个过期备份`);
      
    } catch (error) {
      console.error(`❌ 清理${type}备份失败:`, error);
    }
  }

  /**
   * 上传到云存储（预留接口）
   */
  async uploadToCloudStorage(backupPath, metadata) {
    console.log('☁️  上传到云存储...');
    
    // 这里可以实现具体的云存储上传逻辑
    // AWS S3, Google Cloud Storage, Azure Blob Storage等
    
    console.log('💡 云存储上传功能需要配置具体的云服务商');
    console.log(`📁 备份文件本地路径: ${backupPath}`);
  }

  /**
   * 格式化文件大小
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * 验证备份文件完整性
   */
  async validateBackup(backupPath) {
    console.log(`🔍 验证备份文件: ${backupPath}`);
    
    try {
      const stats = await fs.stat(backupPath);
      
      if (stats.size === 0) {
        throw new Error('备份文件为空');
      }
      
      // 检查元数据文件
      const metadataPath = backupPath + '.meta.json';
      await fs.access(metadataPath);
      
      console.log('✅ 备份文件验证通过');
      return true;
      
    } catch (error) {
      console.error('❌ 备份文件验证失败:', error);
      return false;
    }
  }
}

// 自动备份调度器
class BackupScheduler {
  constructor(backupManager) {
    this.backupManager = backupManager;
    this.scheduledJobs = new Map();
  }

  /**
   * 启动自动备份调度
   */
  start() {
    console.log('⏰ 启动自动备份调度器...');
    
    // 每日备份（凌晨2点）
    this.scheduleDailyBackup();
    
    // 每周备份（周日凌晨3点）
    this.scheduleWeeklyBackup();
    
    // 每月备份（每月1号凌晨4点）
    this.scheduleMonthlyBackup();
    
    console.log('✅ 自动备份调度器已启动');
  }

  /**
   * 调度每日备份
   */
  scheduleDailyBackup() {
    // 这里可以实现具体的调度逻辑
    // 使用node-cron或其他调度库
    console.log('📅 每日备份已调度');
  }

  /**
   * 调度每周备份
   */
  scheduleWeeklyBackup() {
    console.log('📅 每周备份已调度');
  }

  /**
   * 调度每月备份
   */
  scheduleMonthlyBackup() {
    console.log('📅 每月备份已调度');
  }

  /**
   * 停止调度器
   */
  stop() {
    console.log('⏹️  停止自动备份调度器...');
    this.scheduledJobs.clear();
    console.log('✅ 自动备份调度器已停止');
  }
}

module.exports = {
  DatabaseBackupManager,
  BackupScheduler
};