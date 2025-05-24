# app/blueprints/hot/routes.py
from flask import Blueprint, render_template

hot_bp = Blueprint('hot', __name__, url_prefix='/hot')

@hot_bp.route('/')
def index():
    return render_template('hot/index.html')

@hot_bp.route('/charts')
def charts():
    # 模拟数据（实际应从数据库获取）
    charts_data = {
        'domestic': [
            {'title': '晴天', 'artist': '周杰伦', 'score': 98.5, 'change': 2,
             'cover_url': 'https://picsum.photos/id/1074/60/60',
             'release_date': '2003-07-31',
             'tags': [{'name': '流行', 'color': 'green'}, {'name': '经典', 'color': 'blue'}],
             'description': '《晴天》是周杰伦演唱的一首经典歌曲...'
            },
            # 其他歌曲...
        ],
        'western': [
            # 欧美歌曲...
        ],
        'japan_korea': [
            # 日韩歌曲...
        ]
    }
    return render_template('hot/charts.html', charts=charts_data)