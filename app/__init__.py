from flask import Flask
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


def create_app(config_class='config.Config'):
    app = Flask(__name__)
    app.config.from_object(config_class)

    # 注册模板过滤器
    register_template_filters(app)

    # 初始化数据库
    db.init_app(app)

    # 注册蓝图
    from app.routes.index import bp as index_bp
    from app.routes.hot import bp as hot_bp

    app.register_blueprint(index_bp)
    app.register_blueprint(hot_bp, url_prefix='/hot')

    return app


def register_template_filters(app):
    @app.template_filter('number_format')
    def number_format(value):
        """ 数字千分位格式化 """
        try:
            return "{:,}".format(int(value))
        except (ValueError, TypeError):
            return str(value)