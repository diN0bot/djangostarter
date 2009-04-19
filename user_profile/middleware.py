# threadlocals middleware
try:
    from threading import local
except ImportError:
    from django.utils._threading_local import local
    
_thread_locals = local()

from django.contrib.auth.models import AnonymousUser

def get_current_user():
    return getattr(_thread_locals, 'user', AnonymousUser())
def get_current_request_meta():
    return getattr(_thread_locals, 'request_meta', None)
def get_current_request():
    return getattr(_thread_locals, 'request', None)

class User_profileMiddleware(object):
    """
    Middleware that gets various objects from the
    request object and saves them in thread local storage.
    """
    def process_request(self, request):
        _thread_locals.user = getattr(request, 'user', None)
        _thread_locals.request_meta = getattr(request, 'META', None)
        _thread_locals.request = request


def _get_var(name, default=None):
    """
    Get variable from thread local.
    @type name: str
    @type default: object; defaults to None
    @return: Variable's value. If value is None and default is provided, returns default value.
    """
    return getattr(_thread_locals, name, default)

def _set_var(name, value=None):
    """
    Set variable in thread local. value defaults to None.
    @type name: str
    @type value: object; defaults to None
    """
    setattr(_thread_locals, name, value)
