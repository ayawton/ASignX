import type { Express } from 'express';
import { isIP } from 'node:net';

// Only deployment-verified proxy networks may supply client addresses. Never
// accept a hop count: the public Railway URL can have a shorter proxy path.
export function configureProxyTrust(app: Express, value?: string) {
    const ranges = (value ?? '').split(',').map(item => item.trim()).filter(Boolean);
    for (const range of ranges) {
        const [address, prefix, extra] = range.split('/');
        const family = isIP(address ?? '');
        const bits = family === 4 ? 32 : 128;
        if (!family || extra !== undefined || (prefix !== undefined &&
            (!/^\d+$/.test(prefix) || Number(prefix) < 1 || Number(prefix) > bits))) {
            throw new Error('TRUST_PROXY_CIDRS must contain explicit IPs or non-global CIDR ranges.');
        }
    }
    app.set('trust proxy', ranges.length ? ranges : false);
}
