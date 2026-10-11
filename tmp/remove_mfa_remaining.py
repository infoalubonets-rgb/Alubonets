from pathlib import Path
import re
p=Path('components/auth/LoginForm.tsx');s=p.read_text(encoding='utf-8');s=re.sub(r'^.*const \[(?:mfaToken|needsMfa),.*\n','',s,flags=re.M);s=s.replace('        needsMfa ? mfaToken : undefined,\n','');a=s.index('      const mfaRequired =');b=s.index('    } finally {',a);s=s[:a]+"      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')\n"+s[b:];s=re.sub(r"              \{mode === 'signin' && needsMfa && \(.*?              \)\}\n",'',s,flags=re.S);p.write_text(s,encoding='utf-8')
for name in ['components/profile/PrivilegedMfaPanel.tsx','app/actions/mfa.ts','lib/mfa-recovery.ts','lib/mfa-totp.ts','tests/mfa-recovery.test.ts']:
 Path(name).unlink()
