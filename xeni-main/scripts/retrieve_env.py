#!/usr/bin/env python3
"""
GitHub Secrets Recovery Tool
===========================
This script helps you recover your environment variables (like ENV_PRODUCTION)
and other repository secrets stored on GitHub by temporarily running a GitHub 
Actions workflow that prints them hex-encoded to the workflow logs.

It supports:
1. Guided Manual Flow (No token needed, uses git push/pull and manual log copy)
2. Fully Automated Flow (Requires a GitHub Personal Access Token - PAT)

Security note: 
After running, the workflow file and its run history are deleted to ensure no 
trace of the secrets remains on GitHub.
"""

import os
import sys
import re
import json
import base64
import time
import subprocess
import urllib.request
import urllib.error
import ssl

WORKFLOW_PATH = ".github/workflows/retrieve_secrets.yml"

WORKFLOW_TEMPLATE = """name: Retrieve Environment Secrets
on:
  push:
    paths:
      - '.github/workflows/retrieve_secrets.yml'
jobs:
  retrieve:
    runs-on: ubuntu-latest
    steps:
      - name: Output All Secrets
        env:
          ENV_PRODUCTION: ${{ secrets.ENV_PRODUCTION }}
          SSH_PRIVATE_KEY: ${{ secrets.SSH_PRIVATE_KEY }}
          SSH_HOST: ${{ secrets.SSH_HOST }}
          SSH_USER: ${{ secrets.SSH_USER }}
          APP_DIR: ${{ secrets.APP_DIR }}
          GHCR_TOKEN: ${{ secrets.GHCR_TOKEN }}
        run: |
          python3 -c "
          import os
          for name in ['ENV_PRODUCTION', 'SSH_PRIVATE_KEY', 'SSH_HOST', 'SSH_USER', 'APP_DIR', 'GHCR_TOKEN']:
              val = os.environ.get(name, '')
              print(f'===START_SECRET_{name}===')
              print(val.encode('utf-8').hex())
              print(f'===END_SECRET_{name}===')
          "
"""

def run_git_cmd(args):
    try:
        return subprocess.check_output(args, stderr=subprocess.DEVNULL).decode('utf-8').strip()
    except subprocess.CalledProcessError:
        return None

def get_repo_info():
    url = run_git_cmd(['git', 'config', '--get', 'remote.origin.url'])
    if not url:
        return None, None
    
    # Match SSH and HTTPS URLs for GitHub
    m = re.search(r'github\.com[:/]([^/]+)/([^/.]+)(?:\.git)?$', url)
    if m:
        return m.group(1), m.group(2)
    return None, None

def get_current_branch():
    branch = run_git_cmd(['git', 'branch', '--show-current'])
    if not branch:
        branch = run_git_cmd(['git', 'symbolic-ref', '--short', 'HEAD'])
    return branch or 'main'

def make_request(url, token, method='GET', data=None):
    headers = {
        'Authorization': f'Bearer {token}',
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'Secrets-Restorer-Script',
        'X-GitHub-Api-Version': '2022-11-28'
    }
    
    req_data = None
    if data:
        req_data = json.dumps(data).encode('utf-8')
        headers['Content-Type'] = 'application/json'
        
    req = urllib.request.Request(url, headers=headers, method=method, data=req_data)
    try:
        with urllib.request.urlopen(req) as response:
            status = response.getcode()
            resp_data = response.read()
            return status, resp_data, response.headers
    except urllib.error.HTTPError as e:
        return e.code, e.read(), None
    except Exception as e:
        return 0, str(e).encode('utf-8'), None

def check_repo_access(owner, repo, token):
    url = f"https://api.github.com/repos/{owner}/{repo}"
    status, content, _ = make_request(url, token)
    if status == 200:
        return True, None
    elif status == 401:
        return False, "Unauthorized: Your Personal Access Token (PAT) is invalid or expired."
    elif status == 403:
        return False, "Forbidden: Your token does not have permissions to access this repository."
    elif status == 404:
        return False, "Not Found: Repository not found or your token lacks permissions to see it."
    else:
        return False, f"HTTP Error {status}: {content.decode('utf-8', errors='ignore')}"

def commit_workflow_via_api(owner, repo, branch, token, content_str):
    # Check if file already exists to get SHA for updates
    url = f"https://api.github.com/repos/{owner}/{repo}/contents/{WORKFLOW_PATH}?ref={branch}"
    status, content, _ = make_request(url, token)
    
    sha = None
    if status == 200:
        file_info = json.loads(content.decode('utf-8'))
        sha = file_info.get('sha')
        
    put_url = f"https://api.github.com/repos/{owner}/{repo}/contents/{WORKFLOW_PATH}"
    payload = {
        "message": "ci: add temporary secrets retrieval workflow",
        "content": base64.b64encode(content_str.encode('utf-8')).decode('utf-8'),
        "branch": branch
    }
    if sha:
        payload["sha"] = sha
        
    status, resp_content, _ = make_request(put_url, token, method='PUT', data=payload)
    if status in (200, 201):
        resp_data = json.loads(resp_content.decode('utf-8'))
        commit_sha = resp_data.get('commit', {}).get('sha')
        return commit_sha
    else:
        print(f"❌ Failed to commit workflow file via API: {resp_content.decode('utf-8', errors='ignore')}")
        return None

def clean_log_line(line):
    # Match GitHub log timestamp format: "2026-06-08T10:47:19.1234567Z <content>"
    m = re.match(r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z\s?(.*)$', line)
    if m:
        return m.group(1)
    return line

def parse_secrets_from_log(log_text):
    secrets = {}
    lines = log_text.splitlines()
    in_secret = False
    current_secret = None
    secret_lines = []
    
    for line in lines:
        cleaned = clean_log_line(line)
        if "===START_SECRET_" in cleaned:
            m = re.search(r'===START_SECRET_([A-Z0-9_]+)===', cleaned)
            if m:
                current_secret = m.group(1)
                in_secret = True
                secret_lines = []
        elif "===END_SECRET_" in cleaned:
            if in_secret and current_secret:
                hex_content = "".join(secret_lines).strip()
                if hex_content:
                    try:
                        decoded = bytes.fromhex(hex_content).decode('utf-8', errors='ignore')
                        secrets[current_secret] = decoded
                    except Exception as e:
                        print(f"⚠️ Failed to decode secret {current_secret}: {e}")
                in_secret = False
                current_secret = None
        elif in_secret:
            secret_lines.append(cleaned.strip())
            
    return secrets

def save_secrets(secrets_dict):
    if not secrets_dict:
        print("\n❌ No secrets could be extracted. Please check the logs manually.")
        return
    
    # Filter empty secrets
    secrets_dict = {k: v for k, v in secrets_dict.items() if v}
    
    # 1. ENV_PRODUCTION -> .env
    env_data = secrets_dict.get('ENV_PRODUCTION')
    if env_data:
        print("\n📝 Found ENV_PRODUCTION secret.")
        print("Where would you like to write the .env files?")
        print("  [1] Root .env only (./.env) [Default]")
        print("  [2] All service directories (./.env, gateway/.env, frontend/.env, workers/.env)")
        print("  [3] Custom path")
        print("  [4] Do not save, print to console instead")
        
        choice = input("Enter choice (1-4): ").strip() or "1"
        
        if choice == "1":
            with open('.env', 'w') as f:
                f.write(env_data)
            print("✅ Saved root .env file successfully.")
        elif choice == "2":
            paths = ['.env', 'gateway/.env', 'frontend/.env', 'workers/.env']
            for path in paths:
                os.makedirs(os.path.dirname(path), exist_ok=True)
                with open(path, 'w') as f:
                    f.write(env_data)
                print(f"✅ Saved {path} successfully.")
        elif choice == "3":
            custom_path = input("Enter path (e.g. gateway/.env): ").strip()
            if custom_path:
                os.makedirs(os.path.dirname(custom_path), exist_ok=True)
                with open(custom_path, 'w') as f:
                    f.write(env_data)
                print(f"✅ Saved {custom_path} successfully.")
        elif choice == "4":
            print("\n--- ENV_PRODUCTION CONTENTS ---")
            print(env_data)
            print("--------------------------------\n")
    else:
        print("\n⚠️ ENV_PRODUCTION was not found or is empty.")
        
    # 2. SSH_PRIVATE_KEY
    ssh_key = secrets_dict.get('SSH_PRIVATE_KEY')
    if ssh_key:
        print("\n🔑 Found SSH_PRIVATE_KEY secret.")
        save_key = input("Would you like to save the SSH private key? (y/n) [n]: ").strip().lower()
        if save_key == 'y':
            key_path = input("Enter file name to save SSH key [id_rsa_recovered]: ").strip() or "id_rsa_recovered"
            with open(key_path, 'w') as f:
                f.write(ssh_key)
            try:
                os.chmod(key_path, 0o600)
                print(f"✅ Saved SSH private key to '{key_path}' and set permissions to 600.")
            except Exception as e:
                print(f"✅ Saved SSH private key to '{key_path}', but failed to set permissions: {e}")
            print(f"👉 To use this key, copy it to ~/.ssh/ and add it using: ssh-add ~/.ssh/{key_path}")
            
    # 3. Other metadata secrets
    meta_secrets = ['SSH_HOST', 'SSH_USER', 'APP_DIR', 'GHCR_TOKEN']
    found_meta = False
    for ms in meta_secrets:
        val = secrets_dict.get(ms)
        if val:
            if not found_meta:
                print("\n📋 Other retrieved configuration secrets:")
                found_meta = True
            print(f"  • {ms}: {val}")

def manual_flow(branch):
    print("\n--- Guided Manual Flow ---")
    print(f"1. Creating local workflow file at: {WORKFLOW_PATH}")
    os.makedirs(os.path.dirname(WORKFLOW_PATH), exist_ok=True)
    with open(WORKFLOW_PATH, 'w') as f:
        f.write(WORKFLOW_TEMPLATE)
        
    print("\n2. Run these commands in your terminal to commit and push the workflow:")
    print("------------------------------------------------------------")
    print(f"git add {WORKFLOW_PATH}")
    print("git commit -m \"temp: add secrets retrieval workflow\"")
    print(f"git push origin {branch}")
    print("------------------------------------------------------------")
    
    input("\nPress [Enter] after you have successfully pushed the workflow...")
    
    print("\n3. GitHub Actions is now running the workflow.")
    print("Go to your GitHub repository -> Actions tab -> 'Retrieve Environment Secrets'.")
    print("Wait for the run to complete. Go to the 'Output All Secrets' step inside the 'retrieve' job.")
    print("Copy the entire output log for that step (or the whole job log) and paste it here.")
    print("When done, press Ctrl+D (Linux/Mac) or Ctrl+Z (Windows) on a new line to submit.")
    print("------------------------------------------------------------")
    
    log_lines = sys.stdin.read()
    
    secrets = parse_secrets_from_log(log_lines)
    save_secrets(secrets)
    
    print(f"\n4. Cleaning up workflow file...")
    if os.path.exists(WORKFLOW_PATH):
        os.remove(WORKFLOW_PATH)
        
    print("\nRun these commands to clean up your remote repository:")
    print("------------------------------------------------------------")
    print(f"git rm {WORKFLOW_PATH}")
    print("git commit -m \"temp: clean up secrets retrieval workflow\"")
    print(f"git push origin {branch}")
    print("------------------------------------------------------------")

def automated_flow(owner, repo, branch):
    print("\n--- Fully Automated API Flow ---")
    pat = input("Enter your GitHub Personal Access Token (PAT): ").strip()
    if not pat:
        print("❌ PAT is required for automated flow.")
        return
        
    print("Checking repository access...")
    ok, err = check_repo_access(owner, repo, pat)
    if not ok:
        print(f"❌ Access check failed: {err}")
        return
    print("✅ Successfully authenticated.")
    
    print(f"Uploading temporary workflow to branch '{branch}'...")
    commit_sha = commit_workflow_via_api(owner, repo, branch, pat, WORKFLOW_TEMPLATE)
    if not commit_sha:
        return
    print(f"✅ Workflow committed successfully (Commit: {commit_sha[:7]}).")
    
    print("Waiting for GitHub Actions to register the run...")
    run_id = None
    for attempt in range(20):
        time.sleep(3)
        # Search runs
        url = f"https://api.github.com/repos/{owner}/{repo}/actions/runs?branch={branch}"
        status, content, _ = make_request(url, pat)
        if status == 200:
            data = json.loads(content.decode('utf-8'))
            runs = data.get('workflow_runs', [])
            for run in runs:
                if run.get('head_sha') == commit_sha:
                    run_id = run.get('id')
                    break
        if run_id:
            break
        print(".", end="", flush=True)
    
    if not run_id:
        print("\n❌ Timed out waiting for GitHub Actions run to start.")
        print("Please check the Actions tab on GitHub manually.")
        return
        
    print(f"\n✅ Found workflow run (ID: {run_id}). Monitoring progress...")
    
    # Poll for completion
    completed = False
    for attempt in range(40):
        url = f"https://api.github.com/repos/{owner}/{repo}/actions/runs/{run_id}"
        status, content, _ = make_request(url, pat)
        if status == 200:
            run_data = json.loads(content.decode('utf-8'))
            run_status = run_data.get('status')
            run_conclusion = run_data.get('conclusion')
            
            print(f"  • Run status: {run_status}...", flush=True)
            if run_status == 'completed':
                completed = True
                if run_conclusion != 'success':
                    print(f"❌ Run ended with conclusion: {run_conclusion}")
                    return
                break
        time.sleep(5)
        
    if not completed:
        print("❌ Timed out waiting for workflow run to complete.")
        return
        
    print("Fetching jobs...")
    url = f"https://api.github.com/repos/{owner}/{repo}/actions/runs/{run_id}/jobs"
    status, content, _ = make_request(url, pat)
    if status != 200:
        print("❌ Failed to fetch jobs for the workflow run.")
        return
        
    job_data = json.loads(content.decode('utf-8'))
    jobs = job_data.get('jobs', [])
    if not jobs:
        print("❌ No jobs found in the workflow run.")
        return
        
    job_id = jobs[0].get('id')
    print(f"Fetching logs for Job ID {job_id}...")
    log_url = f"https://api.github.com/repos/{owner}/{repo}/actions/jobs/{job_id}/logs"
    status, log_content, _ = make_request(log_url, pat)
    if status != 200:
        print("❌ Failed to download job logs.")
        return
        
    log_text = log_content.decode('utf-8', errors='ignore')
    secrets = parse_secrets_from_log(log_text)
    save_secrets(secrets)
    
    # Clean up workflow file
    print("\nCleaning up workflow file from repository...")
    if delete_workflow_file(owner, repo, branch, pat):
        print("✅ Workflow file deleted successfully from GitHub.")
    else:
        print("⚠️ Failed to delete workflow file automatically from GitHub. You should delete it manually.")
        
    # Clean up workflow run
    print("Deleting workflow run history...")
    url_delete_run = f"https://api.github.com/repos/{owner}/{repo}/actions/runs/{run_id}"
    status_del, _, _ = make_request(url_delete_run, pat, method='DELETE')
    if status_del == 204:
        print("✅ Workflow run deleted successfully from GitHub.")
    else:
        print("⚠️ Could not delete workflow run history. You can delete it manually via GitHub UI.")
        
    print("\n🎉 Secrets recovery complete!")

def main():
    print("=========================================")
    print("       GitHub Secrets Recovery Tool      ")
    print("=========================================")
    
    owner, repo = get_repo_info()
    if not owner or not repo:
        print("❌ Error: Could not determine GitHub owner/repository from git configuration.")
        print("Make sure you are running this from the root of a Git repository.")
        sys.exit(1)
        
    branch = get_current_branch()
    print(f"Target repository: {owner}/{repo}")
    print(f"Target branch: {branch}")
    print("=========================================")
    
    print("\nSelect recovery option:")
    print("  [1] Guided Manual Flow (No token needed, uses Git commands)")
    print("  [2] Fully Automated Flow (Requires a Personal Access Token)")
    
    choice = input("\nEnter option (1-2): ").strip()
    
    if choice == "1":
        manual_flow(branch)
    elif choice == "2":
        automated_flow(owner, repo, branch)
    else:
        print("❌ Invalid option. Exiting.")
        sys.exit(1)

if __name__ == "__main__":
    main()
