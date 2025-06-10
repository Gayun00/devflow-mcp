import requests
from requests.auth import HTTPBasicAuth
import os
from dotenv import load_dotenv

load_dotenv()

JIRA_BASE_URL = os.getenv("JIRA_BASE_URL")
JIRA_EMAIL = os.getenv("JIRA_EMAIL")
JIRA_API_TOKEN = os.getenv("JIRA_API_TOKEN")

def extract_slack_links_from_adf(adf):
    links = []
    if adf.get("type") == "doc":
        for block in adf.get("content", []):
            if block.get("type") == "paragraph":
                for inline in block.get("content", []):
                    marks = inline.get("marks", [])
                    for mark in marks:
                        if mark.get("type") == "link":
                            href = mark.get("attrs", {}).get("href", "")
                            if "slack.com" in href:
                                links.append(href)
    return links

def get_jira_issue(issue_key: str):
  url = f"{JIRA_BASE_URL}/rest/api/3/issue/{issue_key}"
  res = requests.get(
    url,
    auth=HTTPBasicAuth(JIRA_EMAIL, JIRA_API_TOKEN),
    headers={"Accept": "application/json"}
  )
  return res.json()

def get_jira_issue_description(issue_key: str):
  json_data = get_jira_issue(issue_key)
  description = json_data["fields"]["description"]
  description_text = description["content"][0]["content"][0]["text"]
  slack_link = extract_slack_links_from_adf(description)[0]
  return description_text, slack_link

