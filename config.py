import os


class Config:
    SECRET_KEY = os.urandom(24)
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # 多数据库配置
    SQLALCHEMY_BINDS = {
        'charts': 'mysql+pymysql://root:123456@localhost:3306/music_db',
        'songs': 'mysql+pymysql://root:123456@localhost:3306/music_db_all'
    }