from django.shortcuts import render_to_response
from django.template.loader import render_to_string
from django.template import RequestContext
from django.http import HttpResponseRedirect
from django.core.urlresolvers import reverse
import settings
from json_utils import json_response

def render_response(request, template, dictionary=None):
    """
    Return render_to_response with
    context_instance=RequestContext(request).
    """
    dictionary = dictionary or {}
    #if 'request' in dictionary:
    #    del dictionary['request']
    return render_to_response(template, dictionary, context_instance=RequestContext(request))

def render_string(request, template, dictionary=None):
    dictionary = dictionary or {}
    return render_to_string(template, dictionary, context_instance=RequestContext(request))

def superuser(user):
    return user and user.is_authenticated() and user.is_superuser

def staff(user):
    return user and user.is_authenticated() and user.is_staff

def logged_in(user):
    return user and user.is_authenticated()

def author(user):
    """ this should take a model object as a parameter and check that the user 
        is the author. ok for now because template never permits this option unless 
        already true... still... @TODO !!
    """
    return True

def session(session_key):
    return request.session.get(session_key, False)

def user_criteria(crit_func):
    """
    Decorator for views. Expects a user_criteria function, eg superuser, staff, logged_in.
    If current user meets criteria, view is called; otherwise, redirect to login.
    """
    def decorator(fn):
        def inner(*iargs, **kwargs):
            #user = current_user()
            #if reduce(lambda x,y: x(user) and y(user), args):
            if crit_func(iargs[0].user):
                # user passes all user criteria
                return fn(*iargs, **kwargs)
            else:
                return HttpResponseRedirect('%s?redirect_to=%s' % (reverse('login'), iargs[0].path))
        return inner
    return decorator

def ajax(crit_fun1, crit_fun2=None):
    """
    Decorator for views accessed via ajax. Expects a user_criteria function, 
    eg superuser, staff, logged_in. If criteria function fails, returns json error.
    """
    def decorator(fn):
        def inner(*iargs, **kwargs):
            if crit_fun1(current_user()):
                return fn(*iargs, **kwargs)
            if crit_fun2 and crit_fun2(current_user()):
                return fn(*iargs, **kwargs)
            # user passes no criteria
            return json_response('Could not perform action: user fails to meet criteria')
        return inner
    return decorator

def private(fn):
    """
    Checks the current user against the user_id argument given to a view. 
    If they match, the view is called; otherwise, redirect to current user's page.
    """
    def inner(*args, **kwargs):
        #print args
        user = current_user()
        if not user or not user.is_authenticated():
            return HttpResponseRedirect(reverse('login'))
        if 'user_id' in kwargs:
            try:
                i = int(kwargs['user_id'])
                if i == user.id:
                    # user passes all user criteria
                    return fn(*args, **kwargs)
                else:
                    return HttpResponseRedirect(reverse('login')) # TODO: return user's page.
            except ValueError:
                pass 
        raise Exception("Private decorator in main.py must decorate views with user_id argument.")
    return inner
