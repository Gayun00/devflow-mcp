import { Octokit } from "@octokit/rest";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

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

  const title = `${issueId}: WIP`;
  const devflowSection = [
    "<!-- devflow-mcp-start -->",
    `## 🛠 devflow-mcp 업데이트`,
    `- 관련 이슈: ${issueId}`,
    `- 병합 대상 브랜치: ${base}`,
    `- 업데이트 시간: ${new Date().toISOString()}`,
    "",
    "🔧 자동으로 생성된 내용입니다.",
    "<!-- devflow-mcp-end -->",
  ].join("\n");

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
