from flask import Blueprint, render_template

studio_bp = Blueprint('studio', __name__, url_prefix='/studio')

@studio_bp.route('/')
def studio():
    return render_template('studio/studio.html')

