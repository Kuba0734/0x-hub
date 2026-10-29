/**
 * Rough password strength, 0 (very weak) … 4 (very strong).
 * Rewards length most, then variety; penalizes repeats and common patterns.
 */
export function passwordScore(pw: string): 0 | 1 | 2 | 3 | 4 {
  if (!pw) return 0;
  const len = [...pw].length;
  let classes = 0;
  if (/[a-z]/.test(pw)) classes++;
  if (/[A-Z]/.test(pw)) classes++;
  if (/\d/.test(pw)) classes++;
  if (/[^A-Za-z0-9]/.test(pw)) classes++;

  let score = 0;
  if (len >= 8) score++;
  if (len >= 12) score++;
  if (len >= 16) score++;
  if (classes >= 3) score++;
  if (len >= 20 && classes >= 2) score++;

  const lower = pw.toLowerCase();
  if (/(.)\1{2,}/.test(pw)) score--;
  if (/^(password|passwort|qwerty|123456|letmein|admin)/.test(lower)) score -= 2;
  if (len < 8) score = Math.min(score, 1);

  return Math.max(0, Math.min(4, score)) as 0 | 1 | 2 | 3 | 4;
}
