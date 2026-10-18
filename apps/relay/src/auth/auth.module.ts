import { Global, Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { FIREBASE_AUTH, firebaseAuthProvider } from './firebase-admin.provider';
import { FirebaseAuthGuard } from './firebase-auth.guard';
import { UsersService } from './users.service';

/**
 * Global so `FirebaseAuthGuard` is injectable from any module without
 * re-importing.
 */
@Global()
@Module({
  controllers: [AuthController],
  providers: [firebaseAuthProvider, UsersService, FirebaseAuthGuard],
  exports: [FIREBASE_AUTH, UsersService, FirebaseAuthGuard],
})
export class AuthModule {}
