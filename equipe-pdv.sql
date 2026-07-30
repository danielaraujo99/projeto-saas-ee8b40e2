-- =====================================================================
-- MenuAltas — Bloco: Equipe & Permissões (convites reais) + PDV (caixa)
-- Rode UMA VEZ no SQL Editor do seu Supabase (projeto custom).
-- Idempotente: pode rodar novamente sem quebrar.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) CONVITES DE MEMBROS
-- ---------------------------------------------------------------------
create table if not exists public.restaurant_invites (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  email text not null,
  role public.app_role not null,
  token text not null unique,
  invited_by uuid not null,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_by uuid,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists restaurant_invites_restaurant_idx
  on public.restaurant_invites (restaurant_id, created_at desc);
create index if not exists restaurant_invites_email_idx
  on public.restaurant_invites (lower(email));

grant select on public.restaurant_invites to authenticated;
grant all on public.restaurant_invites to service_role;

alter table public.restaurant_invites enable row level security;

drop policy if exists invites_admin_read on public.restaurant_invites;
create policy invites_admin_read on public.restaurant_invites
  for select to authenticated
  using (public.has_restaurant_role(auth.uid(), restaurant_id, 'admin'::public.app_role));

-- Escrita SEMPRE via funções security definer abaixo (nenhuma policy de
-- insert/update/delete é criada de propósito).

-- Lista de membros com nome/e-mail (contorna o RLS restritivo de profiles,
-- que só permite o próprio usuário ler a própria linha).
create or replace function public.list_restaurant_members(_restaurant_id uuid)
returns table(user_id uuid, role public.app_role, name text, email text, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select m.user_id, m.role, p.name, p.email, m.created_at
  from public.restaurant_members m
  left join public.profiles p on p.id = m.user_id
  where m.restaurant_id = _restaurant_id
    and public.is_restaurant_member(auth.uid(), _restaurant_id)
  order by m.created_at asc;
$$;

grant execute on function public.list_restaurant_members(uuid) to authenticated;

-- Cria convite (somente admin do restaurante).
create or replace function public.create_restaurant_invite(
  _restaurant_id uuid,
  _email text,
  _role public.app_role
)
returns table(id uuid, token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _clean_email text := lower(btrim(coalesce(_email, '')));
  _token text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  _id uuid;
  _exp timestamptz := now() + interval '7 days';
begin
  if _uid is null then raise exception 'not_authenticated'; end if;
  if not public.has_restaurant_role(_uid, _restaurant_id, 'admin'::public.app_role) then
    raise exception 'forbidden';
  end if;
  if _clean_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid_email';
  end if;

  -- invalida convites pendentes anteriores para o mesmo e-mail/restaurante
  update public.restaurant_invites
     set revoked_at = now()
   where restaurant_id = _restaurant_id
     and lower(email) = _clean_email
     and accepted_at is null
     and revoked_at is null;

  insert into public.restaurant_invites (restaurant_id, email, role, token, invited_by, expires_at)
  values (_restaurant_id, _clean_email, _role, _token, _uid, _exp)
  returning restaurant_invites.id into _id;

  id := _id; token := _token; expires_at := _exp;
  return next;
end;
$$;

grant execute on function public.create_restaurant_invite(uuid, text, public.app_role) to authenticated;

-- Revoga convite pendente (somente admin).
create or replace function public.revoke_restaurant_invite(_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare _rid uuid;
begin
  select restaurant_id into _rid from public.restaurant_invites where id = _invite_id;
  if _rid is null then raise exception 'invite_not_found'; end if;
  if not public.has_restaurant_role(auth.uid(), _rid, 'admin'::public.app_role) then
    raise exception 'forbidden';
  end if;
  update public.restaurant_invites
     set revoked_at = now()
   where id = _invite_id and accepted_at is null and revoked_at is null;
end;
$$;

grant execute on function public.revoke_restaurant_invite(uuid) to authenticated;

-- Detalhes públicos de um convite (para a tela de aceite, antes do login).
create or replace function public.peek_restaurant_invite(_token text)
returns table(email text, role public.app_role, restaurant_name text, expires_at timestamptz, status text)
language sql
stable
security definer
set search_path = public
as $$
  select i.email,
         i.role,
         r.name,
         i.expires_at,
         case
           when i.revoked_at is not null then 'revoked'
           when i.accepted_at is not null then 'accepted'
           when i.expires_at < now() then 'expired'
           else 'pending'
         end
  from public.restaurant_invites i
  join public.restaurants r on r.id = i.restaurant_id
  where i.token = _token;
$$;

grant execute on function public.peek_restaurant_invite(text) to anon, authenticated;

-- Aceite do convite: cria o vínculo em restaurant_members.
create or replace function public.accept_restaurant_invite(_token text)
returns table(restaurant_id uuid, role public.app_role, slug text)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  _uid uuid := auth.uid();
  _email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  _inv public.restaurant_invites%rowtype;
  _slug text;
begin
  if _uid is null then raise exception 'not_authenticated'; end if;

  select * into _inv from public.restaurant_invites i where i.token = _token for update;
  if _inv.id is null then raise exception 'invite_not_found'; end if;
  if _inv.revoked_at is not null then raise exception 'invite_revoked'; end if;
  if _inv.accepted_at is not null then raise exception 'invite_already_used'; end if;
  if _inv.expires_at < now() then raise exception 'invite_expired'; end if;
  if lower(_inv.email) <> _email then raise exception 'invite_email_mismatch'; end if;

  insert into public.restaurant_members (user_id, restaurant_id, role)
  values (_uid, _inv.restaurant_id, _inv.role)
  on conflict (user_id, restaurant_id) do update set role = excluded.role;

  update public.restaurant_invites i
     set accepted_at = now(), accepted_by = _uid
   where i.id = _inv.id;

  select r.slug into _slug from public.restaurants r where r.id = _inv.restaurant_id;

  return query select _inv.restaurant_id, _inv.role, _slug;
end;
$$;

grant execute on function public.accept_restaurant_invite(text) to authenticated;

-- Garante o upsert do aceite (unique já existe no schema original, mas
-- reforçamos por segurança).
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'restaurant_members_user_restaurant_key'
  ) and not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'restaurant_members_user_id_restaurant_id_key'
  ) then
    alter table public.restaurant_members
      add constraint restaurant_members_user_restaurant_key unique (user_id, restaurant_id);
  end if;
end$$;

-- ---------------------------------------------------------------------
-- 2) PDV — SESSÕES DE CAIXA
-- ---------------------------------------------------------------------
create table if not exists public.cash_sessions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  opened_by uuid not null,
  opened_at timestamptz not null default now(),
  opening_amount numeric(12,2) not null default 0,
  closed_by uuid,
  closed_at timestamptz,
  closing_amount numeric(12,2),
  expected_amount numeric(12,2),
  status text not null default 'open',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Só uma sessão aberta por restaurante.
create unique index if not exists cash_sessions_one_open_per_restaurant
  on public.cash_sessions (restaurant_id)
  where status = 'open';

create table if not exists public.cash_movements (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.cash_sessions(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  kind text not null check (kind in ('sangria', 'suprimento')),
  amount numeric(12,2) not null check (amount > 0),
  reason text,
  created_by uuid not null,
  created_at timestamptz not null default now()
);

create index if not exists cash_movements_session_idx
  on public.cash_movements (session_id, created_at desc);

-- Vincula pedidos do PDV ao turno de caixa.
alter table public.orders
  add column if not exists cash_session_id uuid references public.cash_sessions(id) on delete set null;

create index if not exists orders_cash_session_idx on public.orders (cash_session_id);

grant select, insert, update on public.cash_sessions to authenticated;
grant all on public.cash_sessions to service_role;
grant select, insert on public.cash_movements to authenticated;
grant all on public.cash_movements to service_role;

alter table public.cash_sessions enable row level security;
alter table public.cash_movements enable row level security;

-- Acesso restrito a Admin e Caixa (Cozinha NÃO acessa).
create or replace function public.can_operate_cash(_user_id uuid, _restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.restaurant_members
    where user_id = _user_id
      and restaurant_id = _restaurant_id
      and role in ('admin'::public.app_role, 'caixa'::public.app_role)
  );
$$;

grant execute on function public.can_operate_cash(uuid, uuid) to authenticated;

drop policy if exists cash_sessions_read on public.cash_sessions;
create policy cash_sessions_read on public.cash_sessions
  for select to authenticated
  using (public.can_operate_cash(auth.uid(), restaurant_id));

drop policy if exists cash_sessions_insert on public.cash_sessions;
create policy cash_sessions_insert on public.cash_sessions
  for insert to authenticated
  with check (public.can_operate_cash(auth.uid(), restaurant_id) and opened_by = auth.uid());

drop policy if exists cash_sessions_update on public.cash_sessions;
create policy cash_sessions_update on public.cash_sessions
  for update to authenticated
  using (public.can_operate_cash(auth.uid(), restaurant_id))
  with check (public.can_operate_cash(auth.uid(), restaurant_id));

drop policy if exists cash_movements_read on public.cash_movements;
create policy cash_movements_read on public.cash_movements
  for select to authenticated
  using (public.can_operate_cash(auth.uid(), restaurant_id));

drop policy if exists cash_movements_insert on public.cash_movements;
create policy cash_movements_insert on public.cash_movements
  for insert to authenticated
  with check (
    public.can_operate_cash(auth.uid(), restaurant_id)
    and created_by = auth.uid()
    and exists (
      select 1 from public.cash_sessions s
      where s.id = session_id
        and s.restaurant_id = cash_movements.restaurant_id
        and s.status = 'open'
    )
  );

-- updated_at
create or replace function public.orders_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists cash_sessions_touch on public.cash_sessions;
create trigger cash_sessions_touch
  before update on public.cash_sessions
  for each row execute function public.orders_touch_updated_at();
