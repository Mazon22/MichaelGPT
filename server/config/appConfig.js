const DEFAULT_CLIENT_ORIGINS = [
  'https://michaelgpt.ru',
  'https://www.michaelgpt.ru',
  'http://michaelgpt.ru',
  'http://www.michaelgpt.ru',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];
const DEV_CLIENT_PORTS = new Set(['3000', '3001', '4173', '5173']);

function parseCsvList(value, fallback = []) {
  if (!value) return fallback;
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

const clientOrigins = Array.from(
  new Set([...DEFAULT_CLIENT_ORIGINS, ...parseCsvList(process.env.CLIENT_ORIGINS)])
);
const ownerEmails = new Set(
  parseCsvList(process.env.OWNER_EMAILS).map((email) => email.toLowerCase())
);

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (clientOrigins.includes(origin)) return true;

  try {
    const { protocol, hostname, port } = new URL(origin);
    if (!/^https?:$/.test(protocol)) return false;
    if (!DEV_CLIENT_PORTS.has(port)) return false;

    const isPrivateLanIp =
      /^10\.\d+\.\d+\.\d+$/.test(hostname) ||
      /^192\.168\.\d+\.\d+$/.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/.test(hostname);

    return isPrivateLanIp;
  } catch (_error) {
    return false;
  }
}

function resolveRegistrationRole(email) {
  if (!email) return 'user';
  return ownerEmails.has(String(email).toLowerCase()) ? 'owner' : 'user';
}

module.exports = {
  clientOrigins,
  isAllowedOrigin,
  ownerEmails,
  resolveRegistrationRole,
};
