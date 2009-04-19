

import re

class LazyTwitterUser(object):
    def __get__(self, request, obj_type=None):
        if not hasattr(request, '_cached_twitter_user'):
            from twitter.models import TwitterUser
            if request.session.get("twitter_user_id"):
                try:
                    request._cached_twitter_user = TwitterUser.get_or_none(id=request.session["twitter_user_id"])
                except:
                    request._cached_twitter_user = None
            else:
                request._cached_twitter_user = None
        return request._cached_twitter_user


class TwitterMiddleware(object):
    #def process_view(self, request, view_func, view_args, view_kwargs):

    #exclude_patterns = re.compile("/media/(?:js|css|img)")
    
    def process_request(self, request):
        #Don't bother for static files
        #if self.exclude_patterns.findall(request.path):
        #    print "No user: %s" % request.path
        #    return request
        
        assert hasattr(request, 'session'), "The twitter authentication middleware requires session middleware to be installed. Edit your MIDDLEWARE_CLASSES setting to insert 'django.contrib.sessions.middleware.SessionMiddleware'."
        request.__class__.twitter_user = LazyTwitterUser()
        return None
