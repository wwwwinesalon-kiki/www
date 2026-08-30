export type KaihipayEvent = {
  customerId: string;
  subscriptionStatus: 'active' | 'paused' | 'cancelled';
  occurredAt: string;
};
export interface KaihipayAdapter {
  verifyWebhook(body: string, signature: string): Promise<boolean>;
  fetchSubscription(customerId: string): Promise<KaihipayEvent>;
}
export class MockKaihipayAdapter implements KaihipayAdapter {
  async verifyWebhook(_body: string, signature: string) {
    return signature === 'test-signature';
  }
  async fetchSubscription(customerId: string): Promise<KaihipayEvent> {
    return {
      customerId,
      subscriptionStatus: 'active',
      occurredAt: new Date().toISOString(),
    };
  }
}
export class HttpKaihipayAdapter implements KaihipayAdapter {
  constructor(
    private token: string,
    private secret: string,
  ) {}
  async verifyWebhook(body: string, signature: string) {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(this.secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const bytes = Uint8Array.from(atob(signature), (c) => c.charCodeAt(0));
    return crypto.subtle.verify(
      'HMAC',
      key,
      bytes,
      new TextEncoder().encode(body),
    );
  }
  async fetchSubscription(customerId: string) {
    const r = await fetch(
      `https://api.kaihipay.jp/customers/${encodeURIComponent(customerId)}`,
      { headers: { authorization: `Bearer ${this.token}` } },
    );
    if (!r.ok) throw new Error('Kaihipay lookup failed');
    return r.json() as Promise<KaihipayEvent>;
  }
}
export function getLineJoinUrl() {
  return process.env.LINE_JOIN_URL || '#';
}
