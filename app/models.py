from app import db


# --------------------------
# 榜单表基类（抽象类）
# --------------------------
# models.py
class BaseChart(db.Model):
    __abstract__ = True
    rank = db.Column(db.Integer, primary_key=True, autoincrement=False)
    name = db.Column(db.String(100))
    singer = db.Column(db.String(50))
    time = db.Column(db.String(5))  # 允许NULL
    link = db.Column(db.String(200))

class Hot(BaseChart):
    __tablename__ = 'hot'


class New(BaseChart):
    __tablename__ = 'new'


class Original(BaseChart):
    __tablename__ = 'original'


class Up(BaseChart):
    __tablename__ = 'up'


# --------------------------
# 全量歌曲表
# --------------------------
# 音调映射字典（统一管理）
KEY_MAPPING = {
    1: 'C', 2: 'C#', 3: 'D', 4: 'D#', 5: 'E',
    6: 'F', 7: 'F#', 8: 'G', 9: 'G#', 10: 'A',
    11: 'A#', 12: 'B'
}


class Song(db.Model):
    __tablename__ = 'songs'

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100))
    artist = db.Column(db.String(50))
    key = db.Column(db.Integer)  # 改为整数类型
    tempo = db.Column(db.Integer)
    year = db.Column(db.Integer)
    release = db.Column(db.String(100))  # album改为release
    duration = db.Column(db.Integer)