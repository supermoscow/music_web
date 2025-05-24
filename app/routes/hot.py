from flask import Blueprint, render_template
from app.models import Up, Hot, New, Original

bp = Blueprint('hot', __name__)


@bp.route('/hot')
def show_hot_charts():
    try:
        # 获取各榜单数据（按排名排序）
        up_chart = Up.query.order_by(Up.rank).all()
        hot_chart = Hot.query.order_by(Hot.rank).all()
        new_chart = New.query.order_by(New.rank).all()
        original_chart = Original.query.order_by(Original.rank).all()

        return render_template('hot.html',
                               up_chart=up_chart,
                               hot_chart=hot_chart,
                               new_chart=new_chart,
                               original_chart=original_chart)
    except Exception as e:
        return f"数据库查询失败: {str(e)}", 500


def format_duration(seconds):
    """秒转换为分:秒格式"""
    return f"{seconds // 60}:{seconds % 60:02d}"


def init_app(app):
    app.add_template_filter(format_duration, 'format_duration')