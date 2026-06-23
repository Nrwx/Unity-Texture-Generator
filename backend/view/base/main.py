from flask import current_app, request, jsonify
from typing import Any, Tuple

class BaseView:
    _route = None
    _controller = None
    _parser = None

    def _server_error(self, exc: Exception = None):
        if exc is not None:
            try:
                current_app.logger.exception("Unhandled view error")
            except Exception:
                pass
        return jsonify({"error": "Internal server error"}), 500

    def _handle(self, req) -> Tuple[Any, int, Any]:
        if not self._controller:
            return {"error": "Kein Controller registriert"}, 500

        try:
            if request.method == 'GET':
                try:
                    result = self._controller.fetch()
                except Exception as e:
                    return self._server_error(e)
            elif request.method == 'POST':
                try:
                    result = self._controller.handle(self._route, req.form, req.files)
                except Exception as e:
                    return self._server_error(e)
            else:
                    return jsonify({"error": "Method not allowed"}), 405
        except Exception as e:
            return self._server_error(e)

        response, status = self._parser.parse_response(result)

        return jsonify(response), status

    def dispatch(self):
        return self._handle(request)
