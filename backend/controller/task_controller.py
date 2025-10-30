from controller.base.main import BaseController

class TaskController(BaseController):
    def _serve_meta(self):
        result = self._model.fetchMeta()
        return result

    def _fetch_single_task(self, id):
        result = self._model.fetch(id)
        return result