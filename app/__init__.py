from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate

db = SQLAlchemy()
migrate = Migrate()


def create_app():
    app = Flask(__name__)
    app.config.from_object('config.Config')

    # 注册自定义过滤器
    @app.template_filter('number_format')
    def number_format(value):
        """ 数字千分位格式化 """
        try:
            return "{:,}".format(int(value))
        except (ValueError, TypeError):
            return str(value)

    # 初始化数据库
    db.init_app(app)
    migrate.init_app(app, db)

    # 注册蓝图
    from app.routes.hot import  hot_bp
    from app.routes.index import index_bp

    app.register_blueprint(index_bp)
    app.register_blueprint(hot_bp, url_prefix='/hot')

    return app