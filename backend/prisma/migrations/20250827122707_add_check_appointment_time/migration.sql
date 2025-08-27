ALTER TABLE "Appointment"
ADD CONSTRAINT "chk_appointment_time"
CHECK ("startsAt" < "endsAt");