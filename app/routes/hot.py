from flask import Blueprint, render_template, request, abort
from app.models import Hot, New, Original, Up, Song
from collections import Counter

bp = Blueprint('hot', __name__, url_prefix='/hot')


@bp.route('/')
def hot():
    """热门页主路由"""
    # 获取各榜单前10歌曲
    chart_data = {
        'hot': get_top_songs(Hot),
        'new': get_top_songs(New),
        'original': get_top_songs(Original),
        'up': get_top_songs(Up)
    }
    return render_template('hot/hot.html', charts=chart_data)


@bp.route('/charts')
def all_charts():
    """全部榜单列表页"""
    return render_template('hot/charts.html')


@bp.route('/charts/<chart_type>')
def chart_detail(chart_type):
    """榜单详情页（带展开功能）"""
    model = get_chart_model(chart_type)
    if not model:
        abort(404, description="无效的榜单类型")

    all_songs = model.query.order_by(model.rank).all()
    return render_template('hot/chart_detail.html',
                           chart_type=chart_type,
                           all_songs=all_songs)

# 搜索页面（集成结果显示）
@bp.route('/search', methods=['GET', 'POST'])
def search():
    form_data = initialize_form_data()
    results = []
    search_count = 0

    if request.method == 'POST':
        form_data = get_form_data(request.form)
        results, search_count = perform_search(form_data)

    return render_template('hot/search.html',
                           form_data=form_data,
                           results=results,
                           search_count=search_count)


# --------------------------
# 辅助函数
# --------------------------

def get_top_songs(model, limit=10):
    """获取指定榜单前N首歌曲"""
    return model.query.order_by(model.rank).limit(limit).all()


def generate_word_cloud():
    """生成词云数据"""
    words = []
    # 从三个字段提取关键词
    for field in [Song.title, Song.artist, Song.album]:
        records = Song.query.with_entities(field).all()
        for record in records:
            words.extend(str(record[0]).split())

    word_counts = Counter(words)
    return [{"text": k, "size": int(v)} for k, v in word_counts.most_common(30)]

def get_chart_model(chart_type):
    """获取对应的榜单模型"""
    model_map = {
        'hot': Hot,
        'new': New,
        'original': Original,
        'up': Up
    }
    return model_map.get(chart_type.lower())


def initialize_form_data():
    """初始化空表单数据"""
    return {
        'title': '',
        'artist': '',
        'album': '',
        'key': '',
        'tempo_min': '60',
        'tempo_max': '180'
    }


def get_form_data(form):
    """从表单获取数据并格式化"""
    return {
        'title': form.get('title', '').strip(),
        'artist': form.get('artist', '').strip(),
        'album': form.get('album', '').strip(),
        'key': form.get('key', ''),
        'tempo_min': form.get('tempo_min', '60'),
        'tempo_max': form.get('tempo_max', '180')
    }


def perform_search(form_data):
    """执行搜索查询"""
    query = Song.query

    # 文本过滤
    if form_data['title']:
        query = query.filter(Song.title.ilike(f"%{form_data['title']}%"))
    if form_data['artist']:
        query = query.filter(Song.artist.ilike(f"%{form_data['artist']}%"))
    if form_data['album']:
        query = query.filter(Song.album == form_data['album'])

    # 调式筛选
    if form_data['key']:
        query = query.filter(Song.key == form_data['key'])

    # 处理节奏范围
    try:
        tempo_min = int(form_data['tempo_min'])
        tempo_max = int(form_data['tempo_max'])
        if tempo_min > tempo_max:
            tempo_min, tempo_max = tempo_max, tempo_min
        query = query.filter(Song.tempo.between(tempo_min, tempo_max))
    except ValueError:
        pass

    results = query.order_by(Song.year.desc()).all()
    return results, len(results)