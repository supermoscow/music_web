from app import db

# 榜单数据库模型 ----------------------------
class BaseChart(db.Model):
    __abstract__ = True
    __bind_key__ = 'charts'  # 绑定到charts数据库
    rank = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100))
    time = db.Column(db.Integer)  # 单位：秒
    singer = db.Column(db.String(50))
    link = db.Column(db.String(200))  # 歌曲链接

class Up(BaseChart):
    __tablename__ = 'up'

class Hot(BaseChart):
    __tablename__ = 'hot'

class New(BaseChart):
    __tablename__ = 'new'

class Original(BaseChart):
    __tablename__ = 'original'

# 全量歌曲库模型 ----------------------------
class Song(db.Model):
    __bind_key__ = 'songs'  # 绑定到songs数据库
    __tablename__ = 'songs'
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100))
    artist = db.Column(db.String(50))
    key = db.Column(db.String(20))
    tempo = db.Column(db.Integer)
    year = db.Column(db.Integer)
    album = db.Column(db.String(100))
    duration = db.Column(db.Integer)  # 歌曲时长（秒）