-- Switch user identity from local email/password to Firebase.
-- Pre-existing users were created by the removed password flow and have no
-- Firebase UID, so they cannot be mapped onto the new identity key. Remove
-- them; their agents/pairing codes cascade and must be re-paired.
DELETE FROM "User";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "passwordHash",
ADD COLUMN     "firebaseUid" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_firebaseUid_key" ON "User"("firebaseUid");
