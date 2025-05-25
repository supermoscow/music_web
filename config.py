# config.py
import os

class Config:
    SECRET_KEY = os.urandom(24)
    SQLALCHEMY_DATABASE_URI = 'mysql+pymysql://root:123456@localhost:3306/music_db'
    SQLALCHEMY_TRACK_MODIFICATIONS = False