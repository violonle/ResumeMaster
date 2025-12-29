module.exports = {
  currency: 'CNY',
  demo: process.env.PAYMENTS_DEMO === 'false' ? false : true,
  frontendBaseUrl: process.env.FRONTEND_BASE_URL || '',
  plans: {
    premium: {
      name: '高级版',
      amount: Number(process.env.PLAN_PREMIUM_AMOUNT || 99.00),
      period: process.env.PLAN_PREMIUM_PERIOD || 'monthly'
    },
    enterprise: {
      name: '企业版',
      amount: Number(process.env.PLAN_ENTERPRISE_AMOUNT || 999.00),
      period: process.env.PLAN_ENTERPRISE_PERIOD || 'monthly'
    }
  }
};