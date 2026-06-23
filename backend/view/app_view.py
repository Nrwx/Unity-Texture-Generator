#SOURCE: view/{{blueprint}}_view.py
from flask import Blueprint, jsonify
from view.base.main import BaseView

router_{{blueprint}} = Blueprint("{{blueprint}}", __name__)

class {{blueprint|capitalize}}View(BaseView):
    @property
    def _controller(self):
        return getattr(router_{{blueprint}}, "_controller", None)
    @property
    def _parser(self):
        return getattr(router_{{blueprint}}, "_parser", None)
    @property
    def _route(self) -> str:
        return {{blueprint|json}}
    # --- Routen ---
    {% for i, data in routes %}
    def {{ data.function }}(self{% if data?.keys %},{% endif %}{{ data?.keys ?? "" }}):
        if not self._controller:
            return jsonify({"error": "Kein Controller registriert"}), 500
        try:
            {% if data?.value %}
                result = self._controller.{{ data.value }}({{ data?.keys ?? "" }})
            {% endif %}
        except Exception as e:
            return self._server_error(e)
        return result
{% endfor %}

{{blueprint}}_view = {{blueprint|capitalize}}View()

# --- Routen ---
{% for i, data in routes %}
@router_{{blueprint}}.route("{{ data?.url ?? url }}"{% if data?.methods %}, methods={{ data?.methods|json }}{% endif %})
def {{ data.function }}({{ data?.keys ?? "" }}):
    return {{blueprint}}_view.{{ data.function }}({{ data?.keys ?? "" }})
{% endfor %}


