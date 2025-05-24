from flask import Blueprint, render_template
from app.models import Song
from app import db

bp = Blueprint('hot', __name__)

@bp.route('/')
def hot_list():
    try:
        # 获取热门歌曲（按播放量降序）
        songs = Song.query.order_by(Song.play_count.desc()).all()
        return render_template('hot.html', songs=songs)
    except Exception as e:
        return f"数据库查询失败: {str(e)}", 500