from django import forms
from twitter.twitter_lib import view_utils
from twitter.models import TwitterUser

import re

# no longer used because zipcodes might be international or in Location Id form such as FRXXX0240
zipcode_re = re.compile('^\d{5}$')

class AuthorizeFormReplaceBackground(forms.Form):
    username = forms.CharField(max_length=100)
    password = forms.CharField(label='Password', widget=forms.PasswordInput(render_value=False))
    zipcode = forms.CharField(max_length=100)
    
    def __init__(self, *args, **kwargs):
        super(AuthorizeFormReplaceBackground, self).__init__(*args, **kwargs)

    def is_valid(self, request, save_password=True):
        if not super(AuthorizeFormReplaceBackground, self).is_valid():
            return False
        
        username = self.cleaned_data['username']
        password = self.cleaned_data['password']
        zipcode = self.cleaned_data['zipcode'].strip()
        
        invalid_zipcode = True
        if not zipcode:
            self.errors['zipcode'] = ('Please enter a zipcode',)
        #elif not zipcode_re.match(zipcode):
        #    self.errors['zipcode'] = ('Please enter a valid 5-digit zipcode',)
        else:
            invalid_zipcode = False

        invalid_user = True
        if not view_utils.verify_password(username, password):
            self.errors['password'] = ("Password does not match username",)
        else:
            invalid_user = False
            
        if not invalid_zipcode and not invalid_user:
            # user is authorized and we have zipcode so proceed
            twitter_user = TwitterUser.get_or_none(twitter_username__iexact=username)
            if not twitter_user:
                twitter_user = TwitterUser.add(twitter_username=username)
            # save data
            if save_password:
                twitter_user.password = password
            twitter_user.zipcode = zipcode
            twitter_user.get_user_data()
            twitter_user.save()
            view_utils.log_in(request, twitter_user)
            return True
        return False

class AuthorizeForm(forms.Form):
    username = forms.CharField(max_length=100)
    password = forms.CharField(label='Password', widget=forms.PasswordInput(render_value=False))
    zipcode = forms.CharField(max_length=100)
    background = forms.ImageField(required=False)
    
    def __init__(self, *args, **kwargs):
        super(AuthorizeForm, self).__init__(*args, **kwargs)

    def is_valid(self, request, save_password=True):
        if not super(AuthorizeForm, self).is_valid():
            return False
        
        username = self.cleaned_data['username']
        password = self.cleaned_data['password']
        zipcode = self.cleaned_data['zipcode'].strip()
        
        invalid_zipcode = True
        if not zipcode:
            self.errors['zipcode'] = ('Please enter a zipcode',)
        #elif not zipcode_re.match(zipcode):
        #    self.errors['zipcode'] = ('Please enter a valid 5-digit zipcode',)
        else:
            invalid_zipcode = False

        invalid_user = True
        if not view_utils.verify_password(username, password):
            self.errors['password'] = ("Password does not match username",)
        else:
            invalid_user = False
            
        if not invalid_zipcode and not invalid_user:
            # user is authorized and we have zipcode so proceed
            twitter_user = TwitterUser.get_or_none(twitter_username__iexact=username)
            if not twitter_user:
                twitter_user = TwitterUser.add(twitter_username=username)
            # save data
            if save_password:
                twitter_user.password = password
            twitter_user.zipcode = zipcode
            twitter_user.get_user_data()
            twitter_user.save()
            view_utils.log_in(request, twitter_user)
            return True
        return False
    

class ZipcodeForm(forms.Form):
    zipcode = forms.CharField(max_length=100)
    
    def __init__(self, *args, **kwargs):
        super(ZipcodeForm, self).__init__(*args, **kwargs)

    def is_valid(self):
        if not super(ZipcodeForm, self).is_valid():
            return False
        
        zipcode = self.cleaned_data['zipcode'].strip()
        
        invalid_zipcode = True
        if not zipcode:
            self.errors['zipcode'] = ('Please enter a zipcode',)
        #elif not zipcode_re.match(zipcode):
        #    self.errors['zipcode'] = ('Please enter a valid 5-digit zipcode',)
        else:
            invalid_zipcode = False
        
        return not invalid_zipcode
    
class BackgroundForm(forms.Form):
    background = forms.ImageField()
    
    def __init__(self, *args, **kwargs):
        super(BackgroundForm, self).__init__(*args, **kwargs)

    def is_valid(self):
        if not super(BackgroundForm, self).is_valid():
            return False
        
        return True

class LoginForm(forms.Form):
    username = forms.CharField(max_length=100)
    password = forms.CharField(label='Password', widget=forms.PasswordInput(render_value=False))

    def __init__(self, save_password=True):
        self.save_password = save_password

    def is_valid(self):
        if not forms.Form.is_valid(self):
            return False
        
        username = self.cleaned_data['username']
        password = self.cleaned_data['password']
        
        if not view_utils.verify_password(username, password):
            self.errors['password'] = ("Password does not match username",)
            return False
        
        else:
            # user is authorized and we have zipcode so proceed
            twitter_user = TwitterUser.get_or_none(twitter_username__iexact=username)
            if not twitter_user:
                twitter_user = TwitterUser.add(twitter_username=username)
            # save data
            if self.save_password:
                twitter_user.password = password
            twitter_user.zipcode = zipcode
            twitter_user.get_user_data()
            twitter_user.save()
            view_utils.log_in(request, twitter_user)
            return True

