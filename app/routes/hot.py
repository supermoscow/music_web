from flask import Blueprint, render_template

bp = Blueprint('hot', __name__)

@bp.route('/')
def hot_list():
    # 测试数据（后续替换为数据库查询）
    test_data = [
        {'id': 1, 'title': '测试歌曲1', 'play_count': 150000},
        {'id': 2, 'title': '测试歌曲2', 'play_count': 120000}
    ]
    return render_template('hot.html', songs=test_data)