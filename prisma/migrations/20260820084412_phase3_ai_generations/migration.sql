-- CreateEnum
CREATE TYPE "AiGenerationKind" AS ENUM ('THEME', 'ANALYTICS_SUMMARY');

-- CreateTable
CREATE TABLE "ai_generations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "AiGenerationKind" NOT NULL DEFAULT 'THEME',
    "prompt" TEXT NOT NULL,
    "output" TEXT,
    "usedFallback" BOOLEAN NOT NULL DEFAULT false,
    "fixesApplied" INTEGER NOT NULL DEFAULT 0,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_generations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_generations_userId_kind_createdAt_idx" ON "ai_generations"("userId", "kind", "createdAt");

-- AddForeignKey
ALTER TABLE "ai_generations" ADD CONSTRAINT "ai_generations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
