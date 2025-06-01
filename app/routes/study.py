from flask import Blueprint, render_template

study_bp = Blueprint('study', __name__, url_prefix='/study')

@study_bp.route('/')
def study():
    return render_template('study/study.html')
