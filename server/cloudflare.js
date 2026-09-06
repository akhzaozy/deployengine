import { CONFIG } from './config.js';

export class CloudflareManager {
  static async request(method, url, body = null) {
    if (!CONFIG.cfApiToken || CONFIG.cfApiToken.includes('cfat_')) {
      // In dev environment or fallback mock
    }

    try {
      const headers = {
        'Authorization': `Bearer ${CONFIG.cfApiToken}`,
        'Content-Type': 'application/json'
      };

      const options = {
        method,
        headers
      };

      if (body) {
        options.body = typeof body === 'string' ? body : JSON.stringify(body);
      }

      const res = await fetch(url, options);
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok, status: res.status, data };
    } catch (err) {
      return { ok: false, status: 500, error: err.message };
    }
  }

  static async syncSubdomain(repo, domainBase = CONFIG.domainBase, serviceTarget = 'http://localhost:80') {
    const sub = `${repo}.${domainBase}`;
    const logs = [];

    logs.push(`[Cloudflare] Memeriksa Tunnel ID: ${CONFIG.cfTunnelId}...`);
    
    // Check Tunnel status
    const tunnelUrl = `https://api.cloudflare.com/client/v4/accounts/${CONFIG.cfAccount}/cfd_tunnel/${CONFIG.cfTunnelId}`;
    const tunnelRes = await this.request('GET', tunnelUrl);

    if (!tunnelRes.ok || !tunnelRes.data?.result?.id) {
      logs.push(`[Cloudflare WARN] Tunnel ID tidak aktif atau API offline. Mode simulasi / direct Nginx aktif.`);
      return { success: true, subdomain: sub, simulated: true, logs };
    }

    const tunnelCname = `${CONFIG.cfTunnelId}.cfargotunnel.com`;
    logs.push(`[Cloudflare] Sinkronisasi DNS CNAME ${sub} -> ${tunnelCname}...`);

    // 1. Check existing DNS record
    const dnsQueryUrl = `https://api.cloudflare.com/client/v4/zones/${CONFIG.cfZoneId}/dns_records?type=CNAME&name=${encodeURIComponent(sub)}`;
    const dnsCheck = await this.request('GET', dnsQueryUrl);
    const existing = dnsCheck.data?.result || [];

    const dnsPayload = {
      type: 'CNAME',
      name: repo,
      content: tunnelCname,
      proxied: true,
      ttl: 1
    };

    if (existing.length > 0) {
      const updateUrl = `https://api.cloudflare.com/client/v4/zones/${CONFIG.cfZoneId}/dns_records/${existing[0].id}`;
      await this.request('PUT', updateUrl, dnsPayload);
      logs.push(`[Cloudflare] DNS CNAME ${sub} berhasil diperbarui.`);
    } else {
      const createUrl = `https://api.cloudflare.com/client/v4/zones/${CONFIG.cfZoneId}/dns_records`;
      await this.request('POST', createUrl, dnsPayload);
      logs.push(`[Cloudflare] DNS CNAME ${sub} berhasil dibuat.`);
    }

    // 2. Update Tunnel Ingress Configuration
    logs.push(`[Cloudflare] Memperbarui aturan Tunnel Ingress (${sub} -> ${serviceTarget})...`);
    const cfgUrl = `https://api.cloudflare.com/client/v4/accounts/${CONFIG.cfAccount}/cfd_tunnel/${CONFIG.cfTunnelId}/configurations`;
    const cfgRes = await this.request('GET', cfgUrl);

    if (cfgRes.ok && cfgRes.data?.result?.config) {
      let ingress = cfgRes.data.result.config.ingress || [];

      // Filter out existing rule for this hostname and catch-all 404
      ingress = ingress.filter(i => i.hostname && i.hostname !== sub);

      // Sanitize originRequest
      ingress = ingress.map(entry => {
        if (entry.originRequest && Array.isArray(entry.originRequest)) {
          entry.originRequest = {};
        }
        return entry;
      });

      // Add our rule and catch-all
      ingress.push(
        { hostname: sub, service: serviceTarget, originRequest: {} },
        { service: 'http_status:404', originRequest: {} }
      );

      const putRes = await this.request('PUT', cfgUrl, { config: { ingress } });
      if (putRes.ok && putRes.data?.success) {
        logs.push(`[Cloudflare] Tunnel Ingress aktif: https://${sub}`);
      } else {
        logs.push(`[Cloudflare WARN] Gagal update ingress: ${JSON.stringify(putRes.data?.errors || [])}`);
      }
    }

    return {
      success: true,
      subdomain: sub,
      url: `https://${sub}`,
      logs
    };
  }
}
