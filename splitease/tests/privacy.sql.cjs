const fs = require("node:fs");
const assert = require("node:assert/strict");
const { PGlite } = require("@electric-sql/pglite");
(async () => {
  const db = new PGlite();
  const q = async (sql, args = []) => (await db.query(sql, args)).rows;
  const denied = async (sql, args = []) => {
    let refused = false;
    try {
      await q(sql, args);
    } catch {
      refused = true;
    }
    assert.equal(refused, true, "Unauthorized action must fail");
  };
  await db.exec(`create role anon; create role authenticated; create role service_role;
 create schema auth; create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth,public to anon,authenticated,service_role; grant execute on function auth.uid() to anon,authenticated,service_role;
 create schema storage; create table storage.buckets(id text primary key,name text,public boolean);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner_id text); alter table storage.objects enable row level security;
 create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;
 grant usage on schema storage to anon,authenticated; grant select,insert,delete on storage.objects to anon,authenticated;
 insert into auth.users values('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222'),('33333333-3333-4333-8333-333333333333');`);
  for (const file of [
    "202610240001_payment_requests.sql",
    "202610240003_live_group_rooms.sql",
    "202610240004_room_activity.sql",
    "202610240005_monthly_plans.sql",
    "202610240006_stokvel_wallet.sql",
    "202610240007_wallet_payments.sql",
    "202610250001_backend_persistence.sql",
    "202610250002_group_room_photos.sql",
    "202610250003_group_room_chat.sql",
    "202610250004_plan_chats.sql",
    "202610270001_private_accounts.sql",
  ])
    await db.exec(fs.readFileSync("supabase/migrations/" + file, "utf8"));
  const as = async (id) =>
    db.exec(
      `reset role;set request.jwt.claim.sub='${id}';set role authenticated;`,
    );
  const a = "11111111-1111-4111-8111-111111111111",
    b = "22222222-2222-4222-8222-222222222222",
    c = "33333333-3333-4333-8333-333333333333";
  await as(a);
  const room = (
    await q("select public.create_group_room($1,$2::jsonb) r", [
      "Private dinner",
      [
        { name: "Owner", share_cents: 1000, choice: "now" },
        { name: "Friend", share_cents: 1000, choice: "now" },
      ],
    ])
  )[0].r;
  const seat = room.members[1].seatToken;
  assert.equal(
    (
      await q(
        "select has_function_privilege('authenticated','public.read_group_room_before_privacy(uuid,uuid)','execute') ok",
      )
    )[0].ok,
    false,
  );
  await db.exec("reset role;set request.jwt.claim.sub='';set role anon;");
  await denied("select public.read_group_room($1,$2)", [room.key, seat]);
  await as(c);
  await denied("select public.read_group_room($1,null)", [room.key]);
  await denied("select public.read_group_room($1,$2)", [
    room.key,
    room.members[0].seatToken,
  ]);
  await as(b);
  const view = (
    await q("select public.read_group_room($1,$2) r", [room.key, seat])
  )[0].r;
  assert.equal(view.members[1].isMe, true);
  await denied(
    "select public.add_group_room_message($1,null,'impersonation')",
    [room.key],
  );
  const message = (
    await q("select public.add_group_room_message($1,$2,'Hello') r", [
      room.key,
      seat,
    ])
  )[0].r;
  assert.equal(message.senderName, "Friend");
  const path = room.key + "/private.jpg";
  await q(
    "insert into storage.objects(bucket_id,name,owner_id) values($1,$2,$3)",
    ["group-photos", path, b],
  );
  await q("select public.add_group_room_photo($1,$2,$3,$4,$5,$6)", [
    room.key,
    seat,
    "private.jpg",
    path,
    "image/jpeg",
    100,
  ]);
  assert.equal(
    (await q("select count(*)::int n from storage.objects"))[0].n,
    1,
  );
  await as(c);
  await denied("select public.read_group_room($1,$2)", [room.key, seat]);
  await denied("select public.read_group_room_messages($1,$2)", [
    room.key,
    seat,
  ]);
  assert.equal(
    (await q("select count(*)::int n from storage.objects"))[0].n,
    0,
  );
  await denied(
    "insert into storage.objects(bucket_id,name,owner_id) values($1,$2,$3)",
    ["group-photos", room.key + "/attack.jpg", c],
  );
  await as(a);
  const ownMessage = (
    await q("select public.add_group_room_message($1,$2,'Owner message') r", [
      room.key,
      seat,
    ])
  )[0].r;
  assert.equal(ownMessage.senderName, "Owner");
  const month = (
    await q(
      "select to_char(now() at time zone 'Africa/Johannesburg','YYYY-MM') as current_month",
    )
  )[0].current_month;
  const plan = (
    await q("select public.plan_create($1::jsonb) p", [
      {
        title: "Private plan",
        kind: "expense",
        target: 0,
        start: month,
        day: 10,
        members: [
          { name: "Owner", cents: 1000 },
          { name: "Friend", cents: 1000 },
        ],
      },
    ])
  )[0].p;
  await as(c);
  await denied("select public.plan_read($1,null)", [plan.key]);
  await denied("select public.add_plan_message($1,null,'fake organiser')", [
    plan.key,
  ]);
  await as(b);
  await q("select public.plan_read($1,$2)", [plan.key, plan.members[1].token]);
  await q("select public.plan_action($1,$2,'preferences',$3,null,$4::jsonb)", [
    plan.key,
    plan.members[1].token,
    plan.members[1].id,
    { method: "manual", reminders: false, days: 7 },
  ]);
  await as(a);
  const projection = (
    await q("select public.plan_read($1,$2) p", [
      plan.key,
      plan.members[1].token,
    ])
  )[0].p;
  assert.equal(projection.members[1].reminders, undefined);
  assert.equal(projection.members[1].method, undefined);
  await as(c);
  await denied("select public.plan_read($1,$2)", [
    plan.key,
    plan.members[1].token,
  ]);
  await as(a);
  await q("select public.revoke_plan_invitation($1,$2)", [
    plan.key,
    plan.members[1].id,
  ]);
  await as(b);
  await denied("select public.plan_read($1,$2)", [
    plan.key,
    plan.members[1].token,
  ]);
  await as(a);
  await q("select public.revoke_group_invitation($1,$2)", [
    room.key,
    room.members[1].id,
  ]);
  await as(b);
  await denied("select public.read_group_room($1,$2)", [room.key, seat]);
  assert.equal(
    (await q("select count(*)::int n from storage.objects"))[0].n,
    0,
  );
  await denied("select public.wallet_action('add',1000,'fake',$1)", [
    crypto.randomUUID(),
  ]);
  await denied("select public.update_group_member($1,$2,'pay')", [
    room.key,
    seat,
  ]);
  await db.exec("reset role");
  assert.equal(
    (await q("select public from storage.buckets where id='group-photos'"))[0]
      .public,
    false,
  );
  await db.close();
  console.log(
    "PASS privacy SQL: owner/member/stranger isolation, signed-in invitation binding, private photos, genuine chat identity, private preferences, revocation and disabled fake payments.",
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
