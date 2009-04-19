import settings

def defaults(request):
    frame = {}
    frame.update(literals())
    frame.update(django_server())
    frame.update(good_urls())
    print request.path
    return frame

def literals():
    return { 'True':  True,
             'False': False,
             'None':  None  }

def django_server():
    return { 'DJANGO_SERVER': settings.DJANGO_SERVER }

def good_urls():
    return { 'BASE_URL': settings.BASE_URL }
