from flask import request, jsonify
from typing import Any, Tuple, Dict

class BaseView:
    _route = None
    _controller = None
    _parser = None

    def _handle(self, req) -> Tuple[Any, int, Any]:
        if not self._controller:
            return {"error": "Kein Controller registriert"}, 500

        try:
            if request.method == 'GET':
                try:
                    result = self._controller.fetch()
                except Exception as e:
                    return jsonify({"error": str(e)}), 500
            elif request.method == 'POST':
                try:
                    result = self._controller.handle(self._route, req.form, req.files)
                except Exception as e:
                    return jsonify({"error": str(e)}), 500
            else:
                    return jsonify({"error": str(e)}), 500
        except Exception as e:
            return {"error": str(e)}, 500

        response, status = self._parser.parse_response(result)

        return jsonify(response), status

    def dispatch(self):
        return self._handle(request)