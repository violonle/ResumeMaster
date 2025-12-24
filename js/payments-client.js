class PaymentsClient {
  constructor() {
    this.baseUrl = '/api/payment';
    this.userAuth = new UserAuth();
  }

  async createOrder(plan, provider, amount) {
    const user = this.userAuth.getCurrentUser();
    if (!user) throw new Error('用户未登录');

    const token = this.userAuth.getToken();
    const res = await fetch(`${this.baseUrl}/create-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
      },
      body: JSON.stringify({
        userId: user.id,
        planType: plan,
        paymentMethod: provider,
        amount: amount
      })
    });
    const result = await res.json();
    if (!res.ok || !result.success) {
      throw new Error(result?.error?.message || result?.error || '创建订单失败');
    }
    return result.data;
  }

  async getOrderStatus(outTradeNo, paymentMethod) {
    const token = this.userAuth.getToken();
    const res = await fetch(`${this.baseUrl}/query-status/${encodeURIComponent(outTradeNo)}/${encodeURIComponent(paymentMethod)}`, {
      headers: {
        'Authorization': token ? `Bearer ${token}` : ''
      }
    });
    const result = await res.json();
    if (!res.ok || !result.success) {
      throw new Error(result?.error?.message || '查询订单状态失败');
    }
    return result.data;
  }

  async simulatePay(outTradeNo) {
    const token = this.userAuth.getToken();
    const res = await fetch(`${this.baseUrl}/simulate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
      },
      body: JSON.stringify({ outTradeNo })
    });
    const result = await res.json();
    if (!res.ok || !result.success) {
      throw new Error(result?.error?.message || '模拟支付失败');
    }
    return result.data;
  }
}

// 导出到全局
window.PaymentsClient = PaymentsClient;