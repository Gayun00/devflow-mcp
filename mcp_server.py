# server.py
from mcp.server.fastmcp import FastMCP
import sys
from tools.github_tools import find_or_create_pr

# Create an MCP server
mcp = FastMCP("Demo")


# Add an addition tool
@mcp.tool()
def add(a: int, b: int) -> int:
    """Add two numbers"""
    print(f"Adding {a} and {b}", file=sys.stderr)
    return a + b


# Add a dynamic greeting resource
@mcp.resource("greeting://{name}")
def get_greeting(name: str) -> str:
    """Get a personalized greeting"""
    print(f"Greeting requested for {name}", file=sys.stderr)
    return f"Hello, {name}!"

# Add MCP test tool
@mcp.tool()
def mcp_test() -> str:
    """Test if MCP server is connected"""
    print("MCP connection test requested", file=sys.stderr)
    return "MCP 서버가 정상적으로 연결되었습니다! 🎉"

# Add GitHub PR creation tool
@mcp.tool()
def github(issue_id: str = None, base: str = "main") -> str:
    """GitHub PR을 생성하거나 업데이트합니다"""
    if not issue_id:
        return "이슈 ID를 입력해주세요. 예: /github issue_id=ABC-123"
    
    try:
        result = find_or_create_pr(issue_id, base)
        if result["status"] == "BRANCH_NOT_FOUND":
            return result["message"]
        elif result["status"] == "UPDATED":
            return f"PR이 업데이트되었습니다: {result['url']}"
        else:  # CREATED
            return f"새 PR이 생성되었습니다: {result['url']}"
    except Exception as e:
        return f"오류가 발생했습니다: {str(e)}"

if __name__ == "__main__":
    print("MCP 서버가 시작됩니다...", file=sys.stderr)
    mcp.run()  # 서버 실행