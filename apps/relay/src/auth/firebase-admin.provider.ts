import { Logger, type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';

/** Injection token for the Firebase Admin `Auth` instance. */
export const FIREBASE_AUTH = Symbol('FIREBASE_AUTH');

/**
 * Private keys are stored as a single env var; newlines arrive escaped as
 * literal `\n`, so turn them back into real newlines and strip stray quotes.
 */
export function normalizePrivateKey(raw: string): string {
  return raw.replace(/\\n/g, '\n').replace(/^"|"$/g, '');
}

/**
 * Initializes the Firebase Admin SDK from the service-account credentials in
 * the environment. Initialization is reused across a hot reload via `getApps()`.
 */
export const firebaseAuthProvider: Provider = {
  provide: FIREBASE_AUTH,
  inject: [ConfigService],
  useFactory: (config: ConfigService): Auth => {
    const projectId = config.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = config.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKey = normalizePrivateKey(config.get<string>('FIREBASE_PRIVATE_KEY') ?? '');

    const app =
      getApps()[0] ??
      initializeApp({
        credential: cert({ projectId, clientEmail, privateKey }),
        projectId,
      });

    new Logger('FirebaseAdmin').log(`initialized Firebase Admin for project ${projectId}`);
    return getAuth(app);
  },
};
