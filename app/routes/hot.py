from flask import Blueprint, render_template
from app.models import Up, Hot, New, Original

bp = Blueprint('hot', __name__)


@bp.route('/hot')
def hot():
    # 获取各榜单数据（按排名排序）
    up_chart = Up.query.order_by(Up.rank).limit(20).all()
    hot_chart = Hot.query.order_by(Hot.rank).limit(20).all()
    new_chart = New.query.order_by(New.rank).limit(20).all()
    original_chart = Original.query.order_by(Original.rank).limit(20).all()

    return render_template('hot.html',
                           up_chart=up_chart,
                           hot_chart=hot_chart,
                           new_chart=new_chart,
                           original_chart=original_chart)