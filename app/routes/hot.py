# app/blueprints/hot/routes.py
from flask import Blueprint, render_template
import sqlite3

hot_bp = Blueprint('hot', __name__, url_prefix='/hot')

def get_charts_data():
    conn = sqlite3.connect('your_database.db')  # 替换为你的数据库文件名
    cursor = conn.cursor()

    charts_data = {
        'up': [],
        'hot': [],
        'new': [],
        'original': []
    }

    tables = ['up', 'hot', 'new', 'original']
    for table in tables:
        cursor.execute(f"SELECT rank, name, time, singer, link FROM {table}")
        rows = cursor.fetchall()
        for row in rows:
            rank, name, time, singer, link = row
            charts_data[table].append({
                'rank': rank,
                'name': name,
                'time': time,
                'singer': singer,
                'link': link
            })

    conn.close()
    return charts_data

@hot_bp.route('/')
def index():
    charts_data = get_charts_data()
    return render_template('hot/index.html', charts=charts_data)