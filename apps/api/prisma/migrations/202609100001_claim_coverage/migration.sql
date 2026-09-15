CREATE TABLE "ClaimCoverage" (
  "workloadId" UUID PRIMARY KEY,
  "claimId" UUID NOT NULL,
  "revision" INTEGER NOT NULL CHECK ("revision" > 0),
  CONSTRAINT "ClaimCoverage_workloadId_fkey" FOREIGN KEY ("workloadId") REFERENCES "Workload"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ClaimCoverage_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "ClaimCoverage_claimId_idx" ON "ClaimCoverage"("claimId");
CREATE INDEX "OutboxEvent_pending_submission_idx" ON "OutboxEvent"("availableAt", "createdAt") WHERE "deliveredAt" IS NULL AND "attempts" < 8 AND "eventType" = 'CLAIM_SUBMITTED';

CREATE FUNCTION protect_claim_evidence() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Submitted revisions and audit events are immutable';
END;
$$;
CREATE TRIGGER "ClaimRevision_immutable" BEFORE UPDATE OR DELETE ON "ClaimRevision" FOR EACH ROW EXECUTE FUNCTION protect_claim_evidence();
CREATE TRIGGER "AuditLog_immutable" BEFORE UPDATE OR DELETE ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION protect_claim_evidence();
