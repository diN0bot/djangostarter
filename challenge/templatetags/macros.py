
from django import template
from django.template.loader import get_template, render_to_string
from django.template.loader_tags import BlockNode, ExtendsNode
from django.template import TemplateDoesNotExist, defaulttags
from django.template.context import Context

from django.db.models import fields
from django.db.models.fields import AutoField

import settings, datetime

register = template.Library()



def do_time_ago(parser, token):
    """
    Splits the arguments to the time_ago tag and formats them correctly.
    """
    split = token.split_contents()
    if len(split) < 2 or len(split) > 2:
        raise template.TemplateSyntaxError('%s tag takes one required argument, the datetime' % split)
    return TimeAgo(split[1])

class TimeAgo(template.Node):
    """
    TimeAgo takes one required parameter, a datetime object.
    """
    def __init__(self, datetime_var):
        from django import template as django_template
        self.time = django_template.Variable(datetime_var)
    
    def render(self, context):
        key = self.time.var
        value = self.time.resolve(context)

        return self._get_time_ago(value)
    
    def _get_time_ago(self, dt):
        if not dt:
            return ''
        
        delta  = datetime.datetime.now() - dt
    
        if delta.days:
            if delta.days > 364:
                if int(delta.days / 365) > 1: return '%s years ago' % int(delta.days / 365)
                else:                         return '1 year ago'
            elif delta.days > 29:
                if int(delta.days / 30) > 1:  return '%s months ago' % int(delta.days / 30)
                else:                         return '1 month ago'
            elif delta.days > 6:
                if int(delta.days / 7) > 1:  return '%s weeks ago' % int(delta.days / 7)
                else:                         return '1 week ago'
            else:
                if delta.days > 1:            return '%s days ago' % delta.days
                else:                         return '1 day ago'
        elif delta.seconds:
            if delta.seconds > 59:
                if int(delta.seconds / 60) > 1: return '%s minutes ago' % int(delta.seconds / 60)
                else:                           return '1 minute ago'
            
            if delta.seconds > 1:             return '%s seconds ago' % delta.seconds
            else:                             return '1 second ago'
        else:
            return 'now'
register.tag('time_ago', do_time_ago)
