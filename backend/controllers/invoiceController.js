const invoiceService = require('../services/invoiceService');
const { Invoice, Order, User } = require('../models');
const { Op } = require('sequelize');

class InvoiceController {
  // 创建发票
  async createInvoice(req, res) {
    try {
      const { orderId } = req.body;
      const userId = req.user.id;

      if (!orderId) {
        return res.status(400).json({
          success: false,
          error: '订单ID不能为空'
        });
      }

      // 验证订单是否属于当前用户或其公司
      const order = await Order.findOne({
        where: { 
          id: orderId,
          [Op.or]: [
            { user_id: userId },
            req.user.company_id ? { company_id: req.user.company_id } : null
          ].filter(Boolean)
        }
      });

      if (!order) {
        return res.status(404).json({
          success: false,
          error: '订单不存在'
        });
      }

      if (order.status !== 'paid') {
        return res.status(400).json({
          success: false,
          error: '订单未支付，无法创建发票'
        });
      }

      const invoice = await invoiceService.createInvoice(orderId, userId);

      res.json({ success: true, data: invoice });
    } catch (error) {
      console.error('创建发票失败:', error);
      res.status(500).json({
        success: false,
        error: error.message || '创建发票失败'
      });
    }
  }

  // 获取所有发票列表（管理员或公司管理员）
  async getAllInvoices(req, res) {
    try {
      const { page = 1, pageSize = 10, status, search } = req.query;

      const where = {};
      
      // 多租户隔离：普通用户只能看自己的，公司管理员看全公司的，超级管理员看全部
      if (req.user.role !== 'admin') {
        if (req.user.company_id) {
          where.company_id = req.user.company_id;
        } else {
          where.userId = req.user.id;
        }
      }

      if (status) where.status = status;
      if (search) {
        where[Op.or] = [
          { invoiceNo: { [Op.like]: `%${search}%` } },
          { buyerName: { [Op.like]: `%${search}%` } }
        ];
      }

      const invoices = await Invoice.findAndCountAll({
        where,
        include: [{ model: User, attributes: ['username', 'email'] }],
        order: [['created_at', 'DESC']],
        limit: parseInt(pageSize),
        offset: (parseInt(page) - 1) * parseInt(pageSize)
      });

      res.json({
        success: true,
        data: {
          items: invoices.rows,
          total: invoices.count,
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          totalPages: Math.ceil(invoices.count / parseInt(pageSize))
        }
      });
    } catch (error) {
      console.error('获取所有发票列表失败:', error);
      res.status(500).json({ success: false, error: '获取发票列表失败' });
    }
  }

  // 获取用户发票列表
  async getUserInvoices(req, res) {
    try {
      const userId = req.user.id;
      const companyId = req.user.company_id;
      const { page = 1, pageSize = 10 } = req.query;

      // 如果有公司ID，则按公司ID获取，否则按用户ID获取
      const result = await invoiceService.getUserInvoices(companyId || userId, page, pageSize, !!companyId);

      res.json({ success: true, data: result });
    } catch (error) {
      console.error('获取用户发票列表失败:', error);
      res.status(500).json({
        success: false,
        error: '获取发票列表失败'
      });
    }
  }

  // 获取发票详情
  async getInvoiceDetails(req, res) {
    try {
      const { invoiceId } = req.params;
      const userId = req.user.id;

      const invoice = await invoiceService.getInvoiceDetails(invoiceId, userId);

      res.json({ success: true, data: invoice });
    } catch (error) {
      console.error('获取发票详情失败:', error);
      res.status(404).json({
        success: false,
        error: error.message || '发票不存在'
      });
    }
  }

  // 下载发票PDF
  async downloadInvoice(req, res) {
    try {
      const { invoiceId } = req.params;
      const userId = req.user.id;

      const result = await invoiceService.generateInvoicePDF(invoiceId, userId);

      if (result.success) {
        // 这里可以生成实际的PDF文件并返回
        // 简化处理：返回发票数据
        res.json({ success: true, data: result.data });
      } else {
        res.status(500).json({
          success: false,
          error: '生成发票PDF失败'
        });
      }
    } catch (error) {
      console.error('下载发票失败:', error);
      res.status(500).json({
        success: false,
        error: '下载发票失败'
      });
    }
  }

  // 更新发票信息
  async updateInvoice(req, res) {
    try {
      const { invoiceId } = req.params;
      const userId = req.user.id;
      const updateData = req.body;

      const invoice = await invoiceService.updateInvoice(invoiceId, userId, updateData);

      res.json({ success: true, data: invoice });
    } catch (error) {
      console.error('更新发票失败:', error);
      res.status(400).json({
        success: false,
        error: error.message || '更新发票失败'
      });
    }
  }

  // 申请红字发票
  async applyRedInvoice(req, res) {
    try {
      const { invoiceId } = req.params;
      const userId = req.user.id;
      const { reason } = req.body;

      if (!reason) {
        return res.status(400).json({
          success: false,
          error: '申请原因不能为空'
        });
      }

      const redInvoice = await invoiceService.applyRedInvoice(invoiceId, userId, reason);

      res.json({
        success: true,
        data: {
          redInvoice: redInvoice,
          message: '红字发票申请成功'
        }
      });
    } catch (error) {
      console.error('申请红字发票失败:', error);
      res.status(400).json({
        success: false,
        error: error.message || '申请红字发票失败'
      });
    }
  }

  // 获取发票统计信息
  async getInvoiceStats(req, res) {
    try {
      // 如果是管理员请求统计信息且没有指定用户ID，则获取全局统计
      const isAdminRequest = req.user && req.user.role === 'admin';
      const userId = isAdminRequest ? null : req.user.id;

      const stats = await invoiceService.getInvoiceStats(userId);

      res.json({ success: true, data: stats });
    } catch (error) {
      console.error('获取发票统计信息失败:', error);
      res.status(500).json({
        success: false,
        error: '获取发票统计失败'
      });
    }
  }

  // 验证发票信息
  async validateInvoiceData(req, res) {
    try {
      const invoiceData = req.body;
      const errors = invoiceService.validateInvoiceData(invoiceData);

      if (errors.length === 0) {
        res.json({
          success: true,
          data: {
            valid: true,
            message: '发票信息验证通过'
          }
        });
      } else {
        res.json({
          success: true,
          data: {
            valid: false,
            errors: errors
          }
        });
      }
    } catch (error) {
      console.error('验证发票信息失败:', error);
      res.status(500).json({
        success: false,
        error: '验证发票信息失败'
      });
    }
  }

  // 获取可开票订单
  async getInvoiceableOrders(req, res) {
    try {
      const userId = req.user.id;
      const companyId = req.user.company_id;

      const orders = await Order.findAll({
        where: {
          [Op.or]: [
            { user_id: userId },
            companyId ? { company_id: companyId } : null
          ].filter(Boolean),
          status: 'paid'
        },
        include: [{
          model: Invoice,
          required: false
        }],
        order: [['paid_at', 'DESC']]
      });

      // 过滤出没有发票的订单
      const invoiceableOrders = orders.filter(order => !order.Invoices || order.Invoices.length === 0);

      res.json({
        success: true,
        data: {
          orders: invoiceableOrders,
          total: invoiceableOrders.length
        }
      });
    } catch (error) {
      console.error('获取可开票订单失败:', error);
      res.status(500).json({
        success: false,
        error: '获取可开票订单失败'
      });
    }
  }
}

module.exports = new InvoiceController();