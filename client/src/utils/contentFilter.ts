export const BLOCKED_MESSAGE_WARNING =
  '\u0418\u0437\u0432\u0438\u043d\u0438\u0442\u0435, \u0434\u0430\u043d\u043d\u044b\u0439 \u0442\u0438\u043f \u0432\u043e\u043f\u0440\u043e\u0441\u043e\u0432 \u043d\u0435 \u043f\u043e\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u0442\u0441\u044f \u0441\u0438\u0441\u0442\u0435\u043c\u043e\u0439. \u041f\u043e\u0436\u0430\u043b\u0443\u0439\u0441\u0442\u0430, \u0437\u0430\u0434\u0430\u0439\u0442\u0435 \u0434\u0440\u0443\u0433\u043e\u0439 \u0432\u043e\u043f\u0440\u043e\u0441.';

export const BLOCKED_KEYWORDS_BY_TOPIC: Record<string, string[]> = {
  terrorism: [
    '\u0442\u0435\u0440\u0440\u043e\u0440',
    '\u0442\u0435\u0440\u0440\u043e\u0440\u0438\u0437\u043c',
    '\u0442\u0435\u0440\u0430\u043a\u0442',
    '\u0432\u0437\u0440\u044b\u0432',
    '\u0431\u043e\u043c\u0431',
    '\u044d\u043a\u0441\u0442\u0440\u0435\u043c\u0438\u0437\u043c',
    'terror',
    'terrorism',
    'bomb',
    'explosive',
  ],
  violence: [
    '\u043d\u0430\u0441\u0438\u043b',
    '\u0443\u0431\u0438\u0439',
    '\u0443\u0431\u0438\u0442\u044c',
    '\u0443\u0431\u0438\u0439\u0441\u0442\u0432',
    '\u043f\u044b\u0442\u043a',
    '\u0440\u0430\u0441\u0447\u043b\u0435\u043d',
    '\u0436\u0435\u0441\u0442\u043e\u043a',
    'kill',
    'murder',
    'violence',
    'torture',
  ],
  adult: [
    '18+',
    '\u043f\u043e\u0440\u043d',
    '\u044d\u0440\u043e\u0442',
    '\u0441\u0435\u043a\u0441',
    '\u0438\u043d\u0442\u0438\u043c',
    '\u043e\u0431\u043d\u0430\u0436',
    'porn',
    'sex',
    'xxx',
    'nude',
    'adult content',
  ],
  religion: [
    '\u0440\u0435\u043b\u0438\u0433',
    '\u0432\u0435\u0440\u0430',
    '\u0432\u0435\u0440\u043e\u0438\u0441\u043f\u043e\u0432\u0435\u0434',
    '\u0431\u0438\u0431\u043b',
    '\u043a\u043e\u0440\u0430\u043d',
    '\u0446\u0435\u0440\u043a\u043e\u0432',
    '\u0438\u0441\u043b\u0430\u043c',
    '\u0445\u0440\u0438\u0441\u0442\u0438\u0430\u043d',
    '\u0431\u043e\u0433',
    'religion',
    'church',
    'quran',
    'bible',
    'islam',
  ],
};

function normalizeMessage(message: string): string {
  return String(message || '')
    .toLowerCase()
    .replace(/\u0451/g, '\u0435')
    .replace(/[^\p{L}\p{N}\s+]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function checkMessageContent(message: string): boolean {
  const normalizedMessage = normalizeMessage(message);
  if (!normalizedMessage) return false;

  return Object.values(BLOCKED_KEYWORDS_BY_TOPIC).some((keywords) =>
    keywords.some((keyword) => normalizedMessage.includes(keyword))
  );
}
