from django.db import models 

from django.db.models import signals
from django.dispatch import dispatcher

import utils
import graph, user, tag, rating, log, contact

"""
@summary:

"""

class State(models.Model):
    """
    @summary:
    
    @ivar label:
    @type label: string, models.CharField
    @ivar text:
    @type text: string, models.CharField
    
    @cvar STATEFUL_MODELS:
    
    @cvar UNPUBLISHED: eg, added by mechanical crawler, or is a test or in-progress addition
    @cvar PUBLISHED: visible on the main site and all that
    @cvar DELETED: deleted...but present just in case. these might get flushed periodically?
    """
    
    STATEFUL_MODELS = [
        graph.Node, graph.NodeType, graph.NodeTypeCast,
        graph.Edge, graph.EdgeType, graph.EdgeTypeCast,
        graph.Response, graph.Dimension, graph.Behavior, graph.UPC,
        graph.Article, graph.Citation, 
        tag.Tag, tag.Tagging,
        rating.EvaluationType,
        user.UserInterestPercent, user.Level,
        contact.Contact, contact.Interaction, contact.Donation, contact.Group, contact.GroupCast]
    
    @classmethod
    def Initialize(klass):
        """
        @summary: Mixes the StateMixin class into the Model classes listed in
        L{State.STATEFUL_MODELS}.
        
        @return: None
        @rtype: NoneType
        """
        utils.mixin(StateMixin, State.STATEFUL_MODELS)
        
        for model_class in State.STATEFUL_MODELS:
            model_class.add_to_class('state', models.CharField(max_length=1, choices=State.STATE_CHOICES, default=State.STATES['UNPUBLISHED']))
            model_class.add_to_class('objects', StateManager())
        
    # Valid States
    STATES = {'UNPUBLISHED':'U',
              'PUBLISHED':'P',
              'DELETED':'D',
              'FLAGGED':'F'
              }
    # for database (data, friendly_name)
    STATE_CHOICES = (
                     (STATES['UNPUBLISHED'], 'Unpublished',),
                     (STATES['PUBLISHED'], 'Published',),
                     (STATES['DELETED'], 'Deleted',),
                     (STATES['FLAGGED'], 'Flagged',),
                     )

    label = models.CharField(max_length=255)
    text  = models.CharField(max_length=255)


class StateManager(models.Manager):
    """
    dd
    """
    # so that select_related will draw from only published
    # might be true anyway since this manager replaces 'objects' and thus 
    # each model has only one manager anyway.
    # not sure if this is a performance or correctness problem when viewing deleted or unpublished items...
    use_for_related_fields = True
    
    def get_query_set(self):
        """
        Return only published items by default
        """
        return super(StateManager,self).get_query_set().filter(state=State.STATES['PUBLISHED'])
    
    def raw(self):
        """
        Return all items
        """
        return super(StateManager,self).get_query_set()
    
    def with_state(self, state):
        """
        Return only items with particular state, eg UNPUBLISHED or DELETED
        """
        return super(StateManager,self).get_query_set().filter(state=state)
    
class StateMixin(object):
    """
    """
    def delete(self, undo=True):
        """
        
        """
        if undo:
            self.undoable_delete()
        else:
            if current_user().is_authenticated() and current_user().is_superuser:
                if self.__class__ == graph.Behavior:
                    for rating in self.ratings:
                        rating.delete()
                super(models.Model, self).delete()    
            else:
                return False
                print "ONLY SUPERUSERS CAN DELETE IRREVERSIBLY (StateMixin.delete) %s" % self
        return True
    
    def publish(self):
        if self.state == State.STATES['UNPUBLISHED']:
            log.Action.create_published_action(self)
            self.state = State.STATES['PUBLISHED']
            self.save()
        return self
    
    def unpublish(self):
        if self.state == State.STATES['PUBLISHED']:
            self.state = State.STATES['UNPUBLISHED']
            self.save()
            self.published_action.delete()
            
    def flag(self):
        if self.state == State.STATES['PUBLISHED']:
            log.Action.create_flagged_action(self)
            self.state = State.STATES['FLAGGED']
            self.save()
    
    def unflag(self):
        if self.state == State.STATES['FLAGGED']:
            self.state = State.STATES['PUBLISHED']
            self.save()
            self.flagged_action.delete()
    
    def undoable_delete(self):
        """
        Don't actually delete item, just change state
        """
        if self.state != State.STATES['DELETED']:
            log.Action.create_deleted_action(self)
            self.state = State.STATES['DELETED']
            self.save()
            
    def undo_delete(self):
        """
        Change state back to visible and remove delete action
        """
        if self.state == State.STATES['DELETED']:
            if self.published_action:
                self.state = State.STATES['PUBLISHED']
            else:
                self.state = State.STATES['UNPUBLISHED']
            self.save()
            self.deleted_action.delete()
