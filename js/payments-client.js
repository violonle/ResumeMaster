class PaymentsClient {
  constructor() {
    this.baseUrl = '/api/payment';
    this.userAuth = new UserAuth();
  }

  async createOrder(plan, provider, amount) {
    const user = this.userAuth.getCurrentUser();
    if (!user) throw new Error('用户未登录');

    const result = await window.resumeDataManager.apiRequest('/payment/create-order', 'POST', {
        userId: user.id,
        planType: plan,
        paymentMethod: provider,
        amount: amount
    }, false);
    return result.data;
  }

  async getOrderStatus(outTradeNo, paymentMethod) {
    const result = await window.resumeDataManager.apiRequest(`/payment/query-status/${encodeURIComponent(outTradeNo)}/${encodeURIComponent(paymentMethod)}`, 'GET', null, false);
    return result.data;
  }

  async simulatePay(outTradeNo) {
    const result = await window.resumeDataManager.apiRequest('/payment/simulate', 'POST', { outTradeNo }, false);
    return result.data;
  }
}

// 导出到全局
window.PaymentsClient = PaymentsClient;