from django.db import models
from twitter.models import TwitterUser
from lib import model_utils
from twitter.twitter_lib import twitter as twitter_api

from django.contrib.contenttypes.models import ContentType
from django.conf import settings
import re, os

import Image

__all__ = ['Code', 'ImageRedirect', 'WeatherImage', 'Theme', 'Weatherized']

# where files are stored after settings.MEDIA_ROOT
_IMAGE_UPLOAD_PATH = 'twitter/imager/img/uploads'
    
def _Get_Image_Path(filename, folder):
    if not filename:
        filename = 'transparent.png'
        folder = 'default'
    
    elif isinstance(folder, Theme):
        folder = folder.slug
    
    elif isinstance(folder, Weatherized):
        folder = folder.user.twitter_username
    
    elif isinstance(folder, TwitterUser):
        folder = folder.twitter_username
    
    path = '%s/%s/%s' % (_IMAGE_UPLOAD_PATH, folder, filename)
    fullpath = "%s%s/%s" % (settings.MEDIA_ROOT, _IMAGE_UPLOAD_PATH, folder)
    print "_GET_IMAGE_PATH", filename, folder, path, fullpath
    if not os.path.exists(fullpath):
        os.mkdir(fullpath)
    return path

filename_slug = re.compile('[^\w_\-\.]')
def get_image_path(instance, filename):
    ctype = ContentType.objects.get_for_model(instance)
    model = ctype.model
    
    if model == "weatherimage":
        slug = filename_slug.sub('', filename.replace(' ', '_'))
        slug = "%s_%s" % (instance.code.code, slug)
        return _Get_Image_Path(slug, instance.theme)

    elif model == "theme":
        return _Get_Image_Path(filename, instance)
    
    elif model == "weatherized":
        #slug = "original_%s" % slug
        return _Get_Image_Path(filename, instance.user)
    
    elif model == "twitter_user":
        return _Get_Image_Path(filename, instance)
    
    # shouldn't happen
    else:
        return _Get_Image_Path(None, None)

class Theme(models.Model):
    name = models.CharField(max_length=63)
    rank = models.IntegerField(default=10)
    author = models.ForeignKey(TwitterUser, blank=True, null=True)
    slug = models.SlugField()
    author_comments = models.TextField(blank=True)
    published = models.BooleanField(default=False)

    # null = True for postgresql/django_evolution hack
    background_not_avatar = models.BooleanField(default=True, null=True)
    replace_not_cover = models.BooleanField(default=True, null=True)

    before_screenshot = models.ImageField(upload_to=get_image_path, blank=True, null=True)
    after_screenshot = models.ImageField(upload_to=get_image_path, blank=True, null=True)
    
    class Meta:
        ordering = ('rank',)
    
    def number_theme_users(self):
        return Weatherized.objects.filter(theme=self).count()
        
    @property
    def avatar(self):
        return self.weather_images[0]
    
    @property
    def weather_images(self):
        return WeatherImage.objects.filter(theme=self)
    
    def weather_image(self, code):
        return WeatherImage.get_or_none(theme=self, code=code)
    
    @property
    def core_images(self):
        """
        @return: root images
        @rtype: list of WeatherImage
        """
        ret = []
        for ir in ImageRedirect.roots():
            w = self.weather_image(ir.code)
            if w:
                ret.append(w)
            else:
                ret.append(ir)
                # is this a problem? should the core always exist?
        return ret

    @property
    def extra_images(self):
        """
        @return: non root images 
        @rtype: list of WeatherImage and ImageRedirect
        """ 
        ret = []
        for ir in ImageRedirect.not_roots():
            w = self.weather_image(ir.code)
            if w:
                ret.append(w)
            else:
                ret.append(ir)
        return ret
    
    def get_image(self, code):
        """
        @summary: Follow redirects to return a WeatherImaage if possible.
        If path leads to root ImageRedirect without corresponding WeatherImage,
        then return the ImageRedirect.
        
        @return: WeatherImage or ImageRedirect
        """
        # 1. see if direct WeatherImage exists
        image = WeatherImage.get_or_none(theme=self, code=code)
        if not image:
            red = ImageRedirect.get_or_none(code=code)
            # 2. see if indirect WeatherImage exists
            image = WeatherImage.get_or_none(theme=self, code=red.end_code)
            if not image:
                # 3. ok, return canonical ImageRedirect
                image = red
        return image
    
    def image_or_redirect(self, code):
        """
        Return the WeatherImage or ImageRedirect matching the provided code.
        @return: WeatherImage or ImageRedirect
        """
        # 1. see if direct WeatherImage exists
        image = WeatherImage.get_or_none(theme=self, code=code)
        if not image:
            return ImageRedirect.get_or_none(code=code)
        else:
            return image

    @classmethod
    def make(klass, name, author=None):
        """
        Auto creates slug field:
           lower case
           spaces --> underscores
           removes [^\w_\-]
           appends '_1' if a theme with same slug already exists,
               '_2' if two themes with same slug already exists, etc
        """
        p = re.compile('[^\w_\-]')
        slug = p.sub('', name.lower().replace(' ', '_'))
        slug_siblings = Theme.objects.filter(slug__startswith=slug)
        if slug_siblings:
            # TODO. these numbers are not safe if themes get deleted...
            slug = "%s_%s" % (slug, slug_siblings.count())

        return Theme(name=name, author=author, slug=slug)
    
    @classmethod
    def create_default(klass, name, author=None):
        theme = Theme.add(name, author)
        
        s = "mkdir %s%s/%s" % (settings.MEDIA_ROOT,
                               _IMAGE_UPLOAD_PATH,
                               theme.slug)
        # execute make directory 
        os.system(s)
        
        for ir in ImageRedirect.roots():
            WeatherImage.add(code=ir.code, theme=theme)
        
        return theme
    
    @classmethod
    def Initialize(klass):
        models.signals.pre_save.connect(Theme.check_publishable, sender=Theme)
        model_utils.mixin(ThemeMixin, TwitterUser)
    
    @classmethod
    def check_publishable(klass, signal, sender, instance, **kwargs):
        if instance.author_comments and instance.before_screenshot and instance.after_screenshot:
            instance.published = True
        else:
            instance.published = False
    
    def __unicode__(self):
        return "%s by %s (%s images)" % (self.name, self.author, len(self.core_images) + len(self.extra_images))

class ThemeMixin(object):
    """
    Self is a TwitterUser
    """
    def weatherizeds(self):
        return Weatherized.find(user=self)
    
    @property
    def weatherized_background(self):
        for w in self.weatherizeds():
            if w.theme.background_not_avatar:
                return w
        return None
    
    @property
    def weatherized_avatar(self):
        for w in self.weatherizeds():
            if not w.theme.background_not_avatar:
                return w
        return None
    
    def themes_created(self):
        return Theme.find(author=self)

class ImageRedirect(models.Model):
    """
    Canonical, immutable, static. 
    @TODO override save() to cause error
    """
    code = models.ForeignKey('Code')
    image_redirect = models.ForeignKey('self', null=True, blank=True)
    
    thumbnail_height = 50
    thumbnail_width = 50
    thumbnail_url = '/twitter/media/twitter/imager/img/uploads/default/transparent.png'
#_Get_Image_Path(None,None)#'/twitter/media/twitter/imager/img/uploads/default/transparent.png'
    #image = {'thumbnail_url': '/twitter/media/twitter/imager/img/uploads/default/transparent.png' }
    

    class Meta:
        ordering = ('code',)
        
    @property
    def end_code(self):
        """
        @return: Code at end of redirects
        """
        red = self
        while red:
            if not red.image_redirect:
                return red.code
            red = red.image_redirect
        # should not occur
        return None
    
    def image(self, theme):
        a = theme.weather_image(self.code)
        if a:
            return a
        else:
            return self

    @property
    def parents(self):
        return ImageRedirect.find(image_redirect=self)

    @classmethod
    def roots(klass):
        """
        @return: sequence of ImageRedirects that redirect nowhere.
        These are the most basic, must have IRs. 
        """
        return ImageRedirect.objects.filter(image_redirect=None)
    
    @classmethod
    def not_roots(klass):
        """
        @return: sequence of ImageRedirects that redirect nowhere.
        These are the most basic, must have IRs. 
        """
        return ImageRedirect.objects.exclude(image_redirect=None)

    @classmethod
    def make(klass, code, image_redirect=None):
        return ImageRedirect(code=code, image_redirect=image_redirect)
    
    @classmethod
    def install(klass):
        if ImageRedirect.objects.count() == 0:
            # storms
            storm = ImageRedirect.add(code=Code.get(name='storms'))
            ImageRedirect.add(code=Code.get(name='tornado'), image_redirect=storm)
            ImageRedirect.add(code=Code.get(name='tropical storm'), image_redirect=storm)
            ImageRedirect.add(code=Code.get(name='hurricane'), image_redirect=storm)
            ImageRedirect.add(code=Code.get(name='severe thunderstorms'), image_redirect=storm)
            ImageRedirect.add(code=Code.get(name='isolated thunderstorms'), image_redirect=storm)
            ImageRedirect.add(code=Code.get(name='scattered thunderstorms'), image_redirect=storm)
            ImageRedirect.add(code=Code.get(name='scattered thunderstorms 2'), image_redirect=storm)
            ImageRedirect.add(code=Code.get(name='thundershowers'), image_redirect=storm)
            ImageRedirect.add(code=Code.get(name='isolated thundershowers'), image_redirect=storm)
            
            # snow
            snow = ImageRedirect.add(code=Code.get(name='snow'))
            ImageRedirect.add(code=Code.get(name='mixed rain and snow'), image_redirect=snow) 
            ImageRedirect.add(code=Code.get(name='mixed rain and sleet'), image_redirect=snow) 
            ImageRedirect.add(code=Code.get(name='mixed snow and sleet'), image_redirect=snow) 
            ImageRedirect.add(code=Code.get(name='snow flurries'), image_redirect=snow) 
            ImageRedirect.add(code=Code.get(name='light snow showers'), image_redirect=snow) 
            ImageRedirect.add(code=Code.get(name='blowing snow'), image_redirect=snow) 
            ImageRedirect.add(code=Code.get(name='hail'), image_redirect=snow) 
            ImageRedirect.add(code=Code.get(name='sleet'), image_redirect=snow) 
            ImageRedirect.add(code=Code.get(name='heavy snow'), image_redirect=snow) 
            ImageRedirect.add(code=Code.get(name='scattered snow showers'), image_redirect=snow) 
            ImageRedirect.add(code=Code.get(name='heavy snow 2'), image_redirect=snow) 
            ImageRedirect.add(code=Code.get(name='snow showers'), image_redirect=snow) 
            
            # rain
            rain = ImageRedirect.add(code=Code.get(name='rain'))
            ImageRedirect.add(code=Code.get(name='drizzle'), image_redirect=rain)
            ImageRedirect.add(code=Code.get(name='freezing drizzle'), image_redirect=rain)
            ImageRedirect.add(code=Code.get(name='freezing rain'), image_redirect=rain)
            ImageRedirect.add(code=Code.get(name='showers'), image_redirect=rain)
            ImageRedirect.add(code=Code.get(name='mixed rain and hail'), image_redirect=rain)
            ImageRedirect.add(code=Code.get(name='scattered showers'), image_redirect=rain)
    
            # partly cloudy
            pcloudy = ImageRedirect.add(code=Code.get(name='partly cloudy'))
            ImageRedirect.add(code=Code.get(name='partly cloudy (day)'), image_redirect=pcloudy)
            ImageRedirect.add(code=Code.get(name='partly cloudy (night)'), image_redirect=pcloudy)
            
            # cloudy
            cloudy = ImageRedirect.add(code=Code.get(name='cloudy'))
            ImageRedirect.add(code=Code.get(name='mostly cloudy (day)'), image_redirect=cloudy)
            ImageRedirect.add(code=Code.get(name='mostly cloudy (night)'), image_redirect=cloudy)
            ImageRedirect.add(code=Code.get(name='dust'), image_redirect=cloudy)
            ImageRedirect.add(code=Code.get(name='foggy'), image_redirect=cloudy)
            ImageRedirect.add(code=Code.get(name='haze'), image_redirect=cloudy)
            ImageRedirect.add(code=Code.get(name='smoky'), image_redirect=cloudy)
            
            # clear
            clear = ImageRedirect.add(code=Code.get(name='sunny'))
            ImageRedirect.add(code=Code.get(name='fair (day)'), image_redirect=clear)
            ImageRedirect.add(code=Code.get(name='cold'), image_redirect=clear)
            ImageRedirect.add(code=Code.get(name='hot'), image_redirect=clear)
            ImageRedirect.add(code=Code.get(name='blustery'), image_redirect=clear)
            ImageRedirect.add(code=Code.get(name='windy'), image_redirect=clear)
            ImageRedirect.add(code=Code.get(name='clear (night)'), image_redirect=clear)
            ImageRedirect.add(code=Code.get(name='fair (night)'), image_redirect=clear)
            ImageRedirect.add(code=Code.get(name='not available'), image_redirect=clear)
            
    def __unicode__(self):
        return "%s --> %s" % (self.code, self.image_redirect)

class WeatherImage(models.Model):
    """
    """    
    code = models.ForeignKey('Code')
    theme = models.ForeignKey(Theme)
    
    image = models.ImageField(upload_to=get_image_path)
    
    thumbnail_width = models.IntegerField(default=50)
    thumbnail_height = models.IntegerField(default=50)

    def palm_width(self):
        if self.image.width > 540:
            return "100%"
        elif self.image.height > 540:
            return int( self.image.width * (540.0 / self.image.height) )
    
    class Meta:
        ordering = ('code',)
        
    @classmethod
    def make(klass, code, theme, image=None):
        weathers = theme.weather_images.filter(code=code)
        assert weathers.count() < 2
        if weathers:
            weather = weathers[0]
            weather.image = _Get_Image_Path(image, theme)
            return weather

        return WeatherImage(image=_Get_Image_Path(image, theme), code=code, theme=theme)
        
    @classmethod
    def Initialize(klass):
        models.signals.pre_save.connect(WeatherImage.set_thumbnail_dimensions, sender=WeatherImage)
        models.signals.post_save.connect(WeatherImage.set_thumbnail, sender=WeatherImage)
    
    @classmethod
    def set_thumbnail_dimensions(klass, signal, sender, instance, **kwargs):
        # don't change default h,w for default transparent image
        if instance.image.name != 'twitter/imager/img/uploads/default/transparent.png':
            h = instance.image.height
            w = instance.image.width
            if h > w:
                if h > 200:
                    w = int((200.0/h) * w)
                    h = 200
            if w > 50:
                h = int((50.0/w) * h)
                w = 50
            
            instance.thumbnail_height = h 
            instance.thumbnail_width = w

    @classmethod
    def set_thumbnail(klass, signal, sender, instance, created, **kwargs):
        # don't change default h,w for default transparent image
        if instance.image.name != 'twitter/imager/img/uploads/default/transparent.png':
            # create thumbnail
            im = Image.open(instance.image.path)
            thumbn = im.copy()
            # don't thumbnail animations 
            print thumbn.info
            print thumbn.format
            print thumbn.mode
            if not 'duration' in thumbn.info:
                print "DO IT"
                thumbn.thumbnail((instance.thumbnail_width, instance.thumbnail_height), Image.ANTIALIAS)
            else:
                print "nope"
                
            #m = re.compile('^(.+)(\.\w+)$' % (TWITTER_SUFFIX))
            #n = Weatherized.m.match(instance.image.path)
            #if n:
            #    d = "%s_thumbnail%s" % (n.groups()[0], n.groups()[1])
            #else:
           #     d = instance.image.path + '.
            
            #thumbn.save(instance.image.path[:-4] + '_thumbnail' + instance.image.path[-3:])
            thumbn.save(instance.image.path + '.thumbnail', im.format)

    @property
    def thumbnail_path(self):
        return self.image.path + ".thumbnail"
    
    @property
    def thumbnail_url(self):
        if self.image.name != 'twitter/imager/img/uploads/default/transparent.png':
            return self.image.url + ".thumbnail"
        else:
            return '/twitter/media/twitter/imager/img/uploads/default/transparent.png'
    
    @property
    def thumbnail_name(self):
        return self.image.name + ".thumbnail"
                        
    def __unicode__(self):
        return "%s --> %s" % (self.code, self.image)

class Code(models.Model):
    code = models.IntegerField()
    name = models.CharField(max_length=63)
    
    class Meta:
        ordering = ('name', 'code')
        
    @classmethod
    def make(klass, name, code):
        c = Code.get_or_none(code=code)
        if c:
            if c.name != name:
                c.name = name
            return c # add, which wraps make, saves returned Code
        else:
            return Code(name=name, code=code)
    
    @classmethod
    def install(klass):
        if Code.objects.count() == 0:
            Code.add('tornado', 0)
            Code.add('tropical storm', 1)
            Code.add('hurricane', 2)
            Code.add('severe thunderstorms', 3)
            Code.add('storms', 4)
            Code.add('mixed rain and snow', 5)
            Code.add('mixed rain and sleet', 6)
            Code.add('mixed snow and sleet', 7)
            Code.add('freezing drizzle', 8)
            Code.add('drizzle', 9)
            Code.add('freezing rain', 10)
            Code.add('rain', 11)
            Code.add('showers', 12)
            Code.add('snow flurries', 13)
            Code.add('light snow showers', 14)
            Code.add('blowing snow', 15)
            Code.add('snow', 16)
            Code.add('hail', 17)
            Code.add('sleet', 18)
            Code.add('dust', 19)
            Code.add('foggy', 20)
            Code.add('haze', 21)
            Code.add('smoky', 22)
            Code.add('blustery', 23)
            Code.add('windy', 24)
            Code.add('cold', 25)
            Code.add('cloudy', 26)
            Code.add('mostly cloudy (night)', 27)
            Code.add('mostly cloudy (day)', 28)
            Code.add('partly cloudy (night)', 29)
            Code.add('partly cloudy (day)', 30)
            Code.add('clear (night)', 31)
            Code.add('sunny', 32)
            Code.add('fair (night)', 33)
            Code.add('fair (day)', 34)
            Code.add('mixed rain and hail', 35)
            Code.add('hot', 36)
            Code.add('isolated thunderstorms', 37)
            Code.add('scattered thunderstorms', 38)
            Code.add('scattered thunderstorms 2', 39)
            Code.add('scattered showers', 40)
            Code.add('heavy snow', 41)
            Code.add('scattered snow showers', 42)
            Code.add('heavy snow 2', 43)
            Code.add('partly cloudy', 44)
            Code.add('thundershowers', 45)
            Code.add('snow showers', 46)
            Code.add('isolated thundershowers', 47)
            Code.add('not available', 3200)
                 
    def __unicode__(self):
        return "%s: %s" % (self.code, self.name)


class Weatherized(models.Model):
    class TwitterApiDelayException(Exception): pass

    user = models.ForeignKey(TwitterUser)
    theme = models.ForeignKey(Theme)
    current_code = models.ForeignKey(Code)
    background_success = models.BooleanField(default=False)
    error_message = models.CharField(max_length=256, default="")
    original_background = models.ImageField(upload_to=get_image_path, blank=True, null=True)
    weatherized_background = models.ImageField(upload_to=get_image_path, blank=True, null=True)

    ORIGINAL_PREFIX = "original"
    WEATHERIZED_PREFIX = "weatherized"
    BACKGROUND_MIDFIX = "_background_"
    AVATAR_MIDFIX = "_avatar_"
    pm1 = re.compile('^%s%s(.+)$' % (ORIGINAL_PREFIX, BACKGROUND_MIDFIX))
    pm2 = re.compile('^%s%s(.+)$' % (ORIGINAL_PREFIX, AVATAR_MIDFIX))
    pm3 = re.compile('^%s%s(.+)$' % (WEATHERIZED_PREFIX, BACKGROUND_MIDFIX))
    pm4 = re.compile('^%s%s(.+)$' % (WEATHERIZED_PREFIX, AVATAR_MIDFIX))
    # added to profile images. this sets size for profile homepage image
    TWITTER_SUFFIX = "_normal"
    # also have _mini suffix for follower icons
    s1 = re.compile('^(.+)%s(\.\w+)$' % (TWITTER_SUFFIX))
    
    def good_for_twitter(self):
        """
        @return: twitter filename
        """
        #print "GOOD FOR TWITTER", self.original_background.name
        #fn = self.original_background.name.split('/')[-1]
        #return Weatherized.remove_prefix_midfix(fn, original=True, background=theme.background_not_avatar)
        
        if self.theme.background_not_avatar:
            return self.user.profile_background_img_url.split('/')[-1]
        else:
            return Weatherized.remove_suffix(self.user.profile_img_url.split('/')[-1])
    
    @classmethod
    def remove_suffix(klass, fn):
        # remove twitter suffix
        s = Weatherized.s1.match(fn)
        if s:
            return "%s%s" % (s.groups()[0], s.groups()[1])
        else:
            return fn
    
    @classmethod
    def remove_prefix_midfix(klass, fn, original=True, background=True):
        """
        Returns filename without prefixes or midfixes. Should match twitter's filename,
        (note that default files are not stored on amazon, so...)
        
        expects single filename, not a path
        a_b_c => c
        c => c
        """
        if not background:
            fn = klass.remove_suffix(fn)
        
        if original and background:
            pm = Weatherized.pm1
        elif original and not background:
            pm = Weatherized.pm2
        elif not original and background:
            pm = Weatherized.pm3
        elif not original and not background:
            pm = Weatherized.pm4
        m = pm.match(fn)
        if m:
            return m.groups()[0]
        else:
            return fn

    def copy_original_for_twitter(self):
        """
        Makes a copy of original_background, which is in the same folder but renamed something good
        for twitter. This is so that reverting background/profiles doesn't change background/profile URL.
        @return: full path 
        
        
        """
        name = self.good_for_twitter()
        #name = Weatherized.remove_prefix_midfix(self.original_background.name.split('/')[-1], original=True, background=self.theme.background_not_avatar)
        #if not self.theme.background_not_avatar:
        #    name = Weatherized.remove_suffix(name)
        path = _Get_Image_Path(name, self.user)
        print os.system('cp %s %s%s' % (self.original_background.path, settings.MEDIA_ROOT, path))
        return '%s%s' % (settings.MEDIA_ROOT, path)

    def copy_weatherized_background(self, wbg_path):
        """
        @param wbg_path: is expected to be a fully qualified path, eg /tmp/good_for_twitter_name.png 
        @param original_not_weatherized: path is used to put weatherized background there.
        
        wbg_path will probably match original_background name, unless user changed background...while still weatherized...
        """
        #path = _Get_Image_Path('weatherized_background.%s' % wbg_path.split('.')[-1], self.user)
        if self.theme.background_not_avatar:
            fn = self.user.profile_background_img_url.split('/')[-1]
            midfix = Weatherized.BACKGROUND_MIDFIX
        else:
            fn = self.user.profile_img_url.split('/')[-1]
            midfix = Weatherized.AVATAR_MIDFIX
            fn = Weatherized.remove_suffix(fn)
            
        prefix = Weatherized.WEATHERIZED_PREFIX
        
        fn = "%s%s%s" % (prefix, midfix, fn)
        
        path = _Get_Image_Path(fn, self.user)
        
        print os.system('cp %s %s%s' % (wbg_path, settings.MEDIA_ROOT, path))
        self.weatherized_background = path
        self.save()

    @classmethod
    def _sluggles(klass, filename):
        p = re.compile('[^\w_\-\.]')
        slug = p.sub('', filename.replace(' ', '_'))

        return slug
    
    @classmethod
    def handle_uploaded_file(klass, uploaded_file, user, background_not_avatar):
        """
        Takes an UploadedFile object, writes it to disk,
        and returns the path.
        # http://docs.djangoproject.com/en/dev/topics/http/file-uploads
        """
        #path = _Get_Image_Path('original_background.%s' % uploaded_file.name.split('.')[-1], user)
        if background_not_avatar:
            fn = user.profile_background_img_url.split('/')[-1]
            midfix = Weatherized.BACKGROUND_MIDFIX
        else:
            fn = user.profile_img_url.split('/')[-1]
            midfix = Weatherized.AVATAR_MIDFIX
        
        prefix = Weatherized.ORIGINAL_PREFIX
        fn = "%s%s%s" % (prefix, midfix, fn)
        
        path = _Get_Image_Path(fn, user)
        destination = open("%s%s" % (settings.MEDIA_ROOT, path), 'wb+')
        for chunk in uploaded_file.chunks():
            destination.write(chunk)
        destination.close()
        return path

    @classmethod
    def get_image(klass, background_url, user, background_not_avatar):
        """
        Takes a url, retrieves image and writes it to disk,
        and returns the path.
        """
        import cStringIO # *much* faster than StringIO
        import Image, urllib
        fp = urllib.urlopen(background_url)
        str_img = cStringIO.StringIO(fp.read()) # constructs a StringIO holding the image
        icon = Image.open(str_img)
        
        if background_not_avatar:
            fn = user.profile_background_img_url.split('/')[-1]
            midfix = Weatherized.BACKGROUND_MIDFIX
        else:
            fn = user.profile_img_url.split('/')[-1]
            midfix = Weatherized.AVATAR_MIDFIX
            fn = klass.remove_suffix(fn)
        
        prefix = Weatherized.ORIGINAL_PREFIX
        fn = "%s%s%s" % (prefix, midfix, fn)
        
        #path = _Get_Image_Path(klass._sluggles('original_background.%s' % background_url.split('.')[-1]), user)
        path = _Get_Image_Path(fn, user)
        icon.save("%s%s" % (settings.MEDIA_ROOT, path))
        return path
    
    @classmethod
    def make(klass, user, theme, background_image):
        background_path = None
        if background_image:
            background_path = klass.handle_uploaded_file(background_image, user, theme.background_not_avatar)
            print "BACKGROUND IMAGE", background_image, background_path
        else:
            print "NO BACKGROUND IMAGE", background_image
            if theme.background_not_avatar:
                img_url = user.profile_background_img_url
            else:
                img_url = user.profile_img_url
            if img_url:
                try:
                    background_path = klass.get_image(img_url, user, theme.background_not_avatar)
                    print "   IMG_URL a", img_url, background_path
                except:
                    background_path = None
                    print "   IMG_URL b", img_url, background_path
            else:
                print "   NO IMG_URL"
        if not background_path:
            # TODO ?? wrong name...? but is this even possible?
            ## YES, this is possible when user changes background (or avatar)
            ## but twitter doesn't push info to api. booooooooo.
            print "   NO BACKGROUND PATH", background_path
            raise Weatherized.TwitterApiDelayException()
            #background_path = _Get_Image_Path(None,None)
            
        
        if theme.background_not_avatar:
            weatherized = user.weatherized_background
        else:
            weatherized = user.weatherized_avatar
        
        if weatherized:
            weatherized.theme = theme
            weatherized.original_background = background_path
            return weatherized
        else:
            # user should follow @weatherizer unless user *is* weatherizer
            try:
                if user.twitter_username != 'weatherizer' and user.twitter_username != 'weatherizertalk':
                    api = twitter_api.Api(user.twitter_username, user.password)
                    api.CreateFriendship('weatherizer')
                    weatherizer = TwitterUser.get_or_none(twitter_username='weatherizer')
                    api = twitter_api.Api(weatherizer.twitter_username, weatherizer.password)
                    api.CreateFriendship(user.twitter_username)
            except:
                # might fail if user is already in following relationship?
                pass

            code = Code.get(name='not available')
            return Weatherized(user=user, theme=theme, current_code=code, original_background=background_path)
        
    def remove_weatherization(self):
        # remove WEATHERIAER following USER if user is not weatherizer
        # user will still follow WEATHERIZER
        try:
            if self.user.twitter_username != 'weatherizer':
                #api = twitter_api.Api(user.twitter_username, user.password)
                #api.DestroyFriendship('weatherizer')
                #weatherizer = TwitterUser.get_or_none(twitter_username='weatherizer')
                #api = twitter_api.Api(weatherizer.twitter_username, weatherizer.password)
                #api.DestroyFriendship(user.twitter_username)
                pass
        except:
            # might fail if user already removed following relationship?
            pass
        
        self.delete()
    
    def __unicode__(self):
        return "%s, %s" % (self.user, self.theme)

ALL_MODELS = [Code, ImageRedirect, WeatherImage, Theme, Weatherized]
