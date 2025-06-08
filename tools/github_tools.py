import os
import subprocess
from datetime import datetime
from github import Github
from openai import OpenAI
from dotenv import load_dotenv
import sys
from pathlib import Path
import subprocess
from tools.prompt import prompt
  
load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
GITHUB_REPO = os.getenv("GITHUB_REPO")  # "owner/repo" 형태

openai = OpenAI(api_key=OPENAI_API_KEY)


def run_cmd(cmd: str, cwd: Path = None) -> str:
    result = subprocess.run(
        cmd, shell=True, capture_output=True, text=True, cwd=str(cwd) if cwd else None
    )
    if result.returncode != 0:
        raise RuntimeError(f"Command failed: {cmd}\n{result.stderr}")
    return result.stdout.strip()


def summarize_diff(diff: str) -> str:
    completion = openai.chat.completions.create(
        model="gpt-4",
        messages=[
            {"role": "system", "content": "You are a helpful assistant who summarizes Git diffs for pull requests."},
            {"role": "user", "content": prompt(diff)},
        ],
    )
    return completion.choices[0].message.content or "(요약 실패)"

def find_git_root(start_dir: Path) -> Path:
    current = start_dir.resolve()
    for parent in [current] + list(current.parents):
        if (parent / ".git").exists():
            return parent
    raise RuntimeError("❌ .git 디렉토리를 찾을 수 없습니다.")


def find_or_create_pr(issue_id: str, base: str = "main"):
    g = Github(GITHUB_TOKEN)
    repo = g.get_repo(GITHUB_REPO)
    GIT_DIRECTORY_PATH = find_git_root(Path(sys.argv[0]))

    branch = run_cmd("git rev-parse --abbrev-ref HEAD", cwd=GIT_DIRECTORY_PATH)

    ls_remote = run_cmd(f"git ls-remote --heads origin {branch}", cwd=GIT_DIRECTORY_PATH)
    if branch not in ls_remote:
        return {
            "status": "BRANCH_NOT_FOUND",
            "message": f"❗ 원격 저장소에 브랜치 '{branch}'가 없습니다. 먼저 push 해주세요: git push origin HEAD:{branch}",
        }

    diff = run_cmd(f"git diff origin/{base}...HEAD", cwd=GIT_DIRECTORY_PATH)


    summary = summarize_diff(diff)

    now = datetime.now()
    formatted = now.strftime("%Y.%m-%d %H:%M:%S")

    devflow_section = "\n".join([
        "<!-- devflow-mcp-start -->",
        "## 🛠 devflow-mcp 업데이트",
        f"- 관련 이슈: {issue_id}",
        f"- 병합 대상 브랜치: {base}",
        f"- 업데이트 시간: {formatted}",
        "",
        "## 작업 요약",
        summary,
        "",
        "🔧 자동으로 생성된 내용입니다.",
        "<!-- devflow-mcp-end -->",
    ])

    title = f"{issue_id}: WIP"

    pulls = repo.get_pulls(state="open", head=f"{repo.owner.login}:{branch}", base=base)
    pulls = list(pulls)
    if pulls:
        pr = pulls[0]
        existing_body = pr.body or ""
        if "<!-- devflow-mcp-start -->" in existing_body:
            import re
            new_body = re.sub(
                r"<!-- devflow-mcp-start -->[\s\S]*?<!-- devflow-mcp-end -->",
                devflow_section,
                existing_body,
            )
        else:
            new_body = existing_body + "\n\n" + devflow_section
        pr.edit(title=pr.title, body=new_body)
        return {"status": "UPDATED", "url": pr.html_url}

    pr = repo.create_pull(
        title=title,
        body=devflow_section,
        head=branch,
        base=base,
    )
    return {"status": "CREATED", "url": pr.html_url}

# 테스트 코드 
# if __name__ == "__main__":
#     try:
#         result = find_or_create_pr("TEST-123", "dev")
#         print("PR 생성/업데이트 결과:", result)
#     except Exception as e:
#         print("에러 발생:", str(e))
