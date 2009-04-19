from django.conf import settings


def defaults(request):
    ret = debug(request)
    return ret

def debug(request):
    return {'DJANGO_SERVER': settings.DJANGO_SERVER}
