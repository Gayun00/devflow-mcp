import { Octokit } from "@octokit/rest";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function findOrCreatePr({ issueId }: { issueId: string }) {
  const token = process.env.GITHUB_TOKEN!;
  const repoInfo = process.env.GITHUB_REPO!;
  const base = process.env.GITHUB_BASE || "main";
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

  const prs = await octokit.pulls.list({
    owner,
    repo,
    head: `${owner}:${branch}`,
    state: "open",
  });

  const devflowSection = [
    "<!-- devflow-mcp-start -->",
    `## 🛠 devflow-mcp 업데이트`,
    `- 관련 이슈: ${issueId}`,
    `- 업데이트 시간: ${new Date().toISOString()}`,
    "",
    "🔧 자동으로 생성된 내용입니다. 해당 섹션은 덮어쓰기 됩니다.",
    "<!-- devflow-mcp-end -->",
  ].join("\n");

  const title = `${issueId}: WIP`;

  if (prs.data.length > 0) {
    const existingPr = prs.data[0];
    const existingBody = existingPr.body || "";

    let newBody: string;

    const hasDevflowBlock = existingBody.includes("<!-- devflow-mcp-start -->");

    if (hasDevflowBlock) {
      // 기존 블록 교체
      newBody = existingBody.replace(
        /<!-- devflow-mcp-start -->[\s\S]*?<!-- devflow-mcp-end -->/,
        devflowSection
      );
    } else {
      // 기존 본문 아래에 추가
      newBody = existingBody + "\n\n" + devflowSection;
    }

    await octokit.pulls.update({
      owner,
      repo,
      pull_number: existingPr.number,
      title: existingPr.title,
      body: newBody,
    });

    return { status: "UPDATED", url: existingPr.html_url };
  }

  const prBody = devflowSection;

  const pr = await octokit.pulls.create({
    owner,
    repo,
    head: branch,
    base,
    title,
    body: prBody,
  });

  return { status: "CREATED", url: pr.data.html_url };
}
