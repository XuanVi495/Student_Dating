-- User reports, evidence URLs, and append-only moderation history.

alter type public.notification_type
  add value if not exists 'BAO_CAO_TIEP_NHAN';
alter type public.notification_type
  add value if not exists 'BAO_CAO_CAP_NHAT';

create type public.report_reason_category as enum (
  'QUAY_ROI',
  'NOI_DUNG_KHONG_PHU_HOP',
  'LUA_DAO',
  'GIA_MAO',
  'SPAM',
  'KHAC'
);

create type public.report_status as enum (
  'CHO_DUYET',
  'DANG_XU_LY',
  'DA_XU_LY',
  'BAC_BO'
);

create table public.reports (
  id                  uuid primary key default gen_random_uuid(),
  reporter_id         uuid not null references public.students(id) on delete cascade,
  reported_student_id uuid not null references public.students(id) on delete cascade,
  reason_category     public.report_reason_category not null,
  reason_note         text check (reason_note is null or char_length(reason_note) <= 2000),
  context             jsonb not null default '{}'::jsonb
    check (jsonb_typeof(context) = 'object'),
  context_fingerprint text not null,
  status              public.report_status not null default 'CHO_DUYET',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (reporter_id <> reported_student_id),
  check (nullif(btrim(context_fingerprint), '') is not null)
);

create table public.report_evidences (
  id         uuid primary key default gen_random_uuid(),
  report_id  uuid not null references public.reports(id) on delete cascade,
  url        text not null check (url ~ '^https://[^[:space:]]+$'),
  position   smallint not null check (position between 0 and 4),
  created_at timestamptz not null default now(),
  unique (report_id, position)
);

create table public.report_histories (
  id           uuid primary key default gen_random_uuid(),
  report_id    uuid not null references public.reports(id) on delete cascade,
  reviewer_id  uuid not null references public.students(id) on delete restrict,
  from_status  public.report_status,
  to_status    public.report_status not null,
  decision     text check (decision is null or char_length(decision) <= 2000),
  action       text check (action is null or char_length(action) <= 2000),
  note         text check (note is null or char_length(note) <= 2000),
  processed_at timestamptz not null default now()
);

create index reports_status_created_at_idx
  on public.reports (status, created_at);
create index reports_reporter_created_at_idx
  on public.reports (reporter_id, created_at desc);
create index reports_reported_student_created_at_idx
  on public.reports (reported_student_id, created_at desc);
create index reports_context_fingerprint_idx
  on public.reports (context_fingerprint);
create index report_histories_report_processed_idx
  on public.report_histories (report_id, processed_at);
create index report_histories_reviewer_processed_idx
  on public.report_histories (reviewer_id, processed_at);

create unique index reports_pending_duplicate_uq
  on public.reports (reporter_id, reported_student_id, context_fingerprint)
  where status in ('CHO_DUYET', 'DANG_XU_LY');

alter table public.reports enable row level security;
alter table public.report_evidences enable row level security;
alter table public.report_histories enable row level security;
revoke all on table public.reports, public.report_evidences, public.report_histories
  from public, anon, authenticated;
