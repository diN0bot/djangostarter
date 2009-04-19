
from django.db import models 

from django.contrib.contenttypes.models import ContentType
from django.contrib.contenttypes import generic

from lib import model_utils

from django.contrib.auth.models import User

import datetime

"""
@summary:
"""

"""
@attention: 
#by_user and #by_time methods are not currently implemented in the same
way most other connections are.  Due to limitations in the Django framework,
queries against these fields are either one-shot-and-done or very-very-slow.
Incremental query building (QuerySets) doesn't currently work for these models.

"""

class VoteAlreadyExistsForUser(RuntimeError): pass
class NoneVoteType(RuntimeError): pass

class VoteType(models.Model):
    name = models.CharField(max_length=200, unique=True, verbose_name="Vote Type Name")
    score = models.IntegerField(default=0)

    @classmethod
    def DEFAULT_GOOD(klass):
        return VoteType.get_or_none(name='Good', score=1) 
    
    @classmethod
    def DEFAULT_BAD(klass):
        return VoteType.get_or_none(name='Bad', score=-1)
    
    @classmethod
    def DEFAULT_OVERALL(klass):
        """ 
        Intended not as a given vote, but as the votetype for a 
        TotalVote across all vote types. To retrieve this 
        aggregated overall total, methods are likely written so that 
        they can be given this votetype directly, or, if no argument is given,
        default to using this type.
        """
        return VoteType.get_or_none(name='Overall', score=0)
    
    @classmethod
    def install(klass):
        """
        @summary: Install default content. called by post_syncdb
        """
        if VoteType.objects.count() == 0:
            VoteType.add('Insightful', score=1).publish()
            VoteType.add('Mean', score=-1).publish()
            VoteType.add('Overall', score=0).publish()

    @classmethod
    def make(klass, name, score=0):
        try:
            n = VoteType.get(name=name)
            raise AlreadyExists("VoteType %i already exists for this name, %s" % (n.id, name))
        except VoteType.DoesNotExist:
            return VoteType(name=name, score=score)

    def __unicode__(self):
        return "%s: %s" % (self.name, self.score)

class Vote(models.Model):
    """
    @summary:
    An Vote is an individual judgment of some object.  This will be most obvious
    with judgment of B{Behaviors}, but the B{Vote} model itself can be pointed
    at any object.
    An Vote is a many-to-one relationship.  An object can have an unlimited number
    of Votes, but each Vote points at only one object.
    Users are limited to having one Vote per object.
    
    Votes always have a non-None votetype and user.
    
    @var VOTABLE_MODELS: The Model classes which will receive the VoteMixin
    @type VOTABLE_MODELS: list<models.Model>
    """ 
    
    weight = models.IntegerField(default=1)
    weighted_score = models.IntegerField(default=1)
    
    votetype = models.ForeignKey(VoteType)
    
    user = models.ForeignKey(User) # user who created Vote (who voted item)
    time = models.DateTimeField(auto_now_add=True) # time of vote
    
    item_type = models.ForeignKey(ContentType)
    item_id = models.PositiveIntegerField()
    item = generic.GenericForeignKey('item_type', 'item_id')

    @classmethod
    def Initialize(klass):
        models.signals.post_save.connect(klass.on_create, sender=klass)
        models.signals.pre_delete.connect(klass.on_delete, sender=klass)
            
    @classmethod
    def on_create(klass, signal, sender, instance, created, **kwargs):
        """
        @summary: 
        This method is called every time an Vote has been saved.
        If the vote has just been created, adjust status.
        """
        if created:
            # adjust status of user whose work is being voted
            instance.item.user.profile.apply_vote(instance)
            # adjust total vote of work
            instance.item.compute_total_vote(instance.votetype)
            instance.item.compute_total_vote()
        return

    @classmethod
    def on_delete(klass, signal, sender, instance, **kwargs):
        """
        @summary: 
        This method is called every time an Vote is about to be deleted.
        Adjust status.
        """
        # adjust status of user whose work is being un-voted (by unapplying)
        instance.item.user.profile.unapply_vote(instance)
        # adjust total vote of work
        instance.item.compute_total_vote(instance.votetype)
        instance.item.compute_total_vote()
        return


    @classmethod
    def by_item(klass, item, votetype=None, user=None):
        """
        @return: QuerySet of votes (may be empty).
        If votetype or user is None, then that parameter is removd from the filter.
        We expect votes to always have an votetype and user
        """
        item_type_id = ContentType.objects.get_for_model(item).id
        if votetype and user:
            return Vote.get_or_none(user=user,
                                          item_type=item_type_id,
                                          item_id=item.id,
                                          votetype=votetype)
        elif votetype:
            return Vote.get_or_none(item_type=item_type_id,
                                          item_id=item.id,
                                          votetype=votetype)
        elif user:
            return Vote.get_or_none(user=user,
                                          item_type=item_type_id,
                                          item_id=item.id)
        else:
            return Vote.get_or_none(item_type=item_type_id,
                                          item_id=item.id)    
    @classmethod
    def one_by_item(klass, item, votetype=None, user=None):
        """
        @summary:  convenience method. Returns the first element from klass.by_item or None
        @return: Vote or None 
        """
        for e in klass.by_item(item, votetype, user):
            return e
        return None
        
    @classmethod
    def make(klass, item, votetype):
        user = current_user()
        if not user.is_authenticated(): raise UserNotAuthenticated
        
        if not votetype:
            raise NoneVotetype("No Votetype provided to Vote make")
        
        # Make sure the user has not already voted.
        if Vote.one_by_item(item, votetype, user):
            raise VoteAlreadyExistsForUser("User, %s, has already voted this item, %s, with this votetype, %s" % (user, item, votetype))
        
        # Now make the call.
        item_type_id = ContentType.objects.get_for_model(item).id
        return Vote(item_type_id=item_type_id,
                          item_id=item.id,
                          votetype=votetype,
                          weight=user.profile.vote_weight,
                          weighted_score=votetype.score*user.profile.vote_weight,
                          user=user)

    def __unicode__(self):
        return "%s:%s on %s" % (self.votetype, self.weighted_score, self.item)
    
class VoteMixin:
    """
    @summary:
    B{VoteMixin} is a mix-in used to provide common methods, attributes,
    and hooks to all the models that can be given L{Vote}s.
    """
    
    def votes(self, votetype=None):
        """
        @summary: Convenience method.  Maps to B{Vote.by_item(self)}
        
        @return: List of Votes on this object.
        @rtype: list<Vote>
        """
        return Vote.by_item(self, votetype=votetype)
    
    def votes_by_user(self, user=None):
        """
        @summary: Returns the Votes that user put on this object. 
        Uses current_user if user is None.
        
        @param user: User object or an integer to be used as the user_id.  
            Optional - if not specified, the currently logged in user will be used.
        @return: list of Votes
        @rtype: []
        """
        user = user or current_user()
        return Vote.by_item(self, user=user)
    
    def vote_by_user(self, votetype, user=None):
        """
        @summary: Returns the Vote that user put on this object for the specified votetype.
        To get votes for all votetypes use Vote.votes_by_user.
        Uses current_user if user is None.
        
        @param user: User object or an integer to be used as the user_id.  
            Optional - if not specified, the currently logged in user will be used.
        @return: Vote or None
        @rtype: Vote or None
        """
        user = user or current_user()
        if not votetype:
            raise "To get votes for all votetypes use Vote.votes_by_user."
        return Vote.by_item(self, votetype=votetype, user=user)
        
    def user_has_voted_positively(self, user=None):
        """
        @returns: True if user has made an vote with a positive score. Uses current_user() if user is None
        """
        user = user or current_user()
        for e in Vote.by_item(self, user=user):
            if e.type.score > 0:
                return True
        return False
    
    def user_has_voted_negatively(self, user=None):
        """
        @returns: True if user has made an vote with a negative score. Uses current_user() if user is None
        """
        user = user or current_user()
        for e in Vote.by_item(self, user=user):
            if e.type.score < 0:
                return True
        return False

    def _vote(self, votetype):
        """
        @summary: add vote by current_user
        """
        e = self.vote_by_user(votetype, user=current_user())
        if not e:
            e = Vote.add(self, votetype)
            self.add_to_total_vote(e)

    def _un_vote(self, votetype, e=None):
        """
        @summary: remove vote by current_user
        """
        e = e or self.vote_by_user(votetype, user=current())
        if e:
            self.remove_from_total_vote(e)
            e.delete()

    def _toggle_vote(self, votetype):
        """
        @summary: add or remove vote by current_user,
        depending on whether one already exists or not.
        @return: True if user has voted at end of method, False otherwise
        """
        e = self.vote_by_user(votetype, user=current_user())
        if e:
            self._un_vote(votetype, e)
            return False
        else:
            self._vote(votetype)
            return True

    def vote(self, votetype):
        """
        @summary: add or remove vote by current_user, 
        depending on whether one already exists or not.
                  remove all other votes, too.
        @return: True if user has voted at end of method, False otherwise
        """
        for e in self.votes_by_user():
            if e.type != votetype:
                self._un_vote(e.type, e)
        return self._toggle_vote(votetype)

    def thumb_up(self):
        """
        @summary: Convenience method. Calls vote with votetype=DEFAULT GOOD
        """
        return self.vote(VoteType.DEFAULT_GOOD())
        
    def thumb_down(self):
        """
        @summary: Convenience method. Calls vote with votetype=DEFAULT BAD
        """
        return self.vote(VoteType.DEFAULT_BAD())

class TotalVote(models.Model):
    """
    
    """
    weight = models.IntegerField()
    weighted_score = models.FloatField(null=True, blank=True)
    count = models.IntegerField()

    votetype = models.ForeignKey('VoteType', null=True)
    last_updated = models.DateTimeField(auto_now_add=True)
    
    item_type = models.ForeignKey(ContentType)
    item_id = models.PositiveIntegerField()
    item = generic.GenericForeignKey('item_type', 'item_id')
            
    @classmethod
    def Initialize(klass):
        models.signals.post_save.connect(klass.on_save, sender=klass)
            
    @classmethod
    def on_save(klass, signal, sender, instance, created, **kwargs):
        """
        @summary: 
        This method is called every time an Vote has been saved.
        If the vote has just been created, adjust status.
        """
        instance.last_updated = datetime.datetime.now()
        instance.save()
        return

    @classmethod
    def by_item(klass, item, votetype=None):
        """
        @return: QuerySet of votes (may be empty)
        If votetype is None, then that parameter is removed from the filter.
        We expect votes to always have an votetype
        """
        item_type_id = ContentType.objects.get_for_model(item).id
        if votetype:
            return TotalVote.get_or_none(item_type=item_type_id,
                                               item_id=item.id,
                                               votetype=votetype)
        else:
            return TotalVote.get_or_none(item_type=item_type_id,
                                               item_id=item.id)
    
    @classmethod
    def make(klass, item, score, count, weight, votetype):
        try:
            te = TotalVote.by_item(item=item, votetype=votetype)
            raise AlreadyExists("TotalVote %i already exists for this item, %s, and votetype, %s" % (te.id, item, votetype))
        except TotalVote.DoesNotExist:
            item_type_id = ContentType.objects.get_for_model(item).id
            return TotalVote(item_type=item_type_id,
                                   item_id=item.id,
                                   votetype=votetype,
                                   score=score,
                                   weighted_score=score*weight,
                                   count=count)

    def __unicode__(self):
        return "score: %s, count: %s, votetype: %s" % (self.score, self.count, self.votetype)


class TotalVoteMixin(object):
    """
    """
    
    def total_votes(self):
        """ convenience method. calls through to TotalVote.by_item """
        return TotalVote.by_item(self)
    
    def total_vote(self, votetype=None):
        """
        convenience method. calls through to TotalVote.by_item
        If an votetype is not specified, an overall vote is given.
        """
        votetype = votetype or VoteType.DEFAULT_OVERALL()
        return TotalVote.by_item(self, votetype)
        
    def update(self, score, count, weight, votetype=None):
        """
        updates or adds a TotalVote for the specified votetype 
        (updates if already exists or creates new TotalVote)
        """
        te = self.total_vote(votetype)
        if te:
            te.weighted_score = score*weight
            te.count = count
            te.weight = weight
            te.last_updated = datetime.datetime.now()
            te.save()
        else:
            te = TotalVote.add(self, score, count, weight, votetype)
        return te
    
    def add_to_total_vote(self, vote):
        """
        @summary: Updates the Total Vote using the specified vote.
        If vote.votetype is not DEFAULT_OVERALL, then updates DEFAULT_OVERALL as well.
        Makes no checks; assumes this vote has not previously been added!
        """
        self._apply_or_remove_to_total_vote(vote, is_remove_from=False)
        
    def remove_from_total_vote(self, vote):
        """
        @summary: Updates the Total Vote using the specified vote.
        If vote.votetype is not DEFAULT_OVERALL, then updates DEFAULT_OVERALL as well.
        Makes no checks; assumes this vote has been added and has not previously been removed!
        """
        self._apply_or_remove_to_total_vote(vote, is_remove_from=True)
        
    def _apply_or_remove_to_total_vote(self, vote, is_remove_from=False):
        if is_remove_from:
            m = self._remove_from_total_vote
        else:
            m = self._apply_to_total_vote
        
        te = TotalVote.by_item(self, votetype=vote.votetype)
        if te:
            m(te, vote.weighted_score, vote.weight)
        else:
            te = TotalVote.add(self, score, count, weight, votetype)
        
        # update default_overall as well
        if vote.votetype != VoteType.DEFAULT_OVERALL():
            te = TotalVote.by_item(self, votetype=VoteType.DEFAULT_OVERALL())
            if te:
                m(te, vote.weighted_score, vote.weight)
            else:
                te = TotalVote.add(self, score, count, weight, votetype)

    def _apply_to_total_vote(self, total_vote, weighted_score, weight):
        total_vote.weighted_score += weighted_score
        total_vote.weight += weight
        total_vote.count += 1
        total_vote.save
        
    def _remove_from_total_vote(self, total_vote, weighted_score, weight):
        total_vote.weighted_score -= weighted_score
        total_vote.weight -= weight
        total_vote.count -= 1
        total_vote.save

    def compute_total_vote(self, votetype=None):
        """
        @summary: (re)compute the TotalVote for this object. 
        If no votetype is provided, computes the DEFAULT_OVERALL
        total, which is the aggregate of all vote types
        
        @return: total vote
        @rtype: 
        """
        if votetype:
            votes = Vote.by_item(self, votetype=votetype)
        else:
            votes = Vote.by_item(self)
        sum = 0.0
        count = 0
        weight = 0
        for e in votes:
            sum += e.weighted_score
            weight += e.weight
            count += 1
        votetype = votetype or VoteType.DEFAULT_OVERALL()
        if weight == 0:
            return TotalVote.update(0, count, weight, self, self.dimension, votetype)
        else:
            return TotalVote.update(sum/weight, count, weight, self, self.dimension, votetype)                
