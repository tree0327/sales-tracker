// 로그인한 Supabase 사용자를 가계부 구성원(아내/남편)으로 매핑한다.
//
// 우선순위:
//   1) user.user_metadata.role === 'wife' | 'husband'
//   2) 아래 EMAIL_ROLE 매핑 (이메일 → 역할)
//   3) 기본값 'wife'
//
// 두 계정을 만든 뒤, 각 계정의 이메일을 EMAIL_ROLE 에 적어두거나
// (권장) Supabase Auth 사용자 메타데이터에 { "role": "wife" } / { "role": "husband" } 를 넣으세요.

const EMAIL_ROLE = {
  // 'wife@example.com': 'wife',
  // 'husband@example.com': 'husband',
};

export const MEMBERS = {
  wife: { role: 'wife', name: '아내', cls: 'w', init: '아' },
  husband: { role: 'husband', name: '남편', cls: 'h', init: '남' },
  joint: { role: 'joint', name: '공금', cls: 'j', init: '공' },
};

export function resolveRole(user) {
  if (!user) return 'wife';
  const metaRole = user.user_metadata?.role;
  if (metaRole === 'wife' || metaRole === 'husband') return metaRole;
  const byEmail = user.email ? EMAIL_ROLE[user.email.toLowerCase()] : undefined;
  if (byEmail) return byEmail;
  return 'wife';
}

export function resolveMember(user) {
  return MEMBERS[resolveRole(user)];
}
