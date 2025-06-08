from urllib.parse import urlparse, parse_qs
import requests
import os
from dotenv import load_dotenv

load_dotenv()

SLACK_BOT_TOKEN = os.getenv("SLACK_BOT_TOKEN")
TEST_SLACK_LINK ="https://ddd-kj56981.slack.com/archives/C090JKLT2SY/p1749402998671309?thread_ts=1749402998.671309&cid=C090JKLT2SY"


def parse_slack_thread_info(link: str):
    parsed_url = urlparse(link)
    query = parse_qs(parsed_url.query)
    path_parts = parsed_url.path.strip("/").split("/")
    
    channel = path_parts[1] if len(path_parts) >= 2 else None
    thread_ts_raw = query.get("thread_ts", [None])[0]

    return channel, thread_ts_raw


def get_slack_thread_messages(channel_id: str, thread_ts: str, token: str):
    url = "https://slack.com/api/conversations.replies"
    headers = {
        "Authorization": f"Bearer {token}"
    }
    params = {
        "channel": channel_id,
        "ts": thread_ts
    }
    response = requests.get(url, headers=headers, params=params)
    data = response.json()

    if not data.get("ok"):
        raise Exception(f"Slack API 오류: {data.get('error')}")

    return data["messages"]


def extract_texts_from_slack_messages(messages):
    return [
        m['text']
        for m in messages
        if 'text' in m and m.get('subtype') != 'bot_message'
    ]

def get_slack_message_text(messages):
    channel, thread_ts_raw = parse_slack_thread_info(TEST_SLACK_LINK)
    messages = get_slack_thread_messages(channel, thread_ts_raw,SLACK_BOT_TOKEN)
    messages_text = extract_texts_from_slack_messages(messages)
    return messages_text