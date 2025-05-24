from app import db

class BaseChart(db.Model):
    __abstract__ = True  # 抽象基类
    rank = db.Column(db.Integer, primary_key=True)  # 使用rank作为主键
    name = db.Column(db.String(100))
    time = db.Column(db.Integer)  # 单位：秒
    singer = db.Column(db.String(50))
    link = db.Column(db.String(200))

# 各榜单模型（直接继承基类）
class Up(BaseChart):
    __tablename__ = 'up'

class Hot(BaseChart):
    __tablename__ = 'hot'

class New(BaseChart):
    __tablename__ = 'new'

class Original(BaseChart):
    __tablename__ = 'original'