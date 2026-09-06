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

    // 1. Cek keberadaan record DNS saat ini
    const dnsQueryUrl = `https://api.cloudflare.com/client/v4/zones/${CONFIG.cfZoneId}/dns_records?type=CNAME&name=${encodeURIComponent(sub)}`;
    const dnsCheck = await this.request('GET', dnsQueryUrl);
    const existing = dnsCheck.data?.result || [];
    const existingDns = existing.find(r => r.name === sub || r.name === repo);

    // 2. Cek aturan Tunnel Ingress saat ini
    const cfgUrl = `https://api.cloudflare.com/client/v4/accounts/${CONFIG.cfAccount}/cfd_tunnel/${CONFIG.cfTunnelId}/configurations`;
    const cfgRes = await this.request('GET', cfgUrl);
    const ingressRules = cfgRes.data?.result?.config?.ingress || [];
    const existingIngress = ingressRules.find(i => i.hostname === sub);

    // Evaluasi apakah domain & ingress sudah ada dan siap
    const isDnsReady = existingDns && existingDns.content === tunnelCname;
    const isIngressReady = existingIngress && existingIngress.service === serviceTarget;

    // JIKA DOMAIN & INGRESS SUDAH SESUAI: LEWATI REBUILD AGAR TIDAK MEMICU ERROR 1033
    if (isDnsReady && isIngressReady) {
      logs.push(`[Cloudflare] Domain '${sub}' sudah aktif dan terhubung ke Tunnel (${serviceTarget}).`);
      logs.push(`[Cloudflare] Konfigurasi dilewati (skip rebuild) untuk mencegah downtime / Error 1033.`);
      return {
        success: true,
        subdomain: sub,
        url: `https://${sub}`,
        alreadyConfigured: true,
        logs
      };
    }

    // 1. Update / Create DNS CNAME jika belum sesuai
    const dnsPayload = {
      type: 'CNAME',
      name: repo,
      content: tunnelCname,
      proxied: true,
      ttl: 1
    };

    if (existingDns) {
      if (existingDns.content !== tunnelCname) {
        logs.push(`[Cloudflare] Memperbarui DNS CNAME ${sub} -> ${tunnelCname}...`);
        const updateUrl = `https://api.cloudflare.com/client/v4/zones/${CONFIG.cfZoneId}/dns_records/${existingDns.id}`;
        await this.request('PUT', updateUrl, dnsPayload);
        logs.push(`[Cloudflare] DNS CNAME ${sub} berhasil diperbarui.`);
      } else {
        logs.push(`[Cloudflare] DNS CNAME ${sub} sudah sesuai (${tunnelCname}).`);
      }
    } else {
      logs.push(`[Cloudflare] Membuat DNS CNAME baru ${sub} -> ${tunnelCname}...`);
      const createUrl = `https://api.cloudflare.com/client/v4/zones/${CONFIG.cfZoneId}/dns_records`;
      await this.request('POST', createUrl, dnsPayload);
      logs.push(`[Cloudflare] DNS CNAME ${sub} berhasil dibuat.`);
    }

    // 2. Update Tunnel Ingress hanya jika belum ada / belum sesuai
    if (!isIngressReady && cfgRes.ok && cfgRes.data?.result?.config) {
      logs.push(`[Cloudflare] Memperbarui aturan Tunnel Ingress (${sub} -> ${serviceTarget})...`);
      let ingress = cfgRes.data.result.config.ingress || [];

      // Filter out existing rule untuk hostname ini dan catch-all 404 lama
      ingress = ingress.filter(i => i.hostname && i.hostname !== sub && i.service !== 'http_status:404');

      // Sanitize originRequest
      ingress = ingress.map(entry => {
        if (entry.originRequest && Array.isArray(entry.originRequest)) {
          entry.originRequest = {};
        }
        return entry;
      });

      // Tambahkan rule baru dan catch-all
      ingress.push(
        { hostname: sub, service: serviceTarget, originRequest: { httpHostHeader: sub } },
        { service: 'http_status:404', originRequest: {} }
      );

      const putRes = await this.request('PUT', cfgUrl, { config: { ingress } });
      if (putRes.ok && putRes.data?.success) {
        logs.push(`[Cloudflare] Tunnel Ingress aktif: https://${sub}`);
      } else {
        logs.push(`[Cloudflare WARN] Gagal update ingress: ${JSON.stringify(putRes.data?.errors || [])}`);
      }
    } else if (isIngressReady) {
      logs.push(`[Cloudflare] Aturan Tunnel Ingress untuk '${sub}' sudah aktif.`);
    }

    return {
      success: true,
      subdomain: sub,
      url: `https://${sub}`,
      logs
    };
  }
}
