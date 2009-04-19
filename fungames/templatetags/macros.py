
from django import template
from django.template.loader import get_template, render_to_string
from django.template.loader_tags import BlockNode, ExtendsNode
from django.template import TemplateDoesNotExist, defaulttags
from django.template.context import Context
from django.template.defaultfilters import stringfilter

from django.template import Variable

from django.db.models import fields
from django.db.models.fields import AutoField

from django.core.urlresolvers import reverse

import datetime, re, os
from django.conf import settings

from django.utils.html import conditional_escape
from django.utils.safestring import mark_safe
register = template.Library()



def do_twitter_app_menu(parser, token):
    """
    Splits the arguments to the twitter_app_menu tag and formats them correctly.
    """
    split = token.split_contents()
    if len(split) < 4 or len(split) > 4:
        raise template.TemplateSyntaxError("%r tag takes three required arguments, the current app name (eg 'imager'), the current app page (eg 'edit_theme'), and the page name (eg 'Upload Image')" % split)
    return TwitterAppMenu(split[1], split[2], split[3])

class TwitterAppMenu(template.Node):
    """
    render_responses takes one required parameter, a Response object, and one 
    optional parameter, a template. 
    @TODO giving a template via parameter seems to fail!! TemplateDoesNotExist. don't know why.
    """
    def __init__(self, app_name, app_page, page_name):
        """ @params current_page: capitalized """
        self.app_name = Variable(app_name)
        self.app_page = Variable(app_page)
        self.page_name = Variable(page_name)
    
    def _imager_pages(app_page, page_name, context):
        ret = [('Themes', reverse('imager'), 'select_theme'==app_page)]
        
        if app_page == 'theme':
            ret.append( (page_name, reverse('imager'), True) )
            
        if app_page == 'weatherized':
            ret.append( (page_name, reverse('weatherized'), True) )
        elif 'twitter_user' in context and not context['twitter_user'] or context['twitter_user'].weatherizeds():
            ret.append( ('My Weatherizer', reverse('weatherized'), 'weatherized'==app_page) )
        
        if app_page == 'create_theme':
            ret.append( (page_name, reverse('create_theme'), 'create_theme'==app_page) )
        
        if app_page == 'edit_theme':
            ret.append( (page_name, reverse('edit_some_theme'), 'edit_theme'==app_page) )
        #elif 'twitter_user' in context and not context['twitter_user'] or context['twitter_user'].themes_created():
        else:
            ret.append( ('Edit Theme', reverse('edit_some_theme'), 'edit_theme'==app_page) )
        
        return ret
        
    def _tcal_pages(app_page, page_name, context):
        if app_page in ['calendar', 'About', 'Feedback']:
            return [('Calendar', reverse('tcal'), 'calendar'==app_page),
                    ]
        else:
            return [(app_page, reverse('tcal'), True),
                    ]
        
    def _overview(app_page, page_name, context):
        return [(page_name, reverse('overview'), 'Overview'==app_page),
                ]
    
    PAGES = {'imager': _imager_pages,
             #'tcal': _tcal_pages,
             'overview': _overview,
             }
    META_ITEMS = {'imager': ['Help', 'Feedback'],
                  #'tcal': ['About', 'Help', 'Feedback'],
                  'overview': ['About', 'Help', 'Feedback']}
    
    def render(self, context):
        self.app_name = self.app_name.resolve(context)
        self.app_page = self.app_page.resolve(context)
        self.page_name = self.page_name.resolve(context)
        
        if self.app_name and self.app_page and self.page_name:
            context['app_menu'] = []
            if self.app_name in TwitterAppMenu.PAGES:
                context['app_menu'] = TwitterAppMenu.PAGES[self.app_name](self.app_page, self.page_name, context)

            try:
                reverse('%s_about' % self.app_name)
                if 'About' == self.app_page:
                    context['app_menu'].append( (self.page_name, reverse('%s_about' % self.app_name), True) )
                elif 'About' in TwitterAppMenu.META_ITEMS[self.app_name]:
                    context['app_menu'].append( ('About', reverse('%s_about' % self.app_name), False) )
            except: pass
            
            try:
                reverse('%s_help' % self.app_name)
                if 'Help' == self.app_page:
                    context['app_menu'].append( (self.page_name, reverse('%s_help' % self.app_name), True) )
                elif 'Help' in TwitterAppMenu.META_ITEMS[self.app_name]:
                    context['app_menu'].append( ('Help', reverse('%s_help' % self.app_name), False) )
            except: pass
            
            if 'Feedback' == self.app_page:
                context['app_menu'].append( (self.page_name, reverse('feedback', args=(self.app_name,)), True) )
            elif 'Feedback' in TwitterAppMenu.META_ITEMS[self.app_name]:
                context['app_menu'].append( ('Feedback', reverse('feedback', args=(self.app_name,)), False) )
        return ""
register.tag('twitter_app_menu', do_twitter_app_menu)


def do_twitter_apps_menu(parser, token):
    """
    Splits the arguments to the twitter_app_menu tag and formats them correctly.
    """
    split = token.split_contents()
    if len(split) < 2 or len(split) > 2:
        raise template.TemplateSyntaxError('%r tag takes one required argument, the current app' % split)
    return TwitterAppsMenu(split[1])

class TwitterAppsMenu(template.Node):
    """
    render_responses takes one required parameter, a Response object, and one 
    optional parameter, a template. 
    @TODO giving a template via parameter seems to fail!! TemplateDoesNotExist. don't know why.
    """
    def __init__(self, app_name):
        self.app_name = Variable(app_name)
    
    def render(self, context):
        self.app_name = self.app_name.resolve(context)
        
        if self.app_name:
            context['apps_menu'] = [('', 'twitter apps:',reverse('overview'),'overview'==self.app_name),
                                    #('calendar',reverse('tcal'),'tcal'==self.app_name),
                                    ('<img alt="" src="%stwitter/imager/img/WeatherizerLogo.png" height="30" style="margin-bottom: -1em;">' % settings.MEDIA_URL, 'weatherizer (beta)', reverse('imager'),' imager'==self.app_name),
                                    ('', 'more coming soon...',reverse('feedback', args=('overview',)),False),
                                    ]
        return ""
register.tag('twitter_apps_menu', do_twitter_apps_menu)


def do_render_responses(parser, token):
    """
    Splits the arguments to the render_responses tag and formats them correctly.
    """
    split = token.split_contents()
    template = None
    if len(split) > 2:
        template = split[2]
    if len(split) < 2 or len(split) > 3:
        raise template.TemplateSyntaxError('%r tag takes one required argument and two optional arguments' % split)
    return RenderResponses(split[1], template=template)

class RenderResponses(template.Node):
    """
    render_responses takes one required parameter, a Response object, and one 
    optional parameter, a template. 
    @TODO giving a template via parameter seems to fail!! TemplateDoesNotExist. don't know why.
    """
    def __init__(self, response_var, template=None):
        self.response = Variable(response_var)
        self.template = template
    
    def render(self, context):
        key = self.response.var
        value = self.response.resolve(context)
        template = self.template

        if not template:
            template = 'twitter/snippets/comment.html'
        try:
            get_template(template)
        except TemplateDoesNotExist:
            return "ERROR in templatetag render_response: could not render template %s" % template

        return self._recurse_on(value, template, context, 0)
    
    def _recurse_on(self, obj, template, context, indent):
        if indent < 10:
            indent += 1
        context['comment'] = obj
        ret = "<div class='comment indent" + str(indent) + "' id='comment_" + str(obj.id) + "'>\n"
        ret += render_to_string(template, context_instance=context)
        for child in obj.responses:
            ret += self._recurse_on(child, template, context, indent)
        ret += "</div>"
        return ret

register.tag('render_responses', do_render_responses)




links = re.compile('(https?://\S*)') # \S matches any non-whitespace character; this is equivalent to the class [^ \t\n\r\f\v].
twitternames = re.compile('@([\w\d]+)')
@register.filter
@stringfilter
def markup(text, args=None, autoescape=None):
    if autoescape:
        esc = conditional_escape
    else:
        esc = lambda x: x

    # 3. turn links into clickables    
    #result = links.sub(r'<a href="\1">\1</a>', text).strip()
    result = text.strip()
    
    # 3. turn @twittername to links
    result = twitternames.sub(r'<a href="http://twitter.com/\1">\1</a>', result).strip()
    
    # 4. turn double enter in breaks
    #linebreak_re = re.compile('(%s%s+)' % (os.linesep, os.linesep))
    #result = linebreak_re.sub('</p>%s<p>' % os.linesep, result)
    linebreak_re = re.compile('(\n\s+)')
    result = linebreak_re.sub('\n', result)
    result = result.replace('\n', '</p><p>')
    if 'dont_close_last_p' == args:
        result = '<p>%s' % result
    else:
        result = '<p>%s</p>' % result
    
    return mark_safe(result)
markup.needs_autoescape = True



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
        self.time = Variable(datetime_var)
    
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
                if int(delta.days / 7) > 1:   return '%s weeks ago' % int(delta.days / 7)
                else:                         return '1 week ago'
            else:
                if delta.days > 1:            return '%s days ago' % delta.days
                else:                         return '1 day ago'
        elif delta.seconds:
            if delta.seconds > 3599:
                if int(delta.seconds / 3600) > 1: return '%s hours ago' % int(delta.seconds / 3600)
                else:                             return '1 hour ago'
            elif delta.seconds > 59:
                if int(delta.seconds / 60) > 1: return '%s minutes ago' % int(delta.seconds / 60)
                else:                           return '1 minute ago'
            elif delta.seconds > 1:             return '%s seconds ago' % delta.seconds
            else:                             return '1 second ago'
        else:
            return 'now'
register.tag('time_ago2', do_time_ago)





def do_thumbnail(parser, token):
    split = token.split_contents()
    if len(split) < 3 or len(split) > 4:
        raise template.TemplateSyntaxError("%r tag takes two required arguments, the image's current width and height, and one optional argument, whether to permit uber wide images" % split)
    if len(split) == 4:
        uber_wide = True
    else:
        uber_wide = False
    return Thumbnail(split[1], split[2], uber_wide)

class Thumbnail(template.Node):
    """
    """
    def __init__(self, width, height, uber_wide):
        self.width = Variable(width)
        self.height = Variable(height)
        self.uber_wide = uber_wide
    
    def render(self, context):
        w = self.width.resolve(context)
        h = self.height.resolve(context)
        dw = w
        dh = h

        context['a'] = [w, h]
        max_h = 200.0
        max_w = 50.0
        if h > max_h:
            w = int((max_h/h) * w)
            h = int(max_h)
        if w > max_w:# and not self.uber_wide:
            dh = int((max_w/w) * h)
            dw = int(max_w)
            
        context['thumbnail_desired_width'] = dw
        context['thumbnail_desired_height'] = dh
        context['thumbnail_width'] = w
        context['thumbnail_height'] = h
        return ""
register.tag('thumbnail', do_thumbnail)
