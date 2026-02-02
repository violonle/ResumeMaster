const { Invoice, Order, User } = require('../models');
const moment = require('moment');
const crypto = require('crypto');

class InvoiceService {
  // 生成发票号
  generateInvoiceNo() {
    const date = moment().format('YYYYMMDD');
    const random = Math.random().toString(36).substr(2, 6).toUpperCase();
    return `INV${date}${random}`;
  }

  // 创建发票
  async createInvoice(orderId, userId) {
    try {
      // 获取订单信息
      const order = await Order.findOne({
        where: { id: orderId, user_id: userId },
        include: [{
          model: User,
          attributes: ['id', 'email', 'company_name', 'tax_number']
        }]
      });

      if (!order) {
        throw new Error('订单不存在');
      }

      if (order.status !== 'paid') {
        throw new Error('订单未支付，无法生成发票');
      }

      // 检查是否已存在发票
      const existingInvoice = await Invoice.findOne({
        where: { orderId }
      });

      if (existingInvoice) {
        return existingInvoice;
      }

      // 创建发票
      const invoice = await Invoice.create({
        invoiceNo: this.generateInvoiceNo(),
        orderId,
        userId,
        amount: order.amount,
        taxAmount: order.amount * 0.06, // 6%税率
        totalAmount: order.amount * 1.06,
        planType: order.plan,
        paymentMethod: order.provider,
        transactionId: order.transaction_id,
        status: 'issued',
        issuedAt: new Date(),
        buyerName: order.User.company_name || order.User.email,
        buyerTaxNumber: null, // User模型中没有这个字段
        invoiceDate: moment().format('YYYY-MM-DD'),
        serviceDescription: `SuperResumeMaster ${order.plan}会员服务`,
        servicePeriod: this.getServicePeriod(order.plan)
      });

      return invoice;
    } catch (error) {
      console.error('创建发票失败:', error);
      throw error;
    }
  }

  // 获取服务期限
  getServicePeriod(planType) {
    if (planType === 'monthly') {
      return moment().add(1, 'month').format('YYYY-MM-DD');
    } else if (planType === 'yearly') {
      return moment().add(1, 'year').format('YYYY-MM-DD');
    }
    return moment().add(1, 'month').format('YYYY-MM-DD');
  }

  // 获取用户发票列表
  async getUserInvoices(userId, page = 1, pageSize = 10) {
    try {
      const invoices = await Invoice.findAndCountAll({
        where: { userId },
        include: [{
          model: Order,
          attributes: ['out_trade_no', 'created_at']
        }],
        order: [['createdAt', 'DESC']],
        limit: parseInt(pageSize),
        offset: (parseInt(page) - 1) * parseInt(pageSize)
      });

      return {
        invoices: invoices.rows,
        total: invoices.count,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        totalPages: Math.ceil(invoices.count / parseInt(pageSize))
      };
    } catch (error) {
      console.error('获取用户发票列表失败:', error);
      throw error;
    }
  }

  // 获取发票详情
  async getInvoiceDetails(invoiceId, userId) {
    try {
      const invoice = await Invoice.findOne({
        where: { id: invoiceId, userId },
        include: [{
          model: Order,
          attributes: ['out_trade_no', 'createdAt', 'paid_at']
        }]
      });

      if (!invoice) {
        throw new Error('发票不存在');
      }

      return invoice;
    } catch (error) {
      console.error('获取发票详情失败:', error);
      throw error;
    }
  }

  // 下载发票PDF
  async generateInvoicePDF(invoiceId, userId) {
    try {
      const invoice = await this.getInvoiceDetails(invoiceId, userId);
      
      // 这里可以集成PDF生成库，如pdfkit、puppeteer等
      // 简化处理：返回发票数据，前端负责生成PDF
      return {
        success: true,
        data: {
          invoice: invoice,
          pdfUrl: `/api/invoices/${invoiceId}/download`
        }
      };
    } catch (error) {
      console.error('生成发票PDF失败:', error);
      throw error;
    }
  }

  // 更新发票信息
  async updateInvoice(invoiceId, userId, updateData) {
    try {
      const invoice = await Invoice.findOne({
        where: { id: invoiceId, userId }
      });

      if (!invoice) {
        throw new Error('发票不存在');
      }

      if (invoice.status !== 'issued') {
        throw new Error('只能修改已开具的发票');
      }

      const allowedFields = ['buyerName', 'buyerTaxNumber', 'buyerAddress', 'buyerPhone', 'buyerBank'];
      const updateFields = {};

      allowedFields.forEach(field => {
        if (updateData[field]) {
          updateFields[field] = updateData[field];
        }
      });

      if (Object.keys(updateFields).length === 0) {
        throw new Error('没有可更新的字段');
      }

      await invoice.update(updateFields);

      return invoice;
    } catch (error) {
      console.error('更新发票失败:', error);
      throw error;
    }
  }

  // 申请红字发票（作废或冲红）
  async applyRedInvoice(invoiceId, userId, reason) {
    try {
      const invoice = await Invoice.findOne({
        where: { id: invoiceId, userId }
      });

      if (!invoice) {
        throw new Error('发票不存在');
      }

      if (invoice.status !== 'issued') {
        throw new Error('只能对已开具的发票申请红字发票');
      }

      // 创建红字发票记录
      const redInvoice = await Invoice.create({
        invoiceNo: `RED${this.generateInvoiceNo()}`,
        orderId: invoice.orderId,
        userId,
        amount: -invoice.amount,
        taxAmount: -invoice.taxAmount,
        totalAmount: -invoice.totalAmount,
        planType: invoice.planType,
        paymentMethod: invoice.paymentMethod,
        transactionId: invoice.transactionId,
        status: 'red_issued',
        issuedAt: new Date(),
        buyerName: invoice.buyerName,
        buyerTaxNumber: invoice.buyerTaxNumber,
        invoiceDate: moment().format('YYYY-MM-DD'),
        serviceDescription: `红字发票：${invoice.serviceDescription}`,
        servicePeriod: invoice.servicePeriod,
        originalInvoiceId: invoiceId,
        redReason: reason
      });

      // 更新原发票状态
      invoice.status = 'red_reversed';
      invoice.redInvoiceId = redInvoice.id;
      await invoice.save();

      return redInvoice;
    } catch (error) {
      console.error('申请红字发票失败:', error);
      throw error;
    }
  }

  // 获取发票统计信息
  async getInvoiceStats(userId = null) {
    try {
      const where = userId ? { userId } : {};
      const stats = await Invoice.findAll({
        where,
        attributes: [
          'status',
          [require('sequelize').fn('COUNT', '*'), 'count'],
          [require('sequelize').fn('SUM', require('sequelize').col('totalAmount')), 'totalAmount']
        ],
        group: ['status']
      });

      const totalInvoices = await Invoice.count({
        where
      });

      const totalAmount = await Invoice.sum('totalAmount', {
        where
      });

      return {
        totalInvoices,
        totalAmount: totalAmount || 0,
        statusBreakdown: stats.map(stat => ({
          status: stat.status,
          count: parseInt(stat.dataValues.count),
          amount: parseFloat(stat.dataValues.totalAmount) || 0
        }))
      };
    } catch (error) {
      console.error('获取发票统计信息失败:', error);
      throw error;
    }
  }

  // 验证发票信息
  validateInvoiceData(invoiceData) {
    const errors = [];

    if (!invoiceData.buyerName || invoiceData.buyerName.trim().length === 0) {
      errors.push('购买方名称不能为空');
    }

    if (invoiceData.buyerTaxNumber && !this.validateTaxNumber(invoiceData.buyerTaxNumber)) {
      errors.push('纳税人识别号格式不正确');
    }

    if (invoiceData.amount <= 0) {
      errors.push('发票金额必须大于0');
    }

    return errors;
  }

  // 验证纳税人识别号
  validateTaxNumber(taxNumber) {
    // 简化的税号验证，实际应该根据国家标准进行验证
    const taxNumberRegex = /^[A-Z0-9]{15,20}$/;
    return taxNumberRegex.test(taxNumber);
  }

  // 生成电子发票二维码内容
  generateInvoiceQRCode(invoice) {
    const qrData = {
      fpdm: '发票代码', // 需要接入税务系统获取
      fphm: invoice.invoiceNo,
      kprq: invoice.invoiceDate,
      je: invoice.totalAmount.toFixed(2),
      jym: this.generateCheckCode(invoice) // 校验码
    };

    return JSON.stringify(qrData);
  }

  // 生成校验码
  generateCheckCode(invoice) {
    const data = `${invoice.invoiceNo}${invoice.invoiceDate}${invoice.totalAmount}`;
    return crypto.createHash('md5').update(data).digest('hex').substr(0, 6).toUpperCase();
  }
}

module.exports = new InvoiceService();