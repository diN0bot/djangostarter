"""

"""

from ..models import TwitterUser
from ..twitter_lib import twitter as twitter_api
import urllib2

def verify_password(username, password):
    t = twitter_api.Api(username, password)
    try:
        t.GetDirectMessages()
        return True
    except urllib2.HTTPError:
        return False

def handle_signin_form(request):
    errors = {}
    username = request.POST.get('username', None)
    password = request.POST.get('password', None)
    if not username:
        errors['username'] = 'Please enter your twitter username'
    if not password:
        errors['password'] = 'Please enter your twitter password'
    return (username, password, errors)

def log_in(request, twitter_user):
    request.session['twitter_user_id'] = twitter_user.id 

def log_out(request):
    try:
        del request.session['twitter_user_id']
    except KeyError:
        pass

def current_twitter_user(request):
    if request.session.get('twitter_user_id', False):
        return TwitterUser.get_or_none(id=request.session.get('twitter_user_id'))
    else:
        return None
