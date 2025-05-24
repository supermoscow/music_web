from flask import Blueprint, render_template

# 1. 创建蓝图对象
# - 第一个参数'index'是蓝图名称
# - __name__用于确定蓝图所在模块
bp = Blueprint('index', __name__)


# 2. 定义路由（绑定到蓝图）
@bp.route('/')
def index():
    # 3. 模拟数据（后续替换为数据库查询）
    mock_data = {
        'featured_songs': [
            {'id': 1, 'title': '热门歌曲1', 'artist': '歌手A'},
            {'id': 2, 'title': '最新单曲', 'artist': '歌手B'}
        ],
        'new_releases': [
            {'id': 3, 'title': '专辑主打', 'artist': '歌手C'}
        ]
    }

    # 4. 渲染模板并传递数据
    return render_template(
        'index.html',
        featured=mock_data['featured_songs'],
        new_releases=mock_data['new_releases']
    )