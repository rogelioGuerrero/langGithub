import requests
import json
import os

# Check if GitHub Actions is enabled and workflow exists
token = "YOUR_PAT_HERE"  # You need to provide a valid PAT with repo scope
owner = "rogelioGuerrero"
repo = "langGithub"

# Check workflow runs
url = f"https://api.github.com/repos/{owner}/{repo}/actions/runs"
headers = {
    "Authorization": f"token {token}",
    "Accept": "application/vnd.github+json"
}

print("🔍 Checking GitHub Actions status...")
print("-" * 50)

# First check if Actions is enabled
try:
    resp = requests.get(f"https://api.github.com/repos/{owner}/{repo}/actions", headers=headers)
    if resp.status_code == 404:
        print("❌ GitHub Actions might be disabled for this repo")
        print("   Go to: https://github.com/rogelioGuerrero/langGithub/actions")
        print("   Click 'I understand my workflows, go ahead and enable them'")
    elif resp.ok:
        print("✅ GitHub Actions is enabled")
    else:
        print(f"Status: {resp.status_code}")
except Exception as e:
    print(f"Error checking Actions: {e}")

# Check workflow runs
print("\nChecking recent workflow runs...")
try:
    resp = requests.get(url, headers=headers)
    if resp.ok:
        data = resp.json()
        runs = data.get("workflow_runs", [])
        
        if not runs:
            print("❌ No workflow runs found")
            print("   Make sure the workflow file exists at:")
            print("   .github/workflows/optimizer.yml")
        else:
            print(f"Found {len(runs)} recent runs:")
            for run in runs[:3]:
                print(f"\n  📋 {run['name']}")
                print(f"     Status: {run['status']}")
                print(f"     Conclusion: {run['conclusion']}")
                print(f"     Event: {run['event']}")
                print(f"     Created: {run['created_at']}")
                
                # Get workflow details
                if run['conclusion'] == 'failure':
                    jobs_url = run['jobs_url']
                    jobs_resp = requests.get(jobs_url, headers=headers)
                    if jobs_resp.ok:
                        jobs = jobs_resp.json().get('jobs', [])
                        for job in jobs:
                            if job['conclusion'] == 'failure':
                                print(f"     ❌ Job failed: {job['name']}")
                                print(f"        Error: {job.get('steps', [])[-1].get('conclusion', 'N/A')}")
    else:
        print(f"❌ Failed to get runs: {resp.status_code}")
        print(f"   Make sure your PAT has 'repo' scope")
        
except Exception as e:
    print(f"Error: {e}")

# Check specific pending_route
print("\nChecking specific pending_route...")
pending_id = "33dc53fa-d409-421a-884f-8bbb214d5860"

# Check in Neon
import psycopg2
try:
    conn = psycopg2.connect("postgresql://neondb_owner:npg_ovJB0U4KWyHI@ep-twilight-darkness-aivktlz7-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require")
    cur = conn.cursor()
    
    cur.execute("""
        select status, created_at, error
        from pending_routes
        where id = %s
    """, (pending_id,))
    
    row = cur.fetchone()
    if row:
        status, created_at, error = row
        print(f"📌 Status in DB: {status}")
        print(f"   Created: {created_at}")
        if error:
            print(f"   Error: {error}")
    else:
        print("❌ Pending route not found in DB")
        
    cur.close()
    conn.close()
except Exception as e:
    print(f"Error checking DB: {e}")
