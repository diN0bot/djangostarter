from lib.view_utils import * 
from twitter.models import *
from twitter.forms import get_form
from twitter.twitter_lib import view_utils as twitter_utils

from django.conf import settings
from django.core.urlresolvers import reverse
from django.db.models.query import QuerySet

import lib.feedparser

def main(request):
    app_name = 'overview'
    app_page = 'Overview'
    page_name = 'Twitter Apps'
    
    return render_response(request, 'twitter/overview.html', locals())

def feedback(request, key):
    """
    @param key: app name giving feedback for
    """
    app_name = key
    app_page = 'Feedback'
    page_name = 'Feedback'
    
    twit_name = {'imager':'weatherizer',
                 'tcal':'5309',
                 'procrasdonate':'procrasdonate',
                 'overview':'y0i'}[app_name]
    
    if request.POST:
        if 'join_announcement_list_text' in request.POST:
            email = request.POST.get('join_announcement_list_text', '').strip()
            subject = "Sign me up for Twitter %s announcements list" % key
            body = "Please sign me up for Twitter %s announcements list: %s" % (key, email)
            from django.core.mail import send_mail
            if settings.DJANGO_SERVER:
                # mail server probably isn't set up.
                print "===== EMAIL ======"
                print " subject: %s" % subject
                print " ------------------------- "
                print body
                print " ------------------------- "
            else:
                send_mail(subject, body, email, ['lucy@bilumi.org'], fail_silently=True)
            return HttpResponseRedirect(reverse('feedback', args=(key,)))
        
        elif 'comment' in request.POST:            
            response = _handle_reply(request, key)
            if response:
                return response
            else:
                comment_error = "Please enter a valid twitter username. If you are having trouble commenting, please let me know via an alternate medium."

    comments = Comment.root_comments(key)
    total_comments = Comment.objects.filter(key=key).count()
    return render_response(request, 'twitter/feedback.html', locals())
    
def reply(request, key, parent_id):
    app_name = key
    app_page = 'Reply'
    page_name = 'Reply'
    
    comment = Comment.get_or_none(id=parent_id)
    if comment: assert key == comment.key
    if request.POST:
        response = _handle_reply(request, key, parent=comment)
        if response:
            return response
        else:
            comment_error = "Please enter a valid twitter username. If you are having trouble commenting, please let me know via an alternate medium."
    return render_response(request, 'twitter/reply.html', locals())

def _handle_reply(request, key, parent=None):
    """
    @return: HttpResponseRedirect or None if comment not added successfully
    """
    comment = request.POST.get('comment', None)
    if comment and comment.strip():
        comment = comment.strip()
        twitter_username = request.POST.get('comment_twitter_username', None)
        if twitter_username:
            feed_url = 'http://twitter.com/statuses/user_timeline/%s.rss' % twitter_username
            feed = lib.feedparser.parse(feed_url)
            print feed['status'], type(feed['status'])
            if feed['status'] == 200:
                twitter_user = TwitterUser.get_or_none(twitter_username=twitter_username)
                if not twitter_user:
                    twitter_user = TwitterUser.add(twitter_username)
                twitter_user.get_user_data()
            else:
                return None
        else:
            twitter_user = twitter_utils.current_twitter_user(request)
        Comment.add(message=comment, twitter_user=twitter_user, key=key, parent=parent)
        return HttpResponseRedirect(reverse('feedback', args=(key, )))
    return None

def about(request):
    app_name = 'overview'
    app_page = 'About'
    page_name = 'About'
    
    return render_response(request, 'twitter/about.html', locals())

def userpage(request, username):
    app_name = 'overview'
    app_page = 'User Page'
    page_name = 'User Page'
    
    return render_response(request, 'twitter/about.html', locals())

def users(request):
    app_name = 'overview'
    app_page = 'User Page'
    page_name = 'Users'
    
    #users = TwitterUser.object
    return render_response(request, 'twitter/users.html', locals())
