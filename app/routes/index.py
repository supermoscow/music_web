from flask import Blueprint, render_template

bp = Blueprint('index', __name__)

@bp.route('/')
def index():
    # 模拟数据
    mock_data = {
        'featured': [
            {'title': '热门歌曲1', 'artist': '歌手A'},
            {'title': '最新单曲', 'artist': '歌手B'}
        ]
    }
    return render_template('index.html', **mock_data)