from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate

db = SQLAlchemy()
migrate = Migrate()


def create_app():
    app = Flask(__name__)
    app.config.from_object('config.Config')

    # 初始化扩展
    db.init_app(app)
    migrate.init_app(app, db)

    # 注册蓝图

    # 注册路由
    from .routes import index, hot, tool
    app.register_blueprint(index.bp)
    app.register_blueprint(hot.bp)
    app.register_blueprint(tool.bp)

    # 配置文件上传限制
    app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB

    return app