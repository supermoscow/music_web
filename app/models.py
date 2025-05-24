from app import db
from datetime import datetime

class Song(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100))
    artist = db.Column(db.String(50))
    play_count = db.Column(db.Integer)
    duration = db.Column(db.Integer)  # 时长(秒)
    album = db.Column(db.String(100))
    top_type = db.Column(db.String(20))  # 榜单类型
    rank = db.Column(db.Integer)  # 排名
    created_at = db.Column(db.DateTime, default=datetime.now)

class Comment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    song_name = db.Column(db.String(100))
    username = db.Column(db.String(50))
    content = db.Column(db.Text)
    likes = db.Column(db.Integer)
    comment_time = db.Column(db.DateTime)