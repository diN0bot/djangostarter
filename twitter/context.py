from django.conf import settings


def defaults(request):
    ret = auth(request)
    ret.update(debug(request))
    return ret

def debug(request):
    return {'DJANGO_SERVER': settings.DJANGO_SERVER}
    
def auth(request):
    """                                                                                                                                                                            
    Returns context variables required by apps that use the twitter app                                                                                                                           
                                                                                                                                                                                   
    If there is no 'twitter_user' attribute in the request, does nothing                                                                                                                                                          
    """
    if hasattr(request, 'twitter_user'):
        return { 'twitter_user': request.twitter_user }
    else:
        return {}
