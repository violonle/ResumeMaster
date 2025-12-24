const { PromptTemplate } = require('../models');
const logger = require('../utils/logger');
const promptService = require('../services/promptService');

class PromptController {
  // Get all prompt templates
  async list(req, res) {
    try {
      const templates = await PromptTemplate.findAll({
        order: [['category', 'ASC'], ['key', 'ASC']]
      });
      res.json({ success: true, data: templates });
    } catch (error) {
      logger.error('Failed to list prompt templates:', error);
      res.status(500).json({ success: false, error: '获取提示词模板失败' });
    }
  }

  // Get a single template
  async get(req, res) {
    try {
      const { key } = req.params;
      const template = await PromptTemplate.findOne({ where: { key } });
      if (!template) {
        return res.status(404).json({ success: false, error: '模板不存在' });
      }
      res.json({ success: true, data: template });
    } catch (error) {
      logger.error('Failed to get prompt template:', error);
      res.status(500).json({ success: false, error: '获取提示词模板失败' });
    }
  }

  // Update a template
  async update(req, res) {
    try {
      const { key } = req.params;
      const { content, name, description, is_active } = req.body;
      
      const template = await PromptTemplate.findOne({ where: { key } });
      if (!template) {
        return res.status(404).json({ success: false, error: '模板不存在' });
      }

      await template.update({
        content: content !== undefined ? content : template.content,
        name: name !== undefined ? name : template.name,
        description: description !== undefined ? description : template.description,
        is_active: is_active !== undefined ? is_active : template.is_active,
        version: template.version + 1
      });

      // Invalidate cache
      promptService.lastCacheTime = 0;

      res.json({ success: true, data: template });
    } catch (error) {
      logger.error('Failed to update prompt template:', error);
      res.status(500).json({ success: false, error: '更新提示词模板失败' });
    }
  }

  // Create a template (optional, mostly for admin to add new ones if needed)
  async create(req, res) {
    try {
      const { key, name, content, variables, category, description } = req.body;
      
      if (!key || !name || !content) {
        return res.status(400).json({ success: false, error: '关键参数不能为空' });
      }

      const exists = await PromptTemplate.findOne({ where: { key } });
      if (exists) {
        return res.status(400).json({ success: false, error: '模板Key已存在' });
      }

      const template = await PromptTemplate.create({
        key, name, content, variables, category, description
      });

      // Invalidate cache
      promptService.lastCacheTime = 0;

      res.json({ success: true, data: template });
    } catch (error) {
      logger.error('Failed to create prompt template:', error);
      res.status(500).json({ success: false, error: '创建提示词模板失败' });
    }
  }
  
  // Reset to default
  async reset(req, res) {
    try {
        // This would require storing the "original" default somewhere permanent or hardcoded.
        // For now, we can just say "Delete custom and re-seed" or "Update content to match hardcoded default".
        // Since promptService has hardcoded defaults, we can use those.
        const { key } = req.params;
        const defaultTpl = await promptService.getTemplate(key); // This might get from DB if we don't force default
        
        // Actually promptService.getTemplate tries DB first. 
        // We need direct access to defaults.
        // But defaults are inside promptService.js and not exported directly as a property.
        // We can just skip this for now or implement if requested.
        // The user didn't explicitly ask for "Reset" button, just "Manage".
        res.status(501).json({ success: false, error: '暂不支持重置功能' });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
  }
}

module.exports = new PromptController();