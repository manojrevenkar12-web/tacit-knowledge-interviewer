-- The memory's tables. The same file runs on PostgreSQL 16 with pgvector and on PGlite.
create extension if not exists vector;

create table if not exists interviews (
  interview_id text primary key,
  expert       text not null,
  focus        jsonb not null default '[]',
  started_at   timestamptz not null default now(),
  minutes      real not null default 0,
  done         boolean not null default false
);

create table if not exists turns (
  interview_id text not null references interviews (interview_id),
  turn         int not null,
  topic        text not null,
  move         text not null,
  why          text not null,
  question     text not null,
  answer       text,
  minute       real,
  primary key (interview_id, turn)
);

create table if not exists claims (
  claim_id     text primary key,
  interview_id text not null references interviews (interview_id),
  turn         int not null,
  expert       text not null,
  minute       real not null,
  topic        text not null,
  type         text not null,
  statement    text not null,
  quote        text not null,
  entities     jsonb not null,
  value        double precision,
  unit         text,
  condition    text,
  confirmed    boolean not null,
  embedding    vector(512) not null
);

create table if not exists questions (
  id          bigserial primary key,
  asked_at    timestamptz not null default now(),
  question    text not null,
  abstained   boolean not null,
  answer      text not null,
  cites       jsonb not null,
  warnings    jsonb not null
);

create table if not exists ledger (
  id                bigserial primary key,
  route             text not null,
  model             text not null,
  ok                boolean not null,
  prompt_tokens     int not null,
  completion_tokens int not null,
  micros            bigint not null
);
