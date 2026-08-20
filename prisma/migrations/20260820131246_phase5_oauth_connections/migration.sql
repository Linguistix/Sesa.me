/*
  Warnings:

  - Added the required column `updatedAt` to the `accounts` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "SyncProvider" AS ENUM ('SPOTIFY_LATEST_RELEASE', 'YOUTUBE_LATEST_VIDEO');

-- AlterTable
ALTER TABLE "accounts" ADD COLUMN     "accountLabel" TEXT,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "links" ADD COLUMN     "syncError" TEXT,
ADD COLUMN     "syncProvider" "SyncProvider",
ADD COLUMN     "syncedAt" TIMESTAMP(3);
