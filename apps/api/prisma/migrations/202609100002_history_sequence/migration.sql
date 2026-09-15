ALTER TABLE "ClaimHistory" ADD COLUMN "sequence" SERIAL NOT NULL;
CREATE UNIQUE INDEX "ClaimHistory_sequence_key" ON "ClaimHistory"("sequence");
