QUEUE = None
class QueueController:
    @staticmethod
    def enqueue_request(func, args=None, kwargs=None, info=None):
        done_event, result_container = QUEUE.add_request(func, args, kwargs, info)
        done_event.wait()
        return result_container.get('response')

    @staticmethod
    def get_queue_status():
        return QUEUE.get_status()

def set_queue(queue_instance):
    global QUEUE
    QUEUE = queue_instance