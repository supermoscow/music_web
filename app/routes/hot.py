from flask import Blueprint, render_template, request, abort
from app.models import Hot, New, Original, Up, Song
from sqlalchemy import and_

bp = Blueprint('hot', __name__, url_prefix='/hot')

# 音调映射字典
KEY_MAPPING = {
    1: 'C', 2: 'C#', 3: 'D', 4: 'D#', 5: 'E',
    6: 'F', 7: 'F#', 8: 'G', 9: 'G#', 10: 'A',
    11: 'A#', 12: 'B'
}


@bp.route('/')
def hot():
    """热门页主路由"""
    chart_data = {
        'hot': {'display': '热歌榜', 'songs': get_top_songs(Hot)},
        'new': {'display': '新歌榜', 'songs': get_top_songs(New)},
        'original': {'display': '原创榜', 'songs': get_top_songs(Original)},
        'up': {'display': '飙升榜', 'songs': get_top_songs(Up)}
    }
    return render_template('hot/hot.html',
                           charts=chart_data,
                           KEY_MAPPING=KEY_MAPPING)


@bp.route('/charts/<chart_type>')
def chart_detail(chart_type):
    """榜单详情页"""
    model = get_chart_model(chart_type)
    if not model:
        abort(404, description=f"无效的榜单类型: {chart_type}")

    songs = model.query.order_by(model.rank).all()
    return render_template('hot/chart_detail.html',
                           chart_type=chart_type.capitalize(),
                           songs=songs)


@bp.route('/search', methods=['GET', 'POST'])
def search():
    form_data = {
        'title': request.form.get('title', '').strip(),
        'artist': request.form.get('artist', '').strip(),
        'release': request.form.get('release', '').strip(),  # 改为release
        'key': request.form.get('key', ''),
        'tempo_min': request.form.get('tempo_min', '60'),
        'tempo_max': request.form.get('tempo_max', '180')
    }

    results = []
    search_count = 0
    error = None

    if request.method == 'POST':
        try:
            # 验证节奏范围
            tempo_min = int(form_data['tempo_min'])
            tempo_max = int(form_data['tempo_max'])
            if tempo_min > tempo_max:
                tempo_min, tempo_max = tempo_max, tempo_min

            # 构建查询
            query = Song.query
            if form_data['title']:
                query = query.filter(Song.title.ilike(f"%{form_data['title']}%"))
            if form_data['artist']:
                query = query.filter(Song.artist.ilike(f"%{form_data['artist']}%"))
            if form_data['release']:  # 模糊搜索发行公司
                query = query.filter(Song.release.ilike(f"%{form_data['release']}%"))

            # 调式筛选
            if form_data['key']:
                try:
                    key_number = [k for k, v in KEY_MAPPING.items() if v == form_data['key']][0]
                    query = query.filter(Song.key == key_number)
                except IndexError:
                    pass

            query = query.filter(and_(
                Song.tempo >= tempo_min,
                Song.tempo <= tempo_max
            ))

            results = query.order_by(Song.year.desc()).all()
            search_count = len(results)

        except ValueError:
            error = "请输入有效的节奏范围数值"

    return render_template('hot/search.html',
                           form_data=form_data,
                           results=results,
                           search_count=search_count,
                           error=error,
                           KEY_MAPPING=KEY_MAPPING)


# --------------------------
# 辅助函数
# --------------------------
def get_top_songs(model, limit=10):
    return model.query.order_by(model.rank).limit(limit).all()


def get_chart_model(chart_type):
    return {
        'hot': Hot,
        'new': New,
        'original': Original,
        'up': Up
    }.get(chart_type.lower())