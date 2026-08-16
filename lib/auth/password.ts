import bcrypt from 'bcryptjs';

const ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  if (!hash) return false;
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

/**
 * 密码强度规则（正式环境）。
 * Demo 环境的种子密码不受此限制，但 README 已明确标注不得用于正式部署。
 */
export function validatePasswordStrength(plain: string): { ok: boolean; message?: string } {
  if (plain.length < 10) return { ok: false, message: '密码至少 10 位' };
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(plain)).length;
  if (classes < 3) {
    return { ok: false, message: '密码需包含大写字母、小写字母、数字、符号中至少三类' };
  }
  return { ok: true };
}
