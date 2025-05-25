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
    from app.routes.index import bp as index_bp
    from app.routes.hot import bp as hot_bp
    app.register_blueprint(index_bp)
    app.register_blueprint(hot_bp, url_prefix='/hot')

    return app