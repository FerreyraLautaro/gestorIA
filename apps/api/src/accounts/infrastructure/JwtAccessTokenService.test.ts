import { SignJWT, decodeJwt, decodeProtectedHeader } from 'jose';
import { describe, expect, it } from 'vitest';
import { UnauthorizedError } from '../../shared/domain/errors.js';
import { JwtAccessTokenService } from './JwtAccessTokenService.js';

const SECRET = 'test-secret-with-at-least-32-characters!!';
const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';
const NOW = new Date('2026-06-01T12:00:00.000Z');
const NOW_SECONDS = NOW.getTime() / 1000;

function serviceAt(clock: { now: Date }, secret = SECRET) {
  return new JwtAccessTokenService(secret, () => clock.now);
}

/** Signs an arbitrary token with the test secret, for forging unexpected shapes. */
function sign(configure: (jwt: SignJWT) => SignJWT, alg = 'HS256'): Promise<string> {
  const jwt = new SignJWT({})
    .setProtectedHeader({ alg })
    .setIssuedAt(NOW_SECONDS)
    .setExpirationTime(NOW_SECONDS + 900);
  return configure(jwt).sign(new TextEncoder().encode(SECRET));
}

describe('JwtAccessTokenService', () => {
  it('issues an HS256 token valid for 900 seconds with sub, iat, exp and issuer', async () => {
    const service = serviceAt({ now: NOW });

    const { token, expiresIn } = await service.issue(ACCOUNT_ID);

    expect(expiresIn).toBe(900);
    expect(decodeProtectedHeader(token).alg).toBe('HS256');
    expect(decodeJwt(token)).toEqual({
      sub: ACCOUNT_ID,
      iss: 'gestoria-api',
      iat: NOW_SECONDS,
      exp: NOW_SECONDS + 900,
    });
  });

  it('verifies a freshly issued token and returns the account id', async () => {
    const service = serviceAt({ now: NOW });
    const { token } = await service.issue(ACCOUNT_ID);

    expect(await service.verify(token)).toEqual({ accountId: ACCOUNT_ID });
  });

  it('accepts a token just before expiry and rejects it at expiry', async () => {
    const clock = { now: NOW };
    const service = serviceAt(clock);
    const { token } = await service.issue(ACCOUNT_ID);

    clock.now = new Date(NOW.getTime() + 899_000);
    await expect(service.verify(token)).resolves.toEqual({ accountId: ACCOUNT_ID });

    clock.now = new Date(NOW.getTime() + 900_000);
    await expect(service.verify(token)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('rejects a tampered payload', async () => {
    const service = serviceAt({ now: NOW });
    const { token } = await service.issue(ACCOUNT_ID);
    const [header, , signature] = token.split('.');
    const forged = Buffer.from(
      JSON.stringify({ sub: 'attacker', iss: 'gestoria-api', iat: 1, exp: 9_999_999_999 }),
    ).toString('base64url');

    await expect(service.verify(`${header}.${forged}.${signature}`)).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });

  it('rejects a token signed with another secret', async () => {
    const other = serviceAt({ now: NOW }, 'another-secret-with-at-least-32-chars!!');
    const { token } = await other.issue(ACCOUNT_ID);

    await expect(serviceAt({ now: NOW }).verify(token)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('rejects a token signed with a different algorithm (HS512)', async () => {
    const token = await sign(
      (jwt) => jwt.setSubject(ACCOUNT_ID).setIssuer('gestoria-api'),
      'HS512',
    );

    await expect(serviceAt({ now: NOW }).verify(token)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('rejects an unsecured alg=none token', async () => {
    const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const token = `${encode({ alg: 'none', typ: 'JWT' })}.${encode({
      sub: ACCOUNT_ID,
      iss: 'gestoria-api',
      exp: 9_999_999_999,
    })}.`;

    await expect(serviceAt({ now: NOW }).verify(token)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('rejects a token from another issuer', async () => {
    const token = await sign((jwt) => jwt.setSubject(ACCOUNT_ID).setIssuer('someone-else'));

    await expect(serviceAt({ now: NOW }).verify(token)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('rejects a token without a subject', async () => {
    const token = await sign((jwt) => jwt.setIssuer('gestoria-api'));

    await expect(serviceAt({ now: NOW }).verify(token)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it.each(['', 'garbage', 'a.b.c'])('rejects malformed token %j', async (token) => {
    await expect(serviceAt({ now: NOW }).verify(token)).rejects.toBeInstanceOf(UnauthorizedError);
  });
});
