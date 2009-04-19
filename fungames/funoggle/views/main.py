from lib.view_utils import * 
from twitter.models import TwitterUser
from twitter.imager.models import *
from twitter.twitter_lib import twitter as twitter_api
from twitter.twitter_lib import view_utils
from twitter import forms
from twitter.imager.views import forms as imager_forms

from twitter.imager.cron import weatherizer

from django.core.urlresolvers import reverse
from django.db.models.query import QuerySet

import os, urllib2

def main(request):
    return HttpResponseRedirect(reverse('select_theme'))

def create_theme(request):
    app_name = 'imager'
    app_page = 'create_theme'
    page_name = 'Create Theme'
    
    twitter_user = view_utils.current_twitter_user(request)

    errors = {}
    if request.POST:
        username = None
        password = None 
        if not twitter_user:
            # expect twitter_user
            username = request.POST.get('username', None)
            if not username:
                errors['username'] = 'Please enter your twitter username'
        else:
            username = twitter_user.twitter_username

        if not twitter_user or (twitter_user and not twitter_user.password):
            password = request.POST.get('password', None)
            if not password:
                errors['password'] = 'Please enter your twitter password'
        elif twitter_user:
            password = twitter_user.password
            
        theme_name = request.POST.get('create_theme_name', None)
        if theme_name:
            theme_name = theme_name.strip()
        if not theme_name:
            errors['theme_name'] = 'Please enter a theme_name'

        if username and password and theme_name:
            if not view_utils.verify_password(username, password):
                errors['password'] = "Password does not match username"
            else:
                if not twitter_user:
                    twitter_user = TwitterUser.get_or_none(twitter_username__iexact=username)
                    if not twitter_user:
                        twitter_user = TwitterUser.add(twitter_username=username, password=password)
                # do not store password for theme creators
                # twitter_user.password = password
                twitter_user.get_user_data()
                twitter_user.save()
                view_utils.log_in(request, twitter_user)

                theme = Theme.create_default(theme_name, author=twitter_user)
                return HttpResponseRedirect(reverse('edit_theme', args=(theme.slug, )))

    elif twitter_user and twitter_user.password:
        if not view_utils.verify_password(twitter_user.twitter_username, twitter_user.password):
            # password is wrong. remove password so user can re-enter it
            twitter_user.password = None
            twitter_user.save()

    return render_response(request, 'imager/create_theme.html', locals())

def select_theme(request):
    app_name = 'imager'
    app_page = 'select_theme'
    page_name = 'Themes'
    
    twitter_user = view_utils.current_twitter_user(request)

    themes = Theme.objects.filter(published=True)
    return render_response(request, 'imager/select_theme.html', locals())

def authorize_background_changes(request, theme_slug):
    app_name = 'imager'
    app_page = 'weatherized'
    page_name = 'Weatherize'

    theme = Theme.get_or_none(slug=theme_slug)

    if request.method == 'POST':
        if theme.replace_not_cover:
            form = imager_forms.AuthorizeFormReplaceBackground(request.POST, request.FILES)
        else:
            form = imager_forms.AuthorizeForm(request.POST, request.FILES)
        if form.is_valid(request):
            if not theme.replace_not_cover:
                background = form.cleaned_data['background']
            else:
                background = None
            twitter_user = view_utils.current_twitter_user(request)
            try:
                weatherized = Weatherized.add(user=twitter_user, theme=theme, background_image=background)
                
                _do_weatherization(form, weatherized)
                if weatherized.background_success:
                    return HttpResponseRedirect(reverse('weatherized'))
            except Weatherized.TwitterApiDelayException:
                form.errors['random'] = ('Twitter is having trouble providing up-to-date information. Please explicitly upload a%s image file.' % (theme.background_not_avatar and " background" or "n avatar"), )
            
    else:
        if theme.replace_not_cover:
            form = imager_forms.AuthorizeFormReplaceBackground()
        else:
            form = imager_forms.AuthorizeForm()
        twitter_user = view_utils.current_twitter_user(request)
    return render_response(request, 'imager/authorize_background_changes.html', locals())

def _do_weatherization(form, w):
    code = None
    success = False
    msg = ''
    try:
        code, success = weatherizer.weatherize(weatherized=w)
    except weatherizer.ZipcodeLookupFailedException:
        msg = 'Could not find weather condition for this zipcode. Try the first tip below.'
        form.errors['zipcode'] = (msg,)
    except weatherizer.WeatherLookupFailedException:
        msg = 'Weather condition lookup failed inexplicably. Try the first tip below.'
        form.errors['zipcode'] = (msg,)
    except weatherizer.UpdateBackgroundFailedException:
        msg = 'Twitter background update inexplicably failed. It may work if you try again.'
        form.errors['username'] = (msg,)
    except Exception, details:
        print msg
        msg = 'Random failure. It may work if you try again.<br>Message to Weatherizer developer: %s' % details
        form.errors['random'] = (msg,)
    
    if not w:
        print "NULL w--- what?!"
        print view_utils.current_twitter_user(request)
        form.errors['zipcode'] = 'Some error happened. Please leave a note on the feedback page. (Say "Hal" sent you.)'
    else:
        w.error_message = msg
        w.background_success = success
        w.current_code = code or Code.get(name="not available")
        w.save()

def edit_theme(request, theme_slug):
    app_name = 'imager'
    app_page = 'edit_theme'
    page_name = 'Edit Theme'
    
    theme = Theme.get_or_none(slug=theme_slug)
    twitter_user = view_utils.current_twitter_user(request)

    if not twitter_user == theme.author:
        return HttpResponseRedirect(reverse('edit_some_theme'))
    
    return render_response(request, 'imager/theme_editor.html', locals())

def edit_some_theme(request):
    app_name = 'imager'
    app_page = 'edit_theme'
    page_name = 'Edit Theme'
    
    twitter_user = view_utils.current_twitter_user(request)
    
    if twitter_user:
        themes = Theme.find(author=twitter_user)
        if themes.count() == 0:
            return HttpResponseRedirect(reverse('create_theme'))
        if themes.count() == 1:
            return HttpResponseRedirect(reverse('edit_theme', args=(themes[0].slug,)))
        
    elif request.POST:
        if not twitter_user:
            username, password, errors = view_utils.handle_signin_form(request)
            if username and password:
                twitter_user = TwitterUser.get_or_none(twitter_username=username)
                if not twitter_user:
                    errors['username'] = "%s has not previously created any themes" % username
                elif twitter_user.password and twitter_user.password != password:
                    errors['password'] = "Password does not match username"
                elif not view_utils.verify_password(username, password):
                    errors['password'] = "Password does not match username"
                else:
                    view_utils.log_in(request, twitter_user)
                    return HttpResponseRedirect(reverse('edit_some_theme'))

    return render_response(request, 'imager/themes_to_edit.html', locals())


def about(request):
    app_name = 'imager'
    app_page = 'About'
    page_name = 'About'
    return render_response(request, 'imager/about.html', locals())

def tos(request):
    app_name = 'imager'
    app_page = 'About'
    page_name = 'Terms of Service'
    return render_response(request, 'imager/tos.html', locals())

def dev(request):
    app_name = 'imager'
    app_page = 'Developer'
    page_name = 'Dev'
    return render_response(request, 'imager/devpage.html', locals())

def help(request):
    app_name = 'imager'
    app_page = 'Help'
    page_name = 'Help'
    
    diN0bot = TwitterUser.get_or_none(twitter_username='diN0bot')
    icon_theme = Theme.get_or_none(slug='yahoo_rss_weather')
    replace_theme = Theme.get_or_none(slug='drawdraw_superstar')
    return render_response(request, 'imager/help.html', locals())

def edit_image(request, theme_slug, code):
    app_name = 'imager'
    app_page = 'edit_theme'
    page_name = 'Upload Image'
    
    theme = Theme.get_or_none(slug=theme_slug)
    twitter_user = view_utils.current_twitter_user(request)

    if not twitter_user == theme.author:
        return HttpResponseRedirect(reverse('edit_some_theme'))

    code = Code.get_or_none(code=code)
    
    image = theme.image_or_redirect(code)
    if isinstance(image, WeatherImage):
        w = image
    else: 
        w = WeatherImage(theme=theme, code=code)
    
    FormKlass = forms.get_form(WeatherImage, forms.EDIT_TYPE)
    if request.POST or request.FILES:
        form = FormKlass(request.POST, request.FILES, instance=w)
        if form.is_valid():
            form.save()
            return HttpResponseRedirect(reverse('edit_theme', args=(theme.slug,)))
            '''
            try:
                w = form.save()
                return HttpResponseRedirect(reverse('edit_theme', args=(theme.slug,)))
            except:
                pass#WeatherImage.add(code=code, theme=theme, image=
            '''
            
            #import Image
            #uploaded = Image.open(w.image.path)
            #logo_name = Image.open(settings.MEDIA_ROOT+'twitter/imager/img/weatherizer_logo_name.png')
            #uploaded.paste(logo_name, (0,0), logo_name)
            #uploaded.save(w.image.path)
            
    else:
        form = FormKlass(instance=w)
    return render_response(request, 'imager/edit_image.html', locals())

def delete_image(request, theme_slug, code):
    theme = Theme.get_or_none(slug=theme_slug)
    twitter_user = view_utils.current_twitter_user(request)

    if not twitter_user == theme.author:
        return HttpResponseRedirect(reverse('edit_some_theme'))

    code = Code.get_or_none(code=code)
    
    image = WeatherImage.get_or_none(theme=theme, code=code)
    if image:
        image.delete()
    
    return HttpResponseRedirect(reverse('edit_theme', args=(theme.slug,)))

def delete_theme(request, theme_slug):
    ###### TODO return something
    theme = Theme.get_or_none(slug=theme_slug)
    twitter_user = view_utils.current_twitter_user(request)

    if not twitter_user == theme.author:
        return HttpResponseRedirect(reverse('edit_some_theme'))

    s = "rm -rf %s%s/%s" % (settings.MEDIA_ROOT,
                            WeatherImage.IMAGE_UPLOAD_PATH,
                            theme.slug)
    # execute cp 
    os.system(s)
    
def weatherized(request):
    app_name = 'imager'
    app_page = 'weatherized'
    page_name = 'My Weatherizer'
    
    twitter_user = view_utils.current_twitter_user(request)
    
    errors = {}
    if request.POST:
        if 'reason_why' in request.POST:
            reason_why = request.POST.get('reason_why', '').strip()
            stop_background = request.POST.get('stop_background', '').strip()
            stop_avatar = request.POST.get('stop_avatar', '').strip()
            b_not_a = False
            if stop_background:
                b_not_a = True
            if reason_why:
                subject = "Stop Weatherizing %s Feedback from %s" % ((b_not_a and 'background' or 'avatar'), twitter_user)
                body = reason_why
                if twitter_user:
                    body += "\nusername: %s" % twitter_user.twitter_username
                    body += "\npassword: %s" % twitter_user.password
                    body += "\nzipcode: %s" % twitter_user.zipcode
                    if b_not_a:
                        w_to_stop = twitter_user.weatherized_background
                        other_w = twitter_user.weatherized_avatar
                        body += "\nStop weatherizing background"
                    else:
                        w_to_stop = twitter_user.weatherized_avatar
                        other_w = twitter_user.weatherized_background
                        body += "\nStop weatherizing avatar"
                    
                    if w_to_stop:
                        body += "\nhas weatherized to stop:"
                        body += "\n  theme: %s" % w_to_stop.theme
                        body += "\n  background_not_avatar: %s" % w_to_stop.theme.background_not_avatar
                        body += "\n  current_code: %s" % w_to_stop.current_code
                        body += "\n  background_success: %s" % w_to_stop.background_success
                        body += "\n  error_message: %s" % w_to_stop.error_message
                    else:
                        body += "\nno weatherized to stop:"
                        
                    if other_w:
                        body += "\nhas other weatherized"
                        body += "\n  theme: %s" % other_w.theme
                        body += "\n  background_not_avatar: %s" % other_w.theme.background_not_avatar
                        body += "\n  current_code: %s" % other_w.current_code
                        body += "\n  background_success: %s" % other_w.background_success
                        body += "\n  error_message: %s" % other_w.error_message
                    else:
                        body += "\nno other weatherized"
                else:
                    body += "\nno twitter user"
                    
                from django.core.mail import send_mail
                if settings.DJANGO_SERVER:
                    # mail server probably isn't set up.
                    print "===== EMAIL ======"
                    print " subject: %s" % subject
                    print " ------------------------- "
                    print body
                    print " ------------------------- "
                else:
                    send_mail(subject, body, 'unhappyuser@whynoti.org', ['lucy@bilumi.org'], fail_silently=True)
            # un weatherize regardless
            if b_not_a:
                return HttpResponseRedirect(reverse('un_weatherize_background'))
            else:
                return HttpResponseRedirect(reverse('un_weatherize_avatar'))
            
        else:
            username = None
            password = None 
            if not twitter_user:
                # expect twitter_user
                username = request.POST.get('username', None)
                if not username:
                    errors['username'] = 'Please enter your twitter username'
            else:
                username = twitter_user.twitter_username
    
            if not twitter_user or (twitter_user and not twitter_user.password):
                password = request.POST.get('password', None)
                if not password:
                    errors['password'] = 'Please enter your twitter password'
            elif twitter_user:
                password = twitter_user.password
    
            if username and password:
                if not view_utils.verify_password(username, password):
                    errors['password'] = "Password does not match username"
                else:
                    if not twitter_user:
                        twitter_user = TwitterUser.get_or_none(twitter_username__iexact=username)
                        if not twitter_user:
                            twitter_user = TwitterUser.add(twitter_username=username, password=password)
                    twitter_user.password = password
                    twitter_user.get_user_data()
                    twitter_user.save()
                    view_utils.log_in(request, twitter_user)
    
                    return HttpResponseRedirect(reverse('weatherized'))

    elif twitter_user and twitter_user.password:
        if view_utils.verify_password(twitter_user.twitter_username, twitter_user.password):
            pass
        else:
            # password is wrong. remove password so user can re-enter it
            twitter_user.password = None
            twitter_user.save()

    return render_response(request, 'imager/weatherized.html', locals())

def un_weatherize(request, background_not_avatar=True):
    twitter_user = view_utils.current_twitter_user(request)

    w = None
    if twitter_user:
        if background_not_avatar:
            w = twitter_user.weatherized_background
        else:
            w = twitter_user.weatherized_avatar
    if w:
        path = w.copy_original_for_twitter()
        try:
            # revert weatherized changes
            weatherizer.update_background(path.encode('utf-8'),
                                          w.user.twitter_username,
                                          w.user.password,
                                          w.user.profile_background_tile,
                                          w.theme.background_not_avatar)
        except:
            from django.core.mail import send_mail
            subject = "revert weatherization failed"
            body = "%s tried to remove %s" % (twitter_user, w)
            body += "parameters: %s %s %s %s %s" % (path.encode('utf-8'),
                                                    w.user.twitter_username,
                                                    w.user.password,
                                                    w.user.profile_background_tile,
                                                    w.theme.background_not_avatar)
            if settings.DJANGO_SERVER:
                # mail server probably isn't set up.
                print "===== EMAIL ======"
                print " subject: %s" % subject
                print " ------------------------- "
                print body
                print " ------------------------- "
            else:
                send_mail(subject, body, 'unhappyuser@whynoti.org', ['lucy@bilumi.org'], fail_silently=True)
        w.remove_weatherization()
    
    return HttpResponseRedirect(reverse('weatherized'))

def log_out(request):
    view_utils.log_out(request)
    redirect_to = request.GET.get('redirect_to', None)
    # Light security check -- make sure redirect_to isn't garbage.             \
    if not redirect_to or '//' in redirect_to or ' ' in redirect_to:
        redirect_to = reverse('imager')
        
    return HttpResponseRedirect(redirect_to)

def screen_shot(request, theme_slug, type):
    app_name = 'imager'
    app_page = 'select_theme'
    page_name = 'Screenshot'
    
    theme = Theme.get_or_none(slug=theme_slug)
    
    is_before = (type == 'before')
    if is_before:
        screenshot = theme.before_screenshot
    else:
        screenshot = theme.after_screenshot
    
    return render_response(request, 'imager/screen_shot.html', locals())

def edit_screen_shot(request, theme_slug, type):
    app_name = 'imager'
    app_page = 'create_theme'
    page_name = 'Upload Screenshot'
    
    is_before = (type == 'before')
    
    theme = Theme.get_or_none(slug=theme_slug)
    twitter_user = view_utils.current_twitter_user(request)
    if not twitter_user == theme.author:
        return HttpResponseRedirect(reverse('edit_some_theme'))
    if is_before:
        screenshot = theme.before_screenshot
        screenshot_field = 'before_screenshot'
    else:
        screenshot = theme.after_screenshot
        screenshot_field = 'after_screenshot'
    
    ThemeForm = forms.get_form(Theme, forms.EDIT_TYPE, fields=(screenshot_field,))
    if request.POST or request.FILES:
        form = ThemeForm(request.POST, request.FILES, instance=theme)
        if form.is_valid():
            form.save()
            return HttpResponseRedirect(reverse('edit_theme', args=(theme.slug,)))
    else:
        form = ThemeForm(instance=theme)
    
    return render_response(request, 'imager/edit/screen_shot.html', locals())

def edit_replace_background(request, theme_slug):
    app_name = 'imager'
    app_page = 'edit_theme'
    page_name = 'Edit Theme'
    
    theme = Theme.get_or_none(slug=theme_slug)
    twitter_user = view_utils.current_twitter_user(request)
    if not twitter_user == theme.author:
        return HttpResponseRedirect(reverse('edit_some_theme'))
    
    if request.POST:
        background_not_avatar = request.POST.get('background_not_avatar', None)
        replace_not_cover = request.POST.get('replace_not_cover', None)
        
        if background_not_avatar == 'background':
            theme.background_not_avatar = True
        else:
            theme.background_not_avatar = False
        
        if replace_not_cover == 'replace':
            theme.replace_not_cover = True
        else:
            theme.replace_not_cover = False
                
        theme.save()
        return HttpResponseRedirect(reverse('edit_theme', args=(theme.slug,)))

    return render_response(request, 'imager/edit/replace_background.html', locals())

def edit_author_comments(request, theme_slug):
    app_name = 'imager'
    app_page = 'create_theme'
    page_name = 'Edit Theme'
    
    theme = Theme.get_or_none(slug=theme_slug)
    twitter_user = view_utils.current_twitter_user(request)
    if not twitter_user == theme.author:
        return HttpResponseRedirect(reverse('edit_some_theme'))
    
    ThemeForm = forms.get_form(Theme, forms.EDIT_TYPE, fields=('author_comments',))
    if request.POST:
        form = ThemeForm(request.POST, instance=theme)
        if form.is_valid():
            form.save()
            return HttpResponseRedirect(reverse('edit_theme', args=(theme.slug,)))
    else:
        form = ThemeForm(instance=theme)
    
    return render_response(request, 'imager/edit/author_comments.html', locals())

def change_background(request, background_not_avatar=True):
    app_name = 'imager'
    app_page = 'weatherized'
    page_name = 'Change Background'
    
    twitter_user = view_utils.current_twitter_user(request)
    if not twitter_user:
        return HttpResponseRedirect(reverse('weatherized'))
    
    if background_not_avatar:
        weatherized = twitter_user.weatherized_background
    else:
        weatherized = twitter_user.weatherized_avatar

    if not weatherized:
        return HttpResponseRedirect(reverse('weatherized'))
    
    if request.POST or request.FILES:
        form = imager_forms.BackgroundForm(request.POST, request.FILES)
        if form.is_valid():
            uploaded_file = form.cleaned_data['background']
            weatherized.original_background = Weatherized.handle_uploaded_file(uploaded_file, twitter_user, weatherized.theme.background_not_avatar)
            weatherized.save()

            _do_weatherization(form, weatherized)
            if weatherized.background_success:
                return HttpResponseRedirect(reverse('weatherized'))
    else:
        form = imager_forms.BackgroundForm()
    
    cancel_url = reverse('weatherized')
    submit_value = "Weatherize!"
    title = "Change Weatherized Background"
    multipart = True
    background_tips = True
    return render_response(request, 'imager/edit/generic_form.html', locals())
    
def change_zipcode(request, background_not_avatar=True):
    app_name = 'imager'
    app_page = 'weatherized'
    page_name = 'Change Zipcode'
    
    twitter_user = view_utils.current_twitter_user(request)
    if not twitter_user:
        return HttpResponseRedirect(reverse('weatherized'))

    if background_not_avatar:
        weatherized = twitter_user.weatherized_background
    else:
        weatherized = twitter_user.weatherized_avatar

    if not weatherized:
        return HttpResponseRedirect(reverse('weatherized'))
    
    if request.POST:
        form = imager_forms.ZipcodeForm(request.POST)
        if form.is_valid():
            twitter_user.zipcode = form.cleaned_data['zipcode']
            twitter_user.save()
            
            _do_weatherization(form, weatherized)
            if weatherized.background_success:
                return HttpResponseRedirect(reverse('weatherized'))
    else:
        form = imager_forms.ZipcodeForm()
    
    cancel_url = reverse('weatherized')
    submit_value = "Weatherize!"
    title = "Change Zipcode"
    zipcode_tips = True
    return render_response(request, 'imager/edit/generic_form.html', locals())

def theme(request, theme_slug):
    app_name = 'imager'
    app_page = 'theme'
    page_name = 'Theme'
    
    theme = Theme.get_or_none(slug=theme_slug)
    next_theme = None
    prev_theme = None
    found_t = False
    p = theme.published
    for t in Theme.objects.filter(published=p):
        if t != theme:
            if found_t and not next_theme:
                next_theme = t
            if not found_t:
                prev_theme = t
        else:
            found_t = True

    return render_response(request, 'imager/theme.html', locals())

