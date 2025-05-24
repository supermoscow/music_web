import requests
import random
import sys
import os
import datetime
from bs4 import BeautifulSoup
from app import create_app, db
from app.models import Song, Comment  # 假设你有Comment模型

# 将项目根目录加入Python路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
]

headers = {
    'User-Agent': random.choice(USER_AGENTS),
    'Connection': 'keep-alive',
    'Accept-Language': 'zh-CN,zh;q=0.9'
}


def get_songs(topid):
    """获取榜单歌曲"""
    url = f"https://c.y.qq.com/v8/fcg-bin/fcg_v8_toplist_cp.fcg?topid={topid}"
    response = requests.get(url, headers=headers)
    return response.json().get("songlist", [])[:10]  # 取前10首


def save_song_to_db(song_data, top_type):
    """保存歌曲到数据库"""
    with create_app().app_context():
        song = Song(
            title=song_data['data']['songname'],
            artist=song_data['data']['singer'][0]['name'],
            play_count=song_data.get('Franking_value', 0),
            duration=song_data['data']['interval'],
            album=song_data['data']['albumname'],
            top_type=top_type,
            rank=song_data.get('rank', 0)
        )
        db.session.add(song)
        try:
            db.session.commit()
        except:
            db.session.rollback()


def get_comments(songid):
    """获取歌曲评论"""
    comments = []
    for page in range(3):  # 只爬3页评论
        url = f"https://c.y.qq.com/base/fcgi-bin/fcg_global_comment_h5.fcg?topid={songid}&pagenum={page}"
        response = requests.get(url, headers=headers)
        data = response.json()
        if data.get('comment', {}).get('commentlist'):
            comments.extend(data['comment']['commentlist'])
        time.sleep(1)  # 增加延迟
    return comments


def save_comments_to_db(comments, song_name):
    """保存评论到数据库"""
    with create_app().app_context():
        for comment in comments:
            new_comment = Comment(
                song_name=song_name,
                username=comment['nick'],
                content=comment.get('rootcommentcontent', ''),
                likes=comment['praisenum'],
                comment_time=datetime.datetime.fromtimestamp(comment['time'])
            )
            db.session.add(new_comment)
        try:
            db.session.commit()
        except:
            db.session.rollback()


def crawl_qq_music(topid, top_type):
    """主爬取函数"""
    songs = get_songs(topid)
    for song in songs:
        # 保存歌曲信息
        save_song_to_db(song, top_type)

        # 获取并保存评论
        songid = song['data']['songid']
        comments = get_comments(songid)
        if comments:
            save_comments_to_db(comments, song['data']['songname'])


if __name__ == '__main__':
    # 初始化Flask应用上下文
    app = create_app()
    with app.app_context():
        # 创建表（如果不存在）
        db.create_all()

        # 爬取飙升榜（示例ID）
        crawl_qq_music(62, 'up')

        # 爬取流行榜（示例ID）
        crawl_qq_music(4, 'popular')