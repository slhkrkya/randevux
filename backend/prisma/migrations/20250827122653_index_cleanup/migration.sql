-- DropIndex
DROP INDEX "public"."Appointment_creatorId_idx";

-- DropIndex
DROP INDEX "public"."Appointment_inviteeId_idx";

-- DropIndex
DROP INDEX "public"."Appointment_startsAt_idx";

-- CreateIndex
CREATE INDEX "Appointment_creatorId_startsAt_idx" ON "public"."Appointment"("creatorId", "startsAt");

-- CreateIndex
CREATE INDEX "Appointment_inviteeId_startsAt_idx" ON "public"."Appointment"("inviteeId", "startsAt");
