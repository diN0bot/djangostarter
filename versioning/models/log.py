from django.db import models 

from django.contrib.contenttypes.models import ContentType
from django.contrib.contenttypes import generic

from django.contrib.auth.models import User
from lib import model_utils

from lib.threadlocals_middleware import get_current_request

import datetime
"""
@summary:
The L{log} module includes several classes tasked with tracking use
of and changes to the database.

"""

class Visit(models.Model):
    """
    @summary:
    A B{Visit} is a record of a single HTTP request.  One is recorded
    everytime Django serves up a page, so there will be lots of these.
    When the site is public, we'll have to trim this down or regularly
    flush the database, but for as long as we have the storage space,
    this will help us evaluate traffic and analyze how users are moving
    through the site.
    
    @ivar path: The path (not including domain) for this page request.
    @ivar user: The user, if logged in.
    @ivar time: The time at the start of the request.
    @ivar duration: The amount of time it took to process the request.
    @ivar sql_duration: The cumulative time spent querying the database
        during this request.
    @ivar ip: The visitor's IP address.
    @ivar remote_host: The HTTP_REMOTE_HOST header passed by the visitor.
    @ivar user_agent: The HTTP_USER_AGENT header passed by the visitor.
        This should describe their browser.
    @ivar referer: The HTTP_REFERER header passed by the visitor.  This
        should be the page from which they linked to this one.
    """
    path = models.CharField(max_length=255)
    
    user = models.ForeignKey(User)
    time = models.DateTimeField(auto_now_add=True)
    duration = models.FloatField()
    sql_duration = models.FloatField()
    
    ip = models.IPAddressField()
    remote_host = models.CharField(max_length=255)
    user_agent = models.CharField(max_length=255)
    referer = models.CharField(max_length=255)
    
    @classmethod
    def make(klass, path, user, time, duration, sql_duration, ip, remote_host, user_agent, referer):
        return Visit(path=path, 
                     user=user, 
                     time=time, 
                     duration=duration, 
                     sql_duration=sql_duration, 
                     ip=ip, 
                     remote_host=remote_host, 
                     user_agent=user_agent, 
                     referer=referer)
        
class Action(models.Model):
    """
    @summary:
    An B{Action} is a record of a database-changing event. 
    
    @ivar user: The User associated with this activity.
    @type user: User
    @ivar ip: The IP address used when the activity occurred.
    @type ip: string
    @ivar time: The time the activity occurred.
    @type time: datetime
    @ivar item: This is a polymorphic link to the affected item.
    @type item: Any
    @ivar item_type: This is an index into the django_content_types
        table, which stores a row for each model in the application.
    @type item_type: int (an id in the ContentTypes table)
    @ivar item_id: This is the primary key of the affected item.
    @type item_id: int
    """
    
    # Valid Actions
    ACTIONS = {'CREATED':'C',
               'MODIFIED':'M',
               'PUBLISHED':'P',
               'DELETED':'D',
               'FLAGGED':'F'
               }
    # for database (data, friendly_name)
    ACTION_CHOICES = (
                     (ACTIONS['CREATED'], 'CREATED',),
                     (ACTIONS['MODIFIED'], 'MODIFIED',),
                     (ACTIONS['PUBLISHED'], 'PUBLISHED',),
                     (ACTIONS['DELETED'], 'Deleted',),
                     (ACTIONS['FLAGGED'], 'Flagged',),
                     )
    
    type = models.CharField(max_length=1, choices=ACTION_CHOICES, default=ACTIONS['CREATED'])
    label = models.CharField(max_length=255)
    description = models.TextField()
    
    user = models.ForeignKey(User)
    ip = models.IPAddressField()
    time = models.DateTimeField(auto_now_add=True)
    
    item_type = models.ForeignKey(ContentType)
    item_id = models.PositiveIntegerField()
    item = generic.GenericForeignKey('item_type', 'item_id')
    
    ## TODO there are actions with None items because those items were deleted!!
    def item_model_name(self):
        return self.item.__class__.__name__
    
    @classmethod
    def on_save(klass, signal, sender, instance):
        """
        @summary: 
        This method called anytime an object is about to be saved.  This is where
        we can check the I{instance.original_values} dict to determine whether
        the object has been changed.
        
        From here, we can raise an exception to stop the object from being saved.
        This is currently not done, but will eventually check for the logged-in
        status of the user.
        
        @return: None
        @rtype:  NoneType
        """
        #if get_current_request().user is None:
        #    raise NotLoggedIn("You must log in before contributing.")
        pass

    @classmethod
    def on_create(klass, signal, sender, instance, created, **kwargs):
        """
        @summary: 
        This method is called every time an object has been saved.  This is where
        L{Action} objects are created for new objects.
        
        @return: None
        @rtype:  NoneType
        """
        if created:
            description = "Added: %s, id=%s, str=%s" % (instance.__class__.__name__, instance.id, unicode(instance))
            a = Action.add(type=Action.ACTIONS['CREATED'], item=instance, label="created", description=description)
            if a.user.username == "munin":
                a.time = datetime.datetime(2007,1,1)
                a.save()
            else:
                a.user.profile.add_basic_points()
            return
        
    @classmethod
    def create_deleted_action(klass, item):
        """
        Called when an item's state changes to DELETED (but item is still present in database)
        """
        description = "Deleted: %s, id=%s, str=%s" % (item.__class__.__name__, item.id, unicode(item))
        a = Action.add(type=Action.ACTIONS['DELETED'], item=item, label="deleted", description=description)
        return
    
    @classmethod
    def create_published_action(klass, item):
        """
        Called when an item's state changes from unpublished to published
        """
        description = "Published: %s, id=%s, str=%s" % (item.__class__.__name__, item.id, unicode(item))
        a = Action.add(type=Action.ACTIONS['PUBLISHED'], item=item, label="published", description=description)
        return
    
    @classmethod
    def create_flagged_action(klass, item):
        """
        Called when an item's state changes from published to flagged
        """
        description = "Flagged: %s, id=%s, str=%s" % (item.__class__.__name__, item.id, unicode(item))
        a = Action.add(type=Action.ACTIONS['FLAGGED'], item=item, label="flagged", description=description)
        return
    
    
    @classmethod
    def on_delete(klass, signal, sender, instance, **kwargs):
        """
        @summary: 
        This method is called every time an object is deleted for real: removed irreversibly from 
        the database. 
        Deletes all actions associated with an item.
        Should be called right BEFORE item is deleted.
        
        @return: None
        @rtype:  NoneType
        """
        ### WHEN DELETE OBJECTS FOR GOOD< DELETE ACTIONS TOO
        for a in Action.by_item(instance):
            a.delete()
        return
    
    @classmethod
    def by_user(klass, user):
        """
        @summary: Returns a QuerySet containing all Actions for which
        the specific User is responsible.
        @rtype:  QuerySet
        """
        return Action.objects.filter(user=user)
    
    @classmethod
    def make(klass, item, type=ACTIONS['CREATED'], label="<no label>", description="", ip="22.22.22.22", user=None):
        """
        @summary: Instantiates, but does not save, a new Action object.
        
        @param item: The object this action concerns.
        @type item: Any
        @param type: The type of Action. See the list of types in L{Action}.
        @type type: int
        @param label: A brief description of the activity being recorded.
        @type label: string
        @param description: The description of the action being created.
        This defaults to the empty string if none is provided.
        @type description: string
        
        """
        request = get_current_request()
        if request:
            ip = request.META.get('REMOTE_ADDR')
            user = request.user #request.user equals current_user. see db/utils.py and lib/threadlocals_middleware.py
        else:
            user = current_user()
        if not isinstance(user, User):
            print "user is not instance of User: %s" % user
            # This SHOULD ONLY occur when loading json into the database.
            # These actions are going to be deleted and replaced with the json actions.
            actions = Action.objects.filter(item_type=ContentType.objects.get_for_model(item),
                                            item_id=item.id,
                                            type=Action.ACTIONS['CREATED'])
            if len(actions) == 1:
                a = actions[0]
                print "Found existing action to match object creation. If not loading batch data then this is an ERROR !!!): %s" % a
                return a

            print "fake user for item %s (model:%s, id:%s)" % (item,ContentType.objects.get_for_model(item),item.id)

            try:
                user = User.objects.get(username="munin")
            except:
                user = User(username="munin", first_name="Finder of Lost Actions", email="munin@bilumi.org")
                user.save()
                if User.objects.count() > 0:
                    print "Danger -- this might overwrite or be overwritten by another user data in the batch"

        return Action(type=type,
                      label=label,
                      description=description,
                      item_type=ContentType.objects.get_for_model(item),
                      item_id=item.id,
                      user=user,
                      ip=ip)
    
    def items(self):
        """
        @summary: 
        
        @return:  
        @rtype:   
        """
        return Action.by_action(self)
    
    @classmethod
    def by_item(klass, item):
        """
        @summary: 
        
        @return:  
        @rtype:   
        """
        return Action.objects.filter(item_type=ContentType.objects.get_for_model(item),
                                     item_id=item.id)
    
    @classmethod
    def by_action(klass, action):
        """
        @summary: 
        
        @return:  
        @rtype:   
        """
        return Action.objects.filter(action=action)
    
    def __unicode__(self):
        return self.label

@mixin_property([user.UserExtended])
def actions(self):
    """
    @summary: Returns a QuerySet containing all actions by this user,
    limited to the specified type, if provided.
    @rtype: QuerySet
    """
    return Action.by_user(self)

#def ActionTargetManager(model_class):
#    """
#    @summary:
#    Generates an ActionTargetManager for a specific model class.
#    """
#    class ActionTargetManager(models.Manager):
#        """
#        @summary:
#        
#        """
#        def get_query_set(self):
#            return super(ActionTargetManager, self).get_query_set(item_type=ContentType.objects.get_for_model(item))
#        def by_user(self, user):
#            return self.filter(user=user)
#    
#    return ActionTargetManager


class ActionMixin(object):
    """
    @summary:
    B{ActionMixin} is a mix-in used to provide common methods, attributes,
    and hooks to all the models whose changes are logged by L{log.Action}.
    
    At initialization, ActionTarget.B{_apply} is applied to all the models
    listed in L{log.Action}.
    
    @ivar actions:
    @type actions: ActionTargetManager
    @ivar log:
    @type log: LogManager
    """
    
    @classmethod
    def by_user(klass, user):
        """
        @summary: Returns a QuerySet containing the appropriate models, 
        depending which Model class this method was called on.
        @rtype: QuerySet
        """
        db_table = klass._meta.db_table
        item_type_id = ContentType.objects.get_for_model(klass).id
        return klass.objects.extra(
            tables=['db_action AS action'],
            where =['%s.id = action.item_id' % db_table,
                    'action.item_type_id = %s' % item_type_id, 
                    'action.user_id=%s' % user.id])
    
    
    def get_action(self, type, name):
        if not hasattr(self, name):
            action = Action.by_item(self).filter(type=type).select_related()[:1]
            if len(action) == 0:
                return None
            setattr(self, name, action[0])
        return getattr(self, name)
        
    @cached_property
    def action(self):
        """
        @summary: Returns the Action object logged at the time of this
        object's creation.
        @rtype:  Action
        """
        return self.get_action(Action.ACTIONS['CREATED'], 'cached_action')
    
    @cached_property
    def deleted_action(self):
        """
        @summary: Returns the Action object logged at the time of this
        object's deletion.
        @rtype:  Action
        """
        return self.get_action(Action.ACTIONS['DELETED'], 'cached_deleted_action')

    @cached_property
    def published_action(self):
        """
        @summary: Returns the Action object logged at the time of this
        object's publication.
        @rtype:  Action
        """
        return self.get_action(Action.ACTIONS['PUBLISHED'], 'cached_published_action')
    
    @cached_property
    def flagged_action(self):
        """
        @summary: Returns the Action object logged at the time of this
        object being flagged
        @rtype:  Action
        """
        return self.get_action(Action.ACTIONS['FLAGGED'], 'cached_flagged_action')
    
    @property
    def user(self):
        """
        @summary: Returns the User responsible for creating this object.
        @rtype: User
        """
        return self.action.user
        #return self.action and self.action.user or None
    
    @property
    def time(self):
        """
        @summary: Returns the time at which this object was created.
        @rtype: datetime
        """
        return self.action.time
        #return self.action and self.action.time or None
        

    
    
    
