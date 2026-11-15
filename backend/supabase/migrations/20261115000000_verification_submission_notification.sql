-- Notify students when their student-card verification enters the review queue.
alter type public.notification_type
  add value if not exists 'XAC_THUC_CHO_DUYET';

create index if not exists verifications_status_submitted_at_idx
  on public.verifications (status, submitted_at);
