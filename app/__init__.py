# app/__init__.py
from flask import Flask
from config import Config


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    # 直接从模块的 routes 中导入蓝图（如果 __init__.py 未正确导出）
    from app.blueprints.hot.routes import hot_bp
    app.register_blueprint(hot_bp)

    # 其他蓝图的注册...

    return app