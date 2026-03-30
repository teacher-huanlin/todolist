from flask import Flask, render_template
from config import Config
import requests
import json
import time

app = Flask(__name__)
app.config.from_object(Config)

# 缓存 access_token
ACCESS_TOKEN = {
    "token": None,
    "expire_time": 0
}

def get_access_token():
    """获取飞书开放平台 access_token"""
    if ACCESS_TOKEN["token"] and ACCESS_TOKEN["expire_time"] > time.time():
        return ACCESS_TOKEN["token"]

    url = "https://open.feishu.cn/open-apis/auth/v3/app_access_token/internal"
    headers = {"Content-Type": "application/json"}
    payload = {
        "app_id": app.config['FEISHU_APP_ID'],
        "app_secret": app.config['FEISHU_APP_SECRET']
    }
    response = requests.post(url, headers=headers, data=json.dumps(payload))
    result = response.json()

    if result.get("code") == 0:
        ACCESS_TOKEN["token"] = result["app_access_token"]
        ACCESS_TOKEN["expire_time"] = time.time() + result["expire"] - 60  # 提前60秒过期
        return ACCESS_TOKEN["token"]
    else:
        print(f"获取 access_token 失败: {result}")
        return None

def get_bitable_records(base_id, table_id):
    """从飞书多维表格获取记录"""
    access_token = get_access_token()
    if not access_token:
        return []

    url = f"https://open.feishu.cn/open-apis/bitable/v1/apps/{base_id}/tables/{table_id}/records"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }
    response = requests.get(url, headers=headers)
    result = response.json()

    if result.get("code") == 0:
        records = result.get("data", {}).get("items", [])
        articles = []
        for record in records:
            fields = record.get("fields", {})
            articles.append({
                'id': record.get("id"),
                'title': fields.get("标题", ""),
                'golden_quote': fields.get("金句输出", ""),
                'review': fields.get("黄叔点评", ""),
                'summary': fields.get("概要内容输出", "")[:100], # 首页预览100字
                'content': fields.get("完整文章内容", "") # 假设有一个字段存储完整内容
            })
        return articles
    else:
        print(f"获取多维表格记录失败: {result}")
        return []

@app.route('/')
def index():
    articles = get_bitable_records(app.config['BASE_ID'], app.config['TABLE_ID'])
    return render_template('index.html', articles=articles)

@app.route('/article/<string:article_id>') # 将 int 改为 string 以匹配飞书记录ID
def article_detail(article_id):
    all_articles = get_bitable_records(app.config['BASE_ID'], app.config['TABLE_ID'])
    article = next((a for a in all_articles if a['id'] == article_id), None)
    if article:
        return render_template('detail.html', article=article)
    else:
        return "文章未找到", 404

if __name__ == '__main__':
    app.run(debug=True, port=5001)