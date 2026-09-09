import { describe, expect, it } from 'vitest';
import {
  isOpsWatchedPath,
  opsCodeForHttp,
  severityForHttpStatus,
} from '../../server/v2/utils/opsErrorClassify';

describe('opsErrorClassify', () => {
  it('maps HTTP status to severity', () => {
    expect(severityForHttpStatus(400)).toBe('amber');
    expect(severityForHttpStatus(401)).toBe('amber');
    expect(severityForHttpStatus(499)).toBe('amber');
    expect(severityForHttpStatus(500)).toBe('red');
    expect(severityForHttpStatus(503)).toBe('red');
  });

  it('watches auth/crypto/prekey paths only for amber', () => {
    expect(isOpsWatchedPath('/v2/crypto/prekeys')).toBe(true);
    expect(isOpsWatchedPath('/api/v2/prekeys')).toBe(true);
    expect(isOpsWatchedPath('/v2/auth/login')).toBe(true);
    expect(isOpsWatchedPath('/v2/dm/threads')).toBe(false);
    expect(isOpsWatchedPath('/v2/user/me')).toBe(false);
  });

  it('codes prekey 401 distinctly', () => {
    expect(opsCodeForHttp('POST', '/v2/crypto/prekeys', 401)).toBe('PREKEY_AUTH_401');
    expect(opsCodeForHttp('POST', '/v2/auth/login', 401)).toBe('AUTH_401');
  });
});
