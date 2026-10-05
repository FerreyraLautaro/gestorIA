import { createApp } from './app.js';
import { LoginAccount } from './accounts/application/LoginAccount.js';
import { Logout } from './accounts/application/Logout.js';
import { RefreshSession } from './accounts/application/RefreshSession.js';
import { RefreshTokenIssuer } from './accounts/application/RefreshTokenIssuer.js';
import { RegisterAccount } from './accounts/application/RegisterAccount.js';
import { BcryptPasswordHasher } from './accounts/infrastructure/BcryptPasswordHasher.js';
import { DrizzleAccountRepository } from './accounts/infrastructure/DrizzleAccountRepository.js';
import { DrizzleRefreshTokenRepository } from './accounts/infrastructure/DrizzleRefreshTokenRepository.js';
import { createAuthRouter } from './accounts/infrastructure/http/authRouter.js';
import { JwtAccessTokenService } from './accounts/infrastructure/JwtAccessTokenService.js';
import { Sha256RefreshTokenGenerator } from './accounts/infrastructure/Sha256RefreshTokenGenerator.js';
import { parseJwtSecret } from './shared/config/jwtSecret.js';
import { parsePort } from './shared/config/port.js';
import { createDatabase } from './shared/infrastructure/db/database.js';
import { startServer } from './shared/infrastructure/http/startServer.js';

try {
  const port = parsePort(process.env['PORT']);
  const jwtSecret = parseJwtSecret(process.env['JWT_SECRET']);
  const databaseUrl = process.env['DATABASE_URL'];
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required: see apps/api/.env.example.');
  }

  // Composition root: adapters are wired to the use cases here and nowhere else.
  const { db } = createDatabase(databaseUrl);
  const accounts = new DrizzleAccountRepository(db);
  const hasher = new BcryptPasswordHasher();
  const tokens = new JwtAccessTokenService(jwtSecret);
  const refreshTokens = new DrizzleRefreshTokenRepository(db);
  const refreshGenerator = new Sha256RefreshTokenGenerator();
  const clock = () => new Date();
  const refreshIssuer = new RefreshTokenIssuer(refreshGenerator, clock);
  const app = createApp({
    routers: [
      createAuthRouter({
        registerAccount: new RegisterAccount(accounts, hasher),
        loginAccount: new LoginAccount(accounts, hasher, tokens, refreshTokens, refreshIssuer),
        refreshSession: new RefreshSession(
          refreshTokens,
          refreshGenerator,
          refreshIssuer,
          tokens,
          clock,
        ),
        logout: new Logout(refreshTokens, refreshGenerator, clock),
      }),
    ],
  });

  await startServer(app, port);
  console.log(`gestorIA API listening on http://localhost:${port}`);
} catch (error) {
  console.error(
    `gestorIA API failed to start: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
}
