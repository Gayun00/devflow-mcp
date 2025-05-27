# github-history MCP

## Overview

**github-history MCP**는 코드 변경사항, Jira 이슈, 슬랙 스레드 내용을 기반으로  
GitHub Pull Request(PR)의 설명을 자동 생성하거나 업데이트하는 도구입니다.  
OpenAI API를 활용해 실무 수준의 명확한 PR 설명을 작성하며, Jira 이슈와 연동해 작업 이력을 체계적으로 관리할 수 있습니다.

---

## ✨ Features

- ✅ 코드 diff 기반 PR 설명 자동 생성 (OpenAI 활용)
- 🔗 Jira 이슈 ID 기반 PR 생성 또는 본문 업데이트
- 🔁 기존 PR이 있으면 본문만 업데이트, 없으면 새 PR 생성
- 📋 실무에 적합한 PR 템플릿 자동 적용

---

## ⚙️ Installation

1. 저장소 클론

   ```bash
   git clone https://github.com/Gayun00/devflow-mcp.git
   cd devflow-mcp
   ```

   의존성 설치

   ```bash
   pip install -r requirements.txt
   ```

   환경 변수 설정

   프로젝트 루트에 .env 파일을 생성하고 아래 내용을 입력하세요:

   ```env
   GITHUB_TOKEN=your_github_token
   GITHUB_REPO=Gayun00/devflow-mcp
   OPENAI_API_KEY=your_openai_api_key
   ```

   <br>

   🚀 Usage
   MCP 서버 실행
   로컬에서 MCP 서버를 실행하세요:

   ```bash
   python mcp_server.py
   ```

   MCP 서버가 실행되면 외부 도구(CLAUDE, Cursor 등)에서 명령어를 보낼 수 있습니다.

   <br>

   🧠 MCP 에이전트에서 사용하기 (Cursor, Claude 등)
   Cursor나 Claude는 내부적으로 MCP 에이전트를 통해 명령어를 전달합니다.
   아래와 같이 MCP 서버를 설정해주면 github-history MCP를 인식합니다:

   ```json
   {
     "mcpServers": {
       "github-history": {
         "command": "python3",
         "args": ["/FILE_PATH/mcp_server.py"]
       }
     }
   }
   ```

   "/FILE_PATH/mcp_server.py"는 MCP 서버 파일의 실제 경로로 바꿔주세요.

   <br>

   💬 명령어 사용 예시

   ```text
   /github issue_id=ABC-123
   ```

   옵션:

   - `issue_id`: 연동할 Jira 이슈 ID (예: ABC-123)
   - `base`: (선택) 병합 대상 브랜치 (기본값: main)

   예: `/github issue_id=ABC-123 base=dev`

   명령어 접두사(`/github`)는 MCP 에이전트 설정에 따라 생략하거나 변경할 수 있습니다.

   🔍 How it works
   현재 체크아웃된 브랜치 기준으로 git diff를 가져옵니다.

   원격 저장소에 브랜치가 없으면 push 안내 메시지를 반환합니다.

   diff를 요약하여 PR 설명을 자동 생성합니다.

   기존 PR이 있으면 본문을 업데이트하고, 없으면 새 PR을 생성합니다.

   <br>

   🔐 Environment Variables
   변수명 설명

   - `GITHUB_TOKEN`: GitHub Personal Access Token (repo 권한 필요)
   - `GITHUB_REPO`: 저장소명 (예: owner/repo)
   - `OPENAI_API_KEY`: OpenAI API Key

   <br>

   🧩 Coming Soon

   - Slack 스레드 요약 포함
   - GitHub Actions 자동화
   - 슬랙 연동 알림 기능
