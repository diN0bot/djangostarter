from django.db import models
from lib import model_utils
from twitter.twitter_lib import twitter as twitter_api

from django.conf import settings
from django.utils import simplejson

import urllib2, datetime


__all__ = ['record_payment', 'KeepInTouchUser', 'ProcrasDonation', 'Site', 'Recipient']

def record_payment(site, time_spent, amount_paid, recipient, time=None):
    """
    FF extension makes actual payment to TipJoy. This function records the payment on our server
    for statistical purposes. No personal information about the giver is recorded.
    
    Steps:
    1. Create ProcrasDonation object so we can graph donation properties and frequency
    2. Update total_time and total_money for recipient and site
    """
    if time_spent <= 0 or amount_paid <= 0:
        return False
    R = Recipient.get_or_none(twitter_username=recipient)
    if not R:
        R = Recipient.add(twitter_username=recipient)
    S = Site.get_or_none(url=site)
    if not S:
        S = Site.add(url=site)
    P = ProcrasDonation.add(site=S, time_spent=time_spent, amount=amount_paid, recipient=R, time=time)
    S.update(time=time_spent, money=amount_paid)
    R.update(time=time_spent, money=amount_paid)
    return True

def email_user_stats():
    """
    We don't store information locally, but sometimes we want to get sent information from which to email 
    users their, say, weekly statistics and what not. Or maybe we just email them a link to their My Impact page.
    """
    pass
    
class KeepInTouchUser(models.Model):
    """
    This user is necessary for anything, and doesn't connect with any donation data.
    We simply want to make an announcement list of sorts
    """
    name = models.CharField(max_length=128)
    twitter_username = models.CharField(max_length=32, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)
    
    class Meta:
        ordering = ('twitter_username',)

class ProcrasDonation(models.Model):
    """
    Single tipjoy donation, probably once a day from a particular user.
    """
    # time of tipjoy payment
    time = models.DateTimeField()
    # site time was spent on
    site = models.ForeignKey('Site')
    # time spent procrastinating, in hours
    time_spent = models.FloatField()
    # amount donated in (fractional) cents
    amount = models.FloatField()
    # donation recipient
    recipient = models.ForeignKey('Recipient')
    
    @classmethod
    def make(klass, site, time_spent, amount, recipient, time=None):
        time = time or datetime.datetime.now()
        return ProcrasDonation(time=time, site=site, time_spent=time_spent, amount=amount, recipient=recipient)
    
    class Meta:
        ordering = ('time',)
    
class Site(models.Model):
    """
    Website users procrastinate on.
    """
    # full domain, with www merged with no subdomain
    # http://www.google.com and http://google.com are same Site
    # but http://blogger.google.com is different
    url = models.URLField()
    # total time procrastinated on this site, in hours
    total_time = models.FloatField(default=0.0)
    # total money spent in procrastinating on this site, in (fractional) cents
    total_money = models.FloatField(default=0.0)
    
    @classmethod
    def make(klass, url):
        site = Site.get_or_none(url=url)
        if site:
            return site
        else:
            return Site(url=url)
    
    def update(self, time, money):
        self.total_time += time
        self.total_money += money
        self.save()
        
    def __unicode__(self):
        return u"%s: %s, $%s" % (self.url, self.total_time, self.total_money)

class Recipient(models.Model):
    """
    Recipient of procrastinator's donations
    """
    name = models.CharField(max_length=128)
    description = models.CharField(max_length=256)

    twitter_username = models.CharField(max_length=32)
    
    # total time procrastinated on behalf of this recipient, in hours
    total_time = models.FloatField(default=0.0)
    # total money spent in procrastinating on behalf of this recipient, in (fractional) cents
    total_money = models.FloatField(default=0.0)
    
    @classmethod
    def make(klass, twitter_username):
        recipient = Recipient.get_or_none(twitter_username=twitter_username)
        if recipient:
            return recipient
        else:
            return Recipient(twitter_username=twitter_username, name="", description="")
        
    def update(self, time, money):
        self.total_time += time
        self.total_money += money
        self.save()
    
    def __unicode__(self):
        return u"%s (%s) %s, $%s" % (self.twitter_username, self.name, self.total_time, self.total_money)
    
class COMMENTS(object):
    def _POST(self, url, values):
        """
        POSTs values to url. Returns whatever url returns
        """
        data = urllib.urlencode(values)
        req = urllib2.Request(url, data)
        response = urllib2.urlopen(req).read()
        return simplejson.loads()
    
    def _GET(self, url, values):
        """
        GETs values to url. Returns whatever url returns
        """
        data = urllib.urlencode(values)
        req = urllib2.Request("%s?%s" % (url, data))
        response = urllib2.urlopen(req).read()
        return simplejson.loads()
        
    def create_tipjoy_account(self):
        """
        from http://tipjoy.com/api/#create_tipjoy_account_with_twitter
        
        url: http://tipjoy.com/api/createTwitterAccount/
        method: POST
        parameters:
            twitter_username - the username on twitter (required)
            twitter_password - the password on twitter (required)
        result:
            result - "success" or "failure"
            reason - if the result is "failure", the reason might be "must POST", 
                "missing twitterUsername", "missing twitterPassword", or 
                "invalid twitter username or password"
            username - if the result is "success", this is the Tipjoy account username. 
                It might not be the same as the given twitterUsername due to an existing 
                user with that name
            userId - if the result is "success", this is the Tipjoy account user id. 
                Because usernames can change, this is a good way to refer to the account.
        """
        values = {'twitter_username': self.twitter_username,
                  'twitter_password': self.twitter_password,
                  'format': 'json' }
        url =  "http://tipjoy.com/api/createTwitterAccount/"
        print self._POST(url, values)
        
    def has_tipjoy_account(self):
        """
        from http://tipjoy.com/api/#user_exists
        
        url: http://tipjoy.com/api/user/exists/
        method: GET
        parameters: one of
            twitter_username - the username on Twitter
            username - the username on Tipjoy
            email - the email address of the user on Tipjoy. Note that it is easy to modify an 
            email address to make it not match this query. For example 'ivan.kirigin+SomeSite@gmail.com' 
            won't match 'ivan.kirigin@gmail.com'. Many users modify their emails like this when signing 
            up for other services
        result:
            result - 'success' or 'failure'. Failure doesn't mean the account doesn't exist, but that 
                the request was malformed. Success doesn't mean the account exists
            reason - if 'result' is 'failure', gives the reason, either 'missing username, email, or 
                twitter_username' or 'must HTTP GET'
            exists - True or False
            user information - information about the user account if it exists
                username - the Tipjoy username of the payer. A user can change their username.
                user_id - the Tipjoy user id of the payer. This does not change.
                user_id - the Tipjoy user id of the payer. This does not change.
                date_joined - date and time the Tipjoy user joined Tipjoy
                is_private - a boolean, if true the user's transaction information is private
                is_verified - a boolean, if true this user has filled their Tipjoy account before.
                twitter_username - the Twitter username of the Tipjoy user, only present if they have 
                    a Twitter account linked to their Tipjoy account.
                twitter_user_id - the Twitter user id of the Tipjoy user.
                profile_image_url - the Twitter profile image of the Tipjoy user. This might slightly 
                    lag to reflect when a user changes their profile image. Blame a poor naming 
                    convention from twitter.
        """
        values = {'twitter_username': self.twitter_username }
        url = "http://tipjoy.com/api/user/exists/"
        print self._GET(url, values)
        
    def make_twitter_payment(self):
        """
        from http://tipjoy.com/api/#creating_twitter_payment
        
        url: http://tipjoy.com/api/tweetpayment/
        method: POST
        parameters:
            twitter_username - the username on twitter (required)
            twitter_password - the password on twitter (required)
            text - the text of the tweet (required). This must represent a payment tweet
        result:
            result - 'success' or 'failure'
            request - The call made
            reason - if the result is 'failure', the reason might be 'must HTTP POST', 
                'missing twitter_username', 'missing twitter_password', 'invalid twitter_password', 
                'no such tipjoy user', 'missing text', 'missing target', 'missing amount', 'tweet failed'
            transaction_ids - An array of integer transaction IDs. Typically will be of length 1. 
                If the user had a positive balance, and the payment was greater than balance, 
                there will be two transactions in Tipjoy, one paid and one unpaid.
            isLoan - boolean, designating whether the transaction is fully paid
            transactionTime - the time of the transaction
            tweet_id - the ID of the tweet, from Twitter
        """
        text = "p %s @%s %s" % (self.amount(), self.recipient.twitter_username, self.condition.tipjoy_description(self.count))
        values = {'twitter_username': self.twitter_username,
                  'twitter_password': self.twitter_password,
                  'text': text }
        url = "http://tipjoy.com/api/tweetpayment/"
        print self._POST(url, values)
        
    def check_balance(self):
        """
        url: http://tipjoy.com/api/user/balance/
        method: POST
        parameters:
            twitter_username - the username on twitter (required)
            twitter_password - the password on twitter (required)
        result:
            result - 'success' or 'failure'
            request - The call made, including GET parameters
            reason - if the result is 'failure', the reason might be 'must HTTP GET', 
                'missing twitter_username', 'missing twitter_password', 'invalid twitter_password', 
                or 'no such tipjoy user'
            balance - if the result is 'success', this is the Tipjoy user's balance in USD, as a float.
        """
        url = "url: http://tipjoy.com/api/user/balance/"
        values = {'twitter_username': self.twitter_username,
                  'twitter_password': self.twitter_password }
        print self._POST(url, values)

    def login_link(self):
        """
        
        url: http://tipjoy.com/api/user/loginlink/
        parameters:
            twitter_username - the username on twitter (required)
            twitter_password - the password on twitter (required)
            url - the url on Tipjoy to redirect to upon sign in, e.g. 'settings' for editing the 
                user's settings, or 'gopay' to be signed in and redirected to pay their bill at PayPal. 
                If not present, sends the user to http://tipjoy.com (optional)
        result:
            result - 'success' or 'failure'
            request - The call made
            reason - if the result is 'failure', the reason might be 'must HTTP POST', 
                'missing twitter_username', 'missing twitter_password', 'invalid twitter_password', 
                or 'no such tipjoy user'
            login_url - if the result is 'success', this url will sign in the user and redirect 
                them to the url passed in, or just http://tipjoy.com/
        """
        url = "http://tipjoy.com/api/user/loginlink/"
        redirect_to = 'http://whynoti.org'
        values = {'twitter_username': self.twitter_username,
                  'twitter_password': self.twitter_password,
                  'url': redirect_to }
        print self._POST(url, values)
        
    def get_transaction_data(self):
        """
        from http://tipjoy.com/api/#transaction_show
        
        url: http://tipjoy.com/api/transaction/show/
        method: GET
        parameters:
            id - the id of the transaction, probably found using the batch data extraction format, and 
            recording the transaction_id
        result:
            result - "success" or "failure"
            reason - if the result is "failure", the reason might be "must POST", 
                "missing twitterUsername", "missing twitterPassword", or 
                "invalid twitter username or password"
            transaction data - following this format:
                transaction_id - the id of the transction. You can store this to, for example, 
                    check if a payment has gone from pledged to paid, using this call.
                username - the Tipjoy username of the payer. A user can change their username. 
                    If transactions are private from this user, this will list 'anonymous'
                userid - the Tipjoy user id of the payer. This does not change.
                private - a boolean, if true will hide donor information.
                date_joined - date and time the Tipjoy user joined Tipjoy
                isLoan - a boolean, if true this transaction is pledged but not paid.
                verified - a boolean, if true this user has filled their Tipjoy account before.
                permalink - a url of the content.
                time - the transactions time
                prettyTime - a short English description of the relative transaction time, 
                    e.g. '2 hours ago'.
                amount - the dollar transaction amount
                twitter_username - the Twitter username of the Tipjoy user, only present if they 
                    have a Twitter account linked to their Tipjoy account.
                twitter_user_id - the Twitter user id of the Tipjoy user, only present if they 
                    have a Twitter account linked to their Tipjoy account.
                profile_image_url - the Twitter profile image of the Tipjoy user. This can be lagged 
                    if the user has updated their profile picture.
                tweet_id - the tweet id if this transaction was a Twitter Payment.
                tweet_message - the text of the tweet of the Twitter Payment
                tweet_message_html - the text of the tweet of the Twitter Payment, with links and 
                    @usernames rendered in HTML.
        """
        url = "http://tipjoy.com/api/transaction/show/"
        values = {'id': 22}
        print self._GET(url, values)

    def amount(self):
        """
        @return: tipjoy amount for payment text, including $ or cent, based on dollar and cent
        eg, $2, 10cent, $9.50
        """
        if self.dollars > 0:
            if self.cents > 0:
                return "$%s.%s" % (self.dollars, self.cents)
            else:
                return "$%s" % self.dollars
        else:
            return "%scent" % self.cents

ALL_MODELS = [KeepInTouchUser, ProcrasDonation, Site, Recipient]