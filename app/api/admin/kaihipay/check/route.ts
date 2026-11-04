import { requireAdmin } from '@/lib/admin-auth';
import { readKaihipayCourses } from '@/lib/kaihipay-read';
import { sameAppOrigin } from '@/lib/request-origin';

export const runtime = 'nodejs';
const headers = { 'Cache-Control': 'private, no-store' };
const setting = (key: string) => process.env[key]?.trim() || '';
const positiveInteger = (value: string) => /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value));

function configuration() {
  const checks = [
    { key: 'BACKEND_PROVIDER', configured: setting('BACKEND_PROVIDER') === 'neon' },
    { key: 'NEON_DATABASE_URL', configured: /^postgres(?:ql)?:\/\//.test(setting('NEON_DATABASE_URL')) },
    { key: 'KAIHIPAY_API_TOKEN', configured: !!setting('KAIHIPAY_API_TOKEN') },
    { key: 'KAIHIPAY_EMAIL_HMAC_SECRET', configured: Buffer.byteLength(setting('KAIHIPAY_EMAIL_HMAC_SECRET'), 'utf8') >= 32 },
    { key: 'KAIHIPAY_MEMBERSHIP_COURSE_ID', configured: positiveInteger(setting('KAIHIPAY_MEMBERSHIP_COURSE_ID')) },
    { key: 'KAIHIPAY_EXPECTED_RECURRING_FEE_YEN', configured: positiveInteger(setting('KAIHIPAY_EXPECTED_RECURRING_FEE_YEN')) },
    { key: 'CRON_SECRET', configured: !!setting('CRON_SECRET') },
  ];
  return { checks, missing: checks.filter(check => !check.configured).map(check => check.key), settingsReady: checks.every(check => check.configured) };
}

// Configuration presence only; no provider, entitlement, or database mutation.
export async function GET(req: Request) {
  const actor = await requireAdmin(req);
  if (!actor || actor.role !== 'owner')
    return Response.json({ error: 'Forbidden' }, { status: 403, headers });
  return Response.json({ configuration: configuration(), courseVerification: 'not_checked', canAttemptSync: false }, { headers });
}

// Explicit owner action only. No charge, invitation or entitlement mutation.
export async function POST(req: Request) {
  const actor = await requireAdmin(req, true);
  if (!actor || actor.role !== 'owner')
    return Response.json({ error: 'Forbidden' }, { status: 403, headers });
  if (!sameAppOrigin(req)) {
    return Response.json({ error: 'Forbidden' }, { status: 403, headers });
  }
  const config = configuration();
  if (!setting('KAIHIPAY_API_TOKEN'))
    return Response.json({ error: 'APIトークンが未設定です', configuration: config, courseVerification: 'not_checked', canAttemptSync: false }, { status: 503, headers });
  try {
    const result = await readKaihipayCourses(process.env.KAIHIPAY_API_TOKEN);
    const courseConfigured = positiveInteger(setting('KAIHIPAY_MEMBERSHIP_COURSE_ID')) && positiveInteger(setting('KAIHIPAY_EXPECTED_RECURRING_FEE_YEN'));
    const matching = result.courses.filter(course =>
      course.name === 'www月額費用' && course.billingType === 'monthly' &&
      course.recurringFee === Number(setting('KAIHIPAY_EXPECTED_RECURRING_FEE_YEN')));
    const courseVerification = !courseConfigured ? 'missing_configuration'
      : result.courses.length !== result.total ? 'incomplete_course_list'
      : matching.length === 1 && matching[0].id === Number(setting('KAIHIPAY_MEMBERSHIP_COURSE_ID')) ? 'matched' : 'mismatch';
    // The DB migration gate and order reconciliation are checked by sync itself.
    // This flag only allows attempting sync after validating its configuration.
    return Response.json({ ...result, configuration: config, courseVerification,
      canAttemptSync: config.settingsReady && courseVerification === 'matched' }, { headers });
  } catch {
    return Response.json({ error: '接続を確認できません API権限・有効期限を確認してください', configuration: config, courseVerification: 'failed', canAttemptSync: false },
      { status: 502, headers });
  }
}
