CREATE TABLE "AuditChecklistItem" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "label" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditChecklistItem_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AuditChecklistItem_label_key" ON "AuditChecklistItem"("label");
CREATE INDEX "AuditChecklistItem_active_position_idx" ON "AuditChecklistItem"("active","position");
CREATE TABLE "AuditChecklistResponse" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "claimId" UUID NOT NULL,
  "revision" INTEGER NOT NULL,
  "itemId" UUID NOT NULL,
  "auditorId" UUID NOT NULL,
  "checked" BOOLEAN NOT NULL,
  "note" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditChecklistResponse_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AuditChecklistResponse_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AuditChecklistResponse_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "AuditChecklistItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AuditChecklistResponse_claimId_revision_itemId_key" ON "AuditChecklistResponse"("claimId","revision","itemId");
CREATE INDEX "AuditChecklistResponse_claimId_revision_idx" ON "AuditChecklistResponse"("claimId","revision");
CREATE TABLE "AuditQuery" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "claimId" UUID NOT NULL,
  "revision" INTEGER NOT NULL,
  "auditorId" UUID NOT NULL,
  "reason" TEXT NOT NULL,
  "question" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMPTZ,
  CONSTRAINT "AuditQuery_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AuditQuery_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "AuditQuery_claimId_revision_status_idx" ON "AuditQuery"("claimId","revision","status");
CREATE TABLE "AuditQueryResponse" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "queryId" UUID NOT NULL,
  "responderId" UUID NOT NULL,
  "message" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditQueryResponse_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AuditQueryResponse_queryId_fkey" FOREIGN KEY ("queryId") REFERENCES "AuditQuery"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "AuditQueryResponse_queryId_createdAt_idx" ON "AuditQueryResponse"("queryId","createdAt");
CREATE TABLE "ClaimFlag" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "claimId" UUID NOT NULL,
  "revision" INTEGER NOT NULL,
  "createdById" UUID NOT NULL,
  "type" TEXT NOT NULL,
  "note" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClaimFlag_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ClaimFlag_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "ClaimFlag_claimId_revision_idx" ON "ClaimFlag"("claimId","revision");
CREATE INDEX "ClaimFlag_type_createdAt_idx" ON "ClaimFlag"("type","createdAt");
INSERT INTO "AuditChecklistItem" ("label","position") VALUES
  ('Supporting documents attached',10),
  ('Receipt or invoice is valid',20),
  ('Claim amount matches evidence',30),
  ('Claim date is valid',40),
  ('HOD approval completed',50),
  ('VC approval completed',60),
  ('Claim complies with university policy',70),
  ('No duplicate claim identified',80),
  ('Claim details are internally consistent',90),
  ('Required documentation is complete',100);
