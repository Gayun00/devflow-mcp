import { Octokit } from "@octokit/rest";
import { exec } from "child_process";
import { promisify } from "util";
import { OpenAI } from "openai";
import dotenv from "dotenv";
dotenv.config();

const execAsync = promisify(exec);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

const prompt = (diff: string) => `
다음은 코드 변경사항입니다:\n\n${diff}\n

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
`;

async function summarizeDiff(diff: string): Promise<string> {
  const completion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content:
          "You are a helpful assistant who summarizes Git diffs for pull requests.",
      },
      {
        role: "user",
        content: prompt(diff),
      },
    ],
  });

  return completion.choices[0].message.content || "(요약 실패)";
}

export async function findOrCreatePr({
  issueId,
  base = "main",
}: {
  issueId: string;
  base?: string;
}) {
  const token = process.env.GITHUB_TOKEN!;
  const repoInfo = process.env.GITHUB_REPO!;
  const [owner, repo] = repoInfo.split("/");
  const octokit = new Octokit({ auth: token });

  const { stdout: currentBranch } = await execAsync(
    `git rev-parse --abbrev-ref HEAD`
  );
  const branch = currentBranch.trim();

  const { stdout: lsRemote } = await execAsync(
    `git ls-remote --heads origin ${branch}`
  );
  const branchExists = lsRemote.includes(branch);

  if (!branchExists) {
    return {
      status: "BRANCH_NOT_FOUND",
      message: `❗ 원격 저장소에 브랜치 '${branch}'가 없습니다. 먼저 push 해주세요: git push origin HEAD:${branch}`,
    };
  }

  const { stdout: diff } = await execAsync(`git diff origin/${base}...HEAD`);
  const summary = await summarizeDiff(diff);

  const devflowSection = [
    "<!-- devflow-mcp-start -->",
    `## 🛠 devflow-mcp 업데이트`,
    `- 관련 이슈: ${issueId}`,
    `- 병합 대상 브랜치: ${base}`,
    `- 업데이트 시간: ${new Date().toISOString()}`,
    "",
    `## 작업 요약`,
    summary,
    "",
    "🔧 자동으로 생성된 내용입니다.",
    "<!-- devflow-mcp-end -->",
  ].join("\n");

  const title = `${issueId}: WIP`;

  const prs = await octokit.pulls.list({
    owner,
    repo,
    head: `${owner}:${branch}`,
    base,
    state: "open",
  });

  if (prs.data.length > 0) {
    const existingPr = prs.data[0];
    const existingBody = existingPr.body || "";

    const hasDevflowBlock = existingBody.includes("<!-- devflow-mcp-start -->");
    const newBody = hasDevflowBlock
      ? existingBody.replace(
          /<!-- devflow-mcp-start -->[\s\S]*?<!-- devflow-mcp-end -->/,
          devflowSection
        )
      : existingBody + "\n\n" + devflowSection;

    await octokit.pulls.update({
      owner,
      repo,
      pull_number: existingPr.number,
      title: existingPr.title,
      body: newBody,
    });

    return { status: "UPDATED", url: existingPr.html_url };
  }

  const pr = await octokit.pulls.create({
    owner,
    repo,
    head: branch,
    base,
    title,
    body: devflowSection,
  });

  return { status: "CREATED", url: pr.data.html_url };
}
