import os
import psycopg2

DATABASE_URL = "postgresql://neondb_owner:npg_ovJB0U4KWyHI@ep-twilight-darkness-aivktlz7-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"

conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

# Check specific pending_route (último de la UI)
pending_id = "d3c725ff-2224-4378-bc47-4d63860f38a8"

cur.execute("""
    select id::text, status, created_at, error
    from pending_routes
    where id = %s
""", (pending_id,))

row = cur.fetchone()
if row:
    pr_id, status, created_at, error = row
    print(f"📌 pending_route_id: {pr_id}")
    print(f"📊 Status: {status}")
    print(f"📅 Created: {created_at}")
    if error:
        print(f"❌ Error: {error}")
    
    # Check if there's an optimized result
    cur.execute("""
        select status, created_at
        from optimized_routes
        where pending_route_id = %s
        order by created_at desc
        limit 1
    """, (pending_id,))
    
    opt = cur.fetchone()
    if opt:
        opt_status, opt_created = opt
        print(f"✅ Optimized: {opt_status} at {opt_created}")
    else:
        print("⏳ No optimized result yet")
else:
    print("❌ Pending route not found")

# Check recent pending routes
print("\n🔍 Recent pending routes:")
cur.execute("""
    select id::text, status, created_at
    from pending_routes
    order by created_at desc
    limit 5
""")

for row in cur.fetchall():
    pr_id, status, created_at = row
    print(f"  {created_at}: {pr_id} - {status}")

cur.close()
conn.close()
