from app import db

# 公共基类
class BaseChart(db.Model):
    __abstract__ = True
    rank = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100))
    time = db.Column(db.Integer)  # 单位：秒
    singer = db.Column(db.String(50))
    link = db.Column(db.String(200))  # 歌曲链接

# 各榜单模型
class Up(BaseChart):
    __tablename__ = 'up'

class Hot(BaseChart):
    __tablename__ = 'hot'

class New(BaseChart):
    __tablename__ = 'new'

class Original(BaseChart):
    __tablename__ = 'original'