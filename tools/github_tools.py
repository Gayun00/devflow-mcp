import os
import subprocess
from datetime import datetime
from github import Github
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
GITHUB_REPO = os.getenv("GITHUB_REPO")  # "owner/repo" 형태

openai = OpenAI(api_key=OPENAI_API_KEY)


def prompt(diff: str) -> str:
    return f"""
다음은 코드 변경사항입니다:\n\n{diff}\n

이 변경사항을 바탕으로, 실무 개발자가 작성하는 수준의 PR 디스크립션을 작성하세요. 다음 조건을 반드시 따르세요:

1. 코드를 보지 않아도 PR만으로 변경 목적과 맥락을 이해할 수 있도록 설명하세요.
2. 단순히 어떤 파일이 바뀌었는지가 아니라, **왜 바뀌었는지**, **어떤 문제가 있었고 어떻게 해결했는지**에 집중하세요.
3. PR은 다음 템플릿에 맞춰 작성하세요:

---

## 🧾 Overview
(전반적인 작업 요약 - 한두 문장)

## 🧩 History

**[현상]**
- 어떤 문제가 리포트되었는가? 어떤 유저 상황에서 발생했는가?

**[원인]**
- 어떤 조건, 누락, 로직 오류가 문제였는가?

**[해결]**
- 어떤 방식으로 구조를 수정하거나 기능을 추가했는가?

## 📝 Note
- 어떤 부분을 중점적으로 리뷰해야 하는가?
- QA나 다른 개발자가 주의해야 할 사항이 있는가?
- 향후 리팩터링 또는 개선이 필요한 포인트가 있는가?

🔧 자동으로 생성된 내용입니다.
"""

def run_cmd(cmd: str) -> str:
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
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

def find_or_create_pr(issue_id: str, base: str = "main"):
    g = Github(GITHUB_TOKEN)
    repo = g.get_repo(GITHUB_REPO)

    branch = run_cmd("git rev-parse --abbrev-ref HEAD")
    ls_remote = run_cmd(f"git ls-remote --heads origin {branch}")
    if branch not in ls_remote:
        return {
            "status": "BRANCH_NOT_FOUND",
            "message": f"❗ 원격 저장소에 브랜치 '{branch}'가 없습니다. 먼저 push 해주세요: git push origin HEAD:{branch}",
        }

    diff = run_cmd(f"git diff origin/{base}...HEAD")
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

# 테스트 코드 추가
if __name__ == "__main__":
    try:
        result = find_or_create_pr("TEST-123", "dev")
        print("PR 생성/업데이트 결과:", result)
    except Exception as e:
        print("에러 발생:", str(e))
