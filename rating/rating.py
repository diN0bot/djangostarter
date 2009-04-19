
from django.db import models 

from django.contrib.contenttypes.models import ContentType
from django.contrib.contenttypes import generic

from lib import model_utils

from user import User

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

class RatingOutOfRange(RuntimeError): pass
class RatingAlreadyExistsForUser(RuntimeError): pass
class EvaluationAlreadyExistsForUser(RuntimeError): pass
class NoneEvalType(RuntimeError): pass

class RatingCount(object):
    """
    If count is 0, rating (which is sum/count) will be None
    count is number of votes that contributed to rating
    """
    
    def __init__(self, rating, count):
        self.rating = rating
        self.count = count
    
    @classmethod
    def sum_weight_count(klass, sum, weight, count):
        if weight == 0:
            return RatingCount(None, 0)
        else:
            return RatingCount(sum/weight, count)
    
    def __unicode__(self):
        return "rating: %s, count: %s" % (self.rating, self.count)

class Rating(models.Model):
    """
    @summary:
    An Rating is an individual judgement of some object.  This will be most obvious
    with judgement of B{Behaviors}, but the B{Rating} model itself can be pointed
    at any object.
    A Rating is a many-to-one relationship.  An object can have an unlimited number
    of Ratings, but each Rating points at only one object.
    Users are limited to having one Rating per object.
    Limits will exist for valid I{scores} for various objects, but because B{Rating}
    doesn't target a particular model, there is no restriction in place.
    
    @ivar score: The important part
    @type score: int
    @ivar item: The object this B{Rating} references
    @type item: Any
    @ivar item_type: The B{ContentType} id of B{item}
    @type item_type: int, or ContentType
    @ivar item_id: The id of B{item} in the appropriate table
    @type item_id: int
    
    @var RATEABLE_MODELS: The Model classes which will receive the RatingMixin
    @type RATEABLE_MODELS: list<models.Model>
    
    @var ACCEPTABLE_RANGE: A dict containing the low, high, and type requirements
    for scores given each of the Rateable objects. low and high are inclusive. type must be int or float, but doesn't matter which (don't currently check)
    @type ACCEPTABLE_RANGE: dict<key:(low, high, type)>
    """
    
    RATEABLE_MODELS = [
        graph.Node, graph.Edge, graph.Response,
        graph.Dimension, graph.Behavior, graph.UPC,
        graph.Article ]
    
    ACCEPTABLE_RANGE = { #(LOW,HIGH,type(int,float))  (low, high are inclusive)
        graph.Node: (0,10,int),
        graph.Edge: (0,10,int),
        graph.Response: (-1,1,int),
        graph.Dimension: (0,10,int), 
        graph.Behavior: (0,10,int), 
        graph.UPC: (0,10,int),
        graph.Article: (0,10,int), 
        }
    
    @classmethod
    def Initialize(klass):
        """
        @summary: Mixes the RatingMixin class into the Model classes
        specified in Rating.RATEABLE_MODELS
        
        @return: None
        @rtype: NoneType
        """
        mixin(RatingMixin, Rating.RATEABLE_MODELS)
        
        #for model_class in Rating.RATEABLE_MODELS:
        #    model_class.add_to_class('cached_rating', models.FloatField(default=1.0))

    
    # user's vote
    score = models.IntegerField()

    # the following two defaults should always be overwritten
    # when a new rating is added
    # in fact, they are invalid values for a reason:
    # see admin urls for correcting defaults in evolved data. 

    # user's vote_weight
    weight = models.IntegerField(default=-1)
    # effective score (score * weight)
    weighted_score = models.IntegerField(default=-1) 
    ## or make this a property
    ##def weighted_score(self):
    ##    return int(score) * int(weight)
    
    item_type = models.ForeignKey(ContentType)
    item_id = models.PositiveIntegerField()
    item = generic.GenericForeignKey('item_type', 'item_id')
    
    
    #@staticmethod
    #def by_user(u=None):
    #    """
    #    @summary: 
    #    @rtype: QuerySet
    #    """
    #    user = u or current_user()
    #    if not user.is_authenticated(): raise UserNotAuthenticated
    #    user_id = u.id
    #    return Rating.objects.extra(where=[
    #            "id IN (SELECT id FROM db_action WHERE user_id = %s)" % (user_id,)])
    
    @staticmethod
    def by_item_and_user(item, user=None):
        """
        @summary: Returns a QuerySet containing the single Rating object (if any)
        made by the specified User on the specified object.
        @rtype:  QuerySet
        """
        user = user or current_user()
        if not user.is_authenticated(): raise UserNotAuthenticated

        h = { "user_id" : user.id,
              "rating_type_id" : ContentType.objects.get_for_model(Rating).id,
              "item_type_id" : ContentType.objects.get_for_model(item).id,
              "item_id" : item.id }
        
        #item_type_id = ContentType.objects.get_for_model(item).id
        
        sql = ("SELECT a.item_id FROM db_action a, db_rating r " + 
               " WHERE a.item_type_id = %(rating_type_id)i " +
               "   AND a.user_id = %(user_id)i " +
               "   AND a.item_id = r.id " +
               "   AND r.item_type_id = %(item_type_id)i " +
               "   AND r.item_id = %(item_id)i " +
               " ORDER BY a.time DESC") % h
        
        ratings = Rating.objects.extra(where=["db_rating.id IN (%s)" % (sql,)]) 
        #ratings = Rating.objects.extra(where=[
        #        "db_rating.id IN (SELECT a.item_id FROM db_action a, db_rating r WHERE r.item_type_id = %s AND user_id = %s ORDER BY time ASC)" % 
        #        (item_type_id, item_id, user_id)])
        
        if len(ratings) == 0:
            return None
        elif len(ratings) == 1:
            return ratings[0]
        else:
            return ratings[len(ratings)-1]
            #raise "Too many ratings!"
    
    @staticmethod
    def by_item(item):
        """
        @summary: Returns a QuerySet containing all the Rating objects
        for the specified item.
        @rtype:  QuerySet
        """
        return Rating.objects.filter(item_type=ContentType.objects.get_for_model(item), item_id=item.id)

    @staticmethod
    def average_the_averages(items):
        """
        @summary: computes weighted average among items that have ratings.
            uses the average_rating mixin property.
            ### ASSUMES ITEMS HAVE WEIGHT PROPERTY. Maybe should check for attribute, otherwise use 1 ###
        @param items: a list of RatableMixin models instances 
        @rtype: RatingCount
        """
        sum = 0.0
        weight = 0
        count = 0
        for item in items:
            avg = item.average_rating
            if avg and avg.rating:
                sum += avg.rating
                weight += item.weight
                count += avg.count
        return RatingCount.sum_weight_count(sum, weight, count)

    @staticmethod
    def add(item, score, user):
        """
        @summary: This method overrides the one in the ModelMixin class,
        because it must check many more aspects than any other model.
        @see: L{Rating} for information about parameters and types.
        
        @return: Returns the new Rating object, if successful.
        @rtype: Rating
        
        @raise UserObjectOrIntegerExpected:
        @raise something if Rating Mixin Invalid:
        @raise RatingOutOfRange:
        @raise RatingAlreadyExistsForUser:
        """
        user = user or current_user()
        if not user.is_authenticated(): raise UserNotAuthenticated
        
        user_id = user.id
        
        #Make sure item is Ratable
        if not item.__class__ in Rating.RATEABLE_MODELS:
            raise "MixinInvalid: got %s of type %s." % (item, item.__class__)
        if not isinstance(item.pk, (int, long)):
            raise RatingMixinInvalid("Object %s has invalid primary key: '%s'" % (item, item.pk))
        
        #Make sure score is within acceptable range
        range = Rating.ACCEPTABLE_RANGE[item.__class__]
        if not (score >= range[0] and score <= range[1]):
            raise RatingOutOfRange(
                "got %s, but score must be between %s and %s for %s." %
                (score, range[0], range[1], item.__class__))
        
        #Make sure the user has not already voted.
        if Rating.by_item_and_user(item, user):
            raise RatingAlreadyExistsForUser("User has already rated this item: %s" % (item))
        
        #Now make the call.
        item_type_id = ContentType.objects.get_for_model(item).id
        return Rating.objects.create(item_type_id=item_type_id, 
                                     item_id=item.id, 
                                     score=score, 
                                     weight=user.profile.vote_weight,
                                     weighted_score=score*user.profile.vote_weight,
                                     user=user_id)
    
    def __unicode__(self):
        return "%s*(%s)=%s" % (self.score, self.weight, self.weighted_score) 

class RatingMixin:
    """
    @summary:
    B{RatingMixin} is a mix-in used to provide common methods, attributes,
    and hooks to all the models that can be given L{Tag} labels.  The list
    of these objects can be found at L{tag.Tag}.
    
    At initialization, RatingMixin.B{_apply} is applied to all the models
    listed in L{rating.Rating}.
    
    @ivar ratings:
    @type ratings: RatingMixinManager
    """
    
    @property
    def ratings(self):
        """
        @summary: Convenience method.  Maps to B{Rating.objects.by_item(self)}
        
        @return: List of Ratings on this object.
        @rtype: list<Rating>
        """
        return Rating.by_item(self)
    
    @property
    def rating_by_current_user(self):
        try:
            user = current_user()
            if not user.is_authenticated(): raise UserNotAuthenticated
            #print repr(user)
            #print repr([self, self.id])
            r = self.rating_by_user(user)
            #print repr([r, r.id, r.score, r.item])
            return self.rating_by_user(user)
        except UserNotAuthenticated:
            return None
    
    def rating_by_user(self, user):
        """
        @summary: Returns a the Rating the specified user put on this object.
        If the user has not rated this object, then I{None} is returned.
        
        @param user: User object or an integer to be used as the user_id.  
            Optional - if not specified, the currently logged in user will be used.
        @type user: None, User, or int
        
        @return: None, or a single Rating
        @rtype: NoneType, or Rating
        """
        return Rating.by_item_and_user(self, user)
    
    @property
    def average_rating(self):
        """
        @summary: Returns a RatingCount object which contains the rating
        and count computed for this object during the last computation cycle.
        May also return None, if 
            * a cycle has not occurred since this item was first rated
            * all ratings for this item have zero weights
            * there are no ratings for this item
        
        @return: RatingCount for this object, or None
        @rtype: None, or RatingCount
        """
        ratings = Rating.by_item(self)
        sum = 0.0
        weight = 0
        count = 0
        for r in ratings:
            sum += r.weighted_score
            weight += r.weight
            count += 1
        return RatingCount.sum_weight_count(sum, weight, count)
    
    def add_rating(self, score, user):
        """
        @summary:
        Adds a Rating associated with this object.  Acceptable scores are listed
        at L{Rating}.
        If the score is out of range, a RatingOutOfRange exception will be raised.
        If the specified user (or current user if none is specified) has already
        rated this object, a RatingAlreadyExistsForUser exception will be raised.
        
        @return: None, or Rating
        @rtype: None, or Rating
        
        @raise RatingOutOfRange: Raised if the I{score} is not within the constraints
            outline in L{Rating}
        @raise RatingAlreadyExistsForUser: Raised if the I{user} has already rated
            this object
        """
        return Rating.add(item=self, score=score, user=user)

    
class AggregateRatingMixin:
    """
    @summary:
    B{AggregateRatingMixin} is a mix-in used to provide aggregate rating methods
        to L{Node} objects.
    """
    def direct_aggregate_rating(self, interest=None):
        """"
        @return: AggregateRating
        """
        return self._get_aggregate_rating(interest, AggregateRating.TYPES['DIRECT'])

    def inherited_aggregate_rating(self, interest=None):
        """
        Average of parent scores
        @return: AggregateRating
        """
        return self._get_aggregate_rating(interest, AggregateRating.TYPES['INHERITED'])
    
    def summary_aggregate_rating(self, interest=None):
        """
        Average of child scores
        @return: AggregateRating
        """
        return self._get_aggregate_rating(interest, AggregateRating.TYPES['SUMMARY'])
    
    def score(self, interest=None):
        """
        Combination of direct and inherited ratings. Return AggregateRating.
        @return: AggregateRating
        """
        return self._get_aggregate_rating(interest, AggregateRating.TYPES['SCORE'])
    
    def _get_aggregate_rating(self, interest, type):
        """
        @return: AggregateRating
        """
        return AggregateRating.get_or_none(node=self, interest=interest, type=type)

    def calculate_direct_aggregate_rating(self, interest=None):
        """
        Calculate direct aggr rating.
        @return: AggregateRating
        ## notice that self is used as node for AggregateRating
        """
        if interest:
            behaviors = self.behaviors_by_dimension(interest, False)
        else:
            behaviors = self.behaviors
        rc = Rating.average_the_averages(behaviors)
        # for now, don't store null ratings
        if rc.rating:
            AggregateRating.update(rc.rating, rc.count, self, interest, AggregateRating.TYPES['DIRECT'])

    def calculate_inherited_aggregate_rating(self, interest=None):
        """
        Calculate average of parent scores
        @return: AggregateRating
        """
        return AggregateRatingMixin._inherited_aggregate_rating(self, interest)
    
    def calculate_summary_aggregate_rating(self, interest=None):
        """
        Calculate average of child scores
        @return: AggregateRating
        """
        return AggregateRatingMixin._summary_aggregate_rating(self, interest)

    def calculate_score(self, interest=None):
        """
        Calculate score, which is a combination of direct and inherited ratings
        @return: AggregateRating
        """
        return AggregateRatingMixin._score(self, interest)
    
    def apply_portfolio(self, user=None):
        """
        Returns RatingCount
        """
        user = user or current_user()
        if user and user.is_authenticated():
            uips = user.profile.get_interests()
        else:
            # get the "default" portfolio from the first user, who we know is munin our default user
            uips = User.objects.get(id=1).profile.get_interests()

        sum = 0.0
        weight = 0
        count = 0
        for uip in uips:
            if uip.active:
                score = self.score(uip.interest)
                if score:
                    sum += score.rating * uip.percent
                    weight += uip.percent
                    count += score.count
        return RatingCount.sum_weight_count(sum, weight, count)

    @staticmethod
    def _inherited_aggregate_rating(node, interest=None, path=None, cache=None):
        if path == None: path = []
        if cache == None: cache = {}
        
        if node in path:
            #LOOP DETECTED!
            #raise RuntimeError("Loop detected!.  %s<id=%s> is its own ancestor through %s." % 
            #                   (node, str(node.id), str([p.id for p in params['ancestor_path']])))
            return None
        if node.id in cache:
            return cache[self.id]
        
        sum = 0.0
        weight = 0.0
        count = 0
        path.append(node)
        for e in node.parent_edges:
            nir = AggregateRatingMixin._score(e.src, interest, path, cache)
            if nir:
                sum += nir.rating*e.cached_weighting
                weight += e.cached_weighting
                count += nir.count
        
        if sum:
            result = sum / weight
            path.pop()
            ar =  AggregateRating.update(result, count, node, interest, AggregateRating.TYPES['INHERITED'])
            cache[node.id] = ar
            return ar
        else:
            result = None
            path.pop()
            cache[node.id] = None
            return None

    @staticmethod
    def _summary_aggregate_rating(node, interest=None, path=None, cache=None):
        ### TODO computes wrongs results
        if path == None: path = []
        if cache == None: cache = {}

        if node in path:
            #LOOP DETECTED!
            #raise RuntimeError("Loop detected!.  %s<id=%s> is its own ancestor through %s." % 
            #                   (node, str(node.id), str([p.id for p in params['ancestor_path']])))
            return None
        if node.id in cache:
            return cache[self.id]

        sum = 0.0
        weight = 0.0
        count = 0
        path.append(node)
        for e in node.child_edges:
            nir = AggregateRatingMixin._score(e.dest, interest, path, cache)
            if nir:
                sum += nir.rating*e.cached_weighting
                weight += e.cached_weighting
                count += nir.count
        
        if sum:
            result = sum / weight
            path.pop()
            ar =  AggregateRating.update(result, count, node, interest, AggregateRating.TYPES['SUMMARY'])
            cache[node.id] = ar
            return ar
        else:
            result = None
            path.pop()
            cache[node.id] = None
            return None
    
    @staticmethod
    def _score(node, interest=None, path=None, cache=None):
        if path == None: path = []
        if cache == None: cache = {}
        
        if node in path:
            #LOOP DETECTED!
            #raise RuntimeError("Loop detected!.  %s<id=%s> is its own ancestor through %s." % 
            #                   (node, str(node.id), str([p.id for p in params['ancestor_path']])))
            if node.id in cache:
                return self.id
            else:
                return None
        if node.id in cache:
            return cache[self.id]
        sum = 0.0
        weight = 0.0
        count = 0
        path.append(node)
        for e in node.parent_edges:
            nir = AggregateRatingMixin._score(e.src, interest, path, cache)
            if nir:
                sum += nir.rating*e.cached_weighting
                weight += e.cached_weighting
                count += nir.count
        d_aggr_r = node.direct_aggregate_rating(interest)
        if d_aggr_r:
            sum += d_aggr_r.rating
            weight += 1.0
            count += d_aggr_r.count
        if sum:
            result = sum / weight
            path.pop()
            ar =  AggregateRating.update(result, count, node, interest, AggregateRating.TYPES['SCORE'])
            cache[node.id] = ar
            return ar
        else:
            result = None
            path.pop()
            cache[node.id] = None
            return None

class AggregateRating(models.Model):
    """
    @summary:
    
    
    """
    rating = models.FloatField(null=True, blank=True)
    count = models.IntegerField()
    
    # a null interest could mean that this aggregate rating is also an average across interests.
    interest = models.ForeignKey(graph.Dimension, null=True)
    node = models.ForeignKey(graph.Node)
    
    # Valid Types
    TYPES = {'DIRECT':'D',
             'INHERITED':'I',
             'SUMMARY':'Y',
             'SCORE':'S',
             }
    # for database (data, friendly_name)
    TYPES_CHOICES = (
                    (TYPES['DIRECT'], 'DIRECT',),
                    (TYPES['INHERITED'], 'INHERITED',),
                    (TYPES['SUMMARY'], 'SUMMARY',),
                    (TYPES['SCORE'], 'SCORE',),
                    )
    
    type = models.CharField(max_length=1, choices=TYPES_CHOICES, default=TYPES['SCORE'])
    
    last_updated = models.DateTimeField(auto_now_add=True)
    
    @classmethod
    def Initialize(klass):
        """
        @summary: Mixes the AggregateRatingMixin class into the Node model class
        
        @return: None
        @rtype: NoneType
        """
        mixin(AggregateRatingMixin, graph.Node)
        
    @classmethod
    def update(klass, rating, count, node, interest, type):
        """
        updates or adds an AgregateRating for the specified node, interest or type (updates rating if already exists or creates new AggregateRating)
        """
        ar = AggregateRating.get_or_none(node=node, interest=interest, type=type)
        if ar:
            ar.rating = rating
            ar.count = count
            ar.last_updated = datetime.datetime.now()
            ar.save()
        else:
            ar = AggregateRating.add(rating, count, node, interest, type)
        return ar
    
    @classmethod
    def make(klass, rating, count, node, interest, type):
        return AggregateRating(rating=rating, count=count, node=node, interest=interest, type=type)

    def __unicode__(self):
        return "rating: %s, count: %s, type: %s, interest: %s, node: %s" % (self.rating, self.count, self.type, self.interest, self.node)

class AggregateRatingRanking(models.Model):
    """
    Table of top MAX_RANK Nodes. interest, node and type repeated here for 
    speed (raher than looking them up in the aggregaterating)
    """
    rank = models.IntegerField()
    aggregate_rating = models.ForeignKey(AggregateRating)
    interest = models.ForeignKey(graph.Dimension, null=True)
    node = models.ForeignKey(graph.Node)
    type = models.CharField(max_length=1, choices=AggregateRating.TYPES_CHOICES, default=AggregateRating.TYPES['SCORE'])
    MAX_RANK = 9999
    
    @classmethod
    def calculate(klass, interest, ttype):
        """
        Assumes aggregate_ratings have already been calculated
        """
        l = list(AggregateRating.objects.filter(interest=interest, type=ttype))
        l.sort(lambda x, y: cmp(y.rating, x.rating))
        for arr in AggregateRatingRanking.objects.filter(interest=interest, type=ttype):
            arr.delete()
        for i in range(0, len(l)):
            AggregateRatingRanking.add(i, l[i])
       
    @classmethod 
    def _top_filter(klass, interest, type):
        """
        one way to do calculation, especially if low MAX_RANK. not currently used.
        """
        top = []
        for ag in AggregateRating.objects.filter(interest=interest, type=type):
            if len(top) < AggregateRatingRanking.MAX_RANK:
                top.append(ag)
            elif ag.rating > top[-1].rating:
                top.append(ag)
                top.sort()
                top = top[:-1]
        # delete old stuff before adding new stuff to keep data consistent
        for arr in AggregateRatingRanking.objects.filter(interest=interest, type=type):
            arr.delete()
        for i in range(0, AggregateRatingRanking.MAX_RANK):
            AggregateRatingRanking.add(i, top[i])
    
    @classmethod
    def make(klass, rank, aggregate_rating):
        if rank > AggregateRatingRanking.MAX_RANK:
            raise "rank %s greater than MAX_RANK %s" % (rank, AggregateRatingRanking.MAX_RANK)
        arr = AggregateRatingRanking.get_or_none(aggregate_rating=aggregate_rating)
        if arr:
            raise AlreadyExists("AggregateRatingRanking %i already exists for this rank and agg_rating %s %s" % (arr.id, rank, aggregate_rating))
        else:
            return AggregateRatingRanking(rank=rank,
                                          aggregate_rating=aggregate_rating,
                                          interest=aggregate_rating.interest,
                                          node=aggregate_rating.node,
                                          type=aggregate_rating.type)
            
    def __unicode__(self):
        return "%s: %s, %s" % (self.rank, self.interest, self.type)

class TotalEvaluation(models.Model):
    score = models.FloatField(null=True, blank=True)
    count = models.IntegerField()
    weight = models.IntegerField()
    
    review = models.ForeignKey(graph.Behavior)
    # no interest could mean overall total
    interest = models.ForeignKey(graph.Dimension, null=True)
    type = models.ForeignKey('EvaluationType', null=True)
    last_updated = models.DateTimeField(auto_now_add=True)
        
    @classmethod
    def update(klass, score, count, weight, review, interest, type):
        """
        updates or adds a TotalEvaluation for the specified review, interest and type (updates if already exists or creates new TotalEvaluation)
        """
        te = TotalEvaluation.get_or_none(review=review, interest=interest, type=type)
        if te:
            te.score = score
            te.count = count
            te.weight = weight
            te.last_updated = datetime.datetime.now()
            te.save()
        else:
            te = TotalEvaluation.add(score, count, weight, review, interest, type)
            
        #print "TOTAL EVALUATION: %s" % te
        return te
    
    @classmethod
    def update_total_evaluation(klass, review, interest, evaluation, add_eval=True):
        """
        updates existing TotalEvaluation
        if one doesn't exist, creates one if add_eval is True
        add_eval answers the question of whether the provided evaluation
        is being added to the total score or removed.
        """
        te = TotalEvaluation.get_or_none(review=review, interest=interest, type=evaluation.type)
        if te:
            if add_eval:
                new_sum = te.score * te.weight + evaluation.weighted_score
                new_weight = te.weight + evaluation.weight
                new_count = te.count + 1
            else:
                new_sum = te.score * te.weight - evaluation.weighted_score
                new_weight = te.weight - evaluation.weight
                new_count = te.count - 1
                
            te.count = new_count
            te.weight = new_weight
            if new_weight:
                te.score = new_sum / new_weight
            else:
                te.score = 0
            te.save()
        elif add_eval:
            te = TotalEvaluation.add(evaluation.weighted_score, 1, evaluation.weight, review, interest, evaluation.type)
        return te
                
    @classmethod
    def make(klass, score, count, weight, review, interest, type=type):
        return TotalEvaluation(score=score,
                               count=count,
                               weight=weight,
                               review=review,
                               interest=interest,
                               type=type)

    def __unicode__(self):
        return "score: %s, count: %s, type: %s, interest: %s, review: %s" % (self.score, self.count, self.type, self.interest, self.review)

class EvaluationRanking(models.Model):
    """
    Table of top MAX_RANK Reviews. interest, node and type repeated here for 
    speed (raher than looking them up in the aggregaterating)
    """
    rank = models.IntegerField()
    aggregate_rating = models.ForeignKey(AggregateRating)
    interest = models.ForeignKey(graph.Dimension, null=True)
    node = models.ForeignKey(graph.Node)
    type = models.CharField(max_length=1, choices=AggregateRating.TYPES_CHOICES, default=AggregateRating.TYPES['SCORE'])
    MAX_RANK = 9999
    
    @classmethod
    def calculate(klass, interest, ttype):
        """
        Assumes aggregate_ratings have already been calculated
        """
        l = list(AggregateRating.objects.filter(interest=interest, type=ttype))
        l.sort(lambda x, y: cmp(y.rating, x.rating))
        for arr in AggregateRatingRanking.objects.filter(interest=interest, type=ttype):
            arr.delete()
        for i in range(0, len(l)):
            AggregateRatingRanking.add(i, l[i])
       
    @classmethod 
    def _top_filter(klass, interest, type):
        """
        one way to do calculation, especially if low MAX_RANK. not currently used.
        """
        top = []
        for ag in AggregateRating.objects.filter(interest=interest, type=type):
            if len(top) < AggregateRatingRanking.MAX_RANK:
                top.append(ag)
            elif ag.rating > top[-1].rating:
                top.append(ag)
                top.sort()
                top = top[:-1]
        # delete old stuff before adding new stuff to keep data consistent
        for arr in AggregateRatingRanking.objects.filter(interest=interest, type=type):
            arr.delete()
        for i in range(0, AggregateRatingRanking.MAX_RANK):
            AggregateRatingRanking.add(i, top[i])
    
    @classmethod
    def make(klass, rank, aggregate_rating):
        if rank > AggregateRatingRanking.MAX_RANK:
            raise "rank %s greater than MAX_RANK %s" % (rank, AggregateRatingRanking.MAX_RANK)
        arr = AggregateRatingRanking.get_or_none(aggregate_rating=aggregate_rating)
        if arr:
            raise AlreadyExists("AggregateRatingRanking %i already exists for this rank and agg_rating %s %s" % (arr.id, rank, aggregate_rating))
        else:
            return AggregateRatingRanking(rank=rank,
                                          aggregate_rating=aggregate_rating,
                                          interest=aggregate_rating.interest,
                                          node=aggregate_rating.node,
                                          type=aggregate_rating.type)


class EvaluationType(models.Model):
    label = models.CharField(max_length=200, unique=True, verbose_name="Evaluation Type Name")
    score = models.IntegerField(default=0)

    @classmethod
    def DEFAULT_GOOD(klass):
        return EvaluationType.get_or_none(label='Insightful', score=1) 
    
    @classmethod
    def DEFAULT_BAD(klass):
        return EvaluationType.get_or_none(label='Mean', score=-1)
    
    @classmethod
    def DEFAULT_OVERALL(klass):
        return EvaluationType.get_or_none(label='Overall', score=0)
    
    @classmethod
    def install(klass):
        """
        @summary: Install SOURCE
        """
        if EvaluationType.objects.count() == 0:
            EvaluationType.add('Insightful', score=1).publish()
            EvaluationType.add('Mean', score=-1).publish()
            EvaluationType.add('Overall', score=0).publish()

    @classmethod
    def make(klass, label, score=0):
        try:
            n = EvaluationType.get(label=label)
            raise AlreadyExists("EvaluationType %i already exists for this label, %s" % (n.id, label))
        except EvaluationType.DoesNotExist:
            return EvaluationType(label=label, score=score)

    def __unicode__(self):
        return "%s: %s" % (self.label, self.score)

class Evaluation(models.Model):
    """
    @summary:
    An Evaluation is an individual judgment of some object.  This will be most obvious
    with judgment of B{Behaviors}, but the B{Evaluation} model itself can be pointed
    at any object.
    An Evaluation is a many-to-one relationship.  An object can have an unlimited number
    of Evaluations, but each Evaluation points at only one object.
    Users are limited to having one Evaluation per object.
    
    @var EVALUABLE_MODELS: The Model classes which will receive the EvaluationMixin
    @type EVALUABLE_MODELS: list<models.Model>
    """ 
    
    # Model must have a 'user' property
    EVALUABLE_MODELS = [
        graph.Node, graph.Edge, graph.Response,
        graph.Dimension, graph.Behavior, graph.UPC,
        graph.Article ]
    
    weight = models.IntegerField(default=1)
    weighted_score = models.IntegerField(default=1)
    
    type = models.ForeignKey(EvaluationType)
    
    item_type = models.ForeignKey(ContentType)
    item_id = models.PositiveIntegerField()
    item = generic.GenericForeignKey('item_type', 'item_id')
    
    user = models.ForeignKey(User) # user who created evaluated (who evaluated item)
    
    @classmethod
    def Initialize(klass):
        """
        @summary: Mixes the RatingMixin class into the Model classes
        specified in Rating.RATEABLE_MODELS
        
        @return: None
        @rtype: NoneType
        """
        mixin(EvaluationMixin, Evaluation.EVALUABLE_MODELS)
        
        models.signals.post_save.connect(Evaluation.on_create, sender=Evaluation)
        models.signals.pre_delete.connect(Evaluation.on_delete, sender=Evaluation)

    @classmethod
    def on_create(klass, signal, sender, instance, created, **kwargs):
        """
        @summary: 
        This method is called every time an Evaluation has been saved.
        If the evaluation has just been created, adjust status.
        """
        if created:
            # adjust status of user whose work is being evaluated
            instance.item.user.profile.apply_evaluation(instance)
            # adjust total evaluation of work
            instance.item.compute_total_evaluation(instance.type)
            instance.item.compute_total_evaluation()
        return

    @classmethod
    def on_delete(klass, signal, sender, instance, **kwargs):
        """
        @summary: 
        This method is called every time an Evaluation is about to be deleted.
        Adjust status.
        """
        # adjust status of user whose work is being un-evaluated (by unapplying)
        instance.item.user.profile.unapply_evaluation(instance)
        # adjust total evaluation of work
        instance.item.compute_total_evaluation(instance.type)
        instance.item.compute_total_evaluation()
        return
            
    @staticmethod
    def by_item_and_user_and_evaltype(item, user, evaltype):
        """
        @return: Evaluation or none
        """
        item_type_id = ContentType.objects.get_for_model(item).id
        return Evaluation.get_or_none(user=user,
                                      item_type=item_type_id,
                                      item_id=item.id,
                                      type=evaltype)
    
    @staticmethod
    def by_item_and_evaltype(item, evaltype):
        """
        @return: QuerySet of evaluations (maybe empty)
        """
        item_type_id = ContentType.objects.get_for_model(item).id
        return Evaluation.objects.filter(item_type=item_type_id,
                                         item_id=item.id,
                                         type=evaltype)
    @staticmethod
    def by_item(item):
        """
        @return: QuerySet of evaluations (maybe empty)
        """
        item_type_id = ContentType.objects.get_for_model(item).id
        return Evaluation.objects.filter(item_type=item_type_id,
                                         item_id=item.id)
        
    @staticmethod
    def add(item, evaltype):
        user = current_user()
        if not user.is_authenticated(): raise UserNotAuthenticated
        
        #Make sure item is Evaluable
        if not item.__class__ in Evaluation.EVALUABLE_MODELS:
            raise "InvalidMixin: got %s of type %s." % (item, item.__class__)
        
        if not evaltype:
            raise NoneEvalType("")
        
        #Make sure the user has not already voted.
        if Evaluation.by_item_and_user_and_evaltype(item, user, evaltype):
            raise EvaluationAlreadyExistsForUser("User has already evaluated this item: %s" % (item))
        
        # Now make the call.
        item_type_id = ContentType.objects.get_for_model(item).id
        e = Evaluation.objects.create(item_type_id=item_type_id, 
                                      item_id=item.id, 
                                      type=evaltype, 
                                      weight=user.profile.eval_weight,
                                      weighted_score=evaltype.score*user.profile.eval_weight,
                                      user=user)
        return e
        
    def __unicode__(self):
        return "%s:%s on %s" % (self.type, self.weighted_score, self.item)
    
class EvaluationMixin:
    """
    @summary:
    B{EvaluationMixin} is a mix-in used to provide common methods, attributes,
    and hooks to all the models that can be given L{Evaluation}s.  The list
    of these objects can be found at L{Evaluation.EVALUABLE_MODELS}.
    
    At initialization, EvaluationMixin.B{_apply} is applied to all the models
    listed in L{Evaluation.EVALUABLE_MODELS}.
    """
    
    def evaluations(self, evaltype=None):
        """
        @summary: Convenience method.  Maps to B{Evaluation.objects.by_item(self)}
        
        @return: List of Evaluations on this object.
        @rtype: list<Evaluation>
        """
        if evaltype:
            return Evaluation.by_item_and_evaltype(self, evaltype)
        else:
            ret = []
            for evaltype in EvaluationType.objects.all():
                evals = Evaluation.by_item_and_evaltype(self, evaltype)
                if evals:
                    ret += evals
            return ret
    
    def user_has_evaluated_positively(self):
        for e in self.evaluations_by_current_user():
            if e.type.score > 0:
                return True
        return False
    
    def user_has_evaluated_negatively(self):
        for e in self.evaluations_by_current_user():
            if e.type.score < 0:
                return True
        return False
    
    def evaluation_by_current_user(self, evaltype):
        evaltype = evaltype or EvaluationType.DEFAULT_OVERALL()
        try:
            user = current_user()
            if not user.is_authenticated(): raise UserNotAuthenticated
            return self.evaluation_by_user(user, evaltype)
        except UserNotAuthenticated:
            return None
    
    def evaluation_by_user(self, user, evaltype):
        """
        @summary: Returns the Evaluation that the user put on this object.
        If the user has not evaluated this object, then I{None} is returned.
        
        @param user: User object or an integer to be used as the user_id.  
            Optional - if not specified, the currently logged in user will be used.
        @type user: None, User, or int
        
        @return: None, or a single Evaluation
        @rtype: NoneType, or Evaluation
        """
        return Evaluation.by_item_and_user_and_evaltype(self, user, evaltype)
    
    def evaluations_by_current_user(self):
        ret = []
        for evaltype in EvaluationType.objects.all():
            e = self.evaluation_by_current_user(evaltype)
            if e:
                ret.append(e)
        return ret
    
    def total_evaluation(self, evaltype=None):
        """
        @summary: Returns TotalEvaluation of this object.
        If an EvaluationType is not specified, an overall evaluation is given.
        
        @return: total evaluation
        @rtype: TotalEvaluation
        """
        #evaltype = evaltype or EvaluationType.DEFAULT_OVERALL()
        return TotalEvaluation.get_or_none(review=self, type=evaltype)
        
    def compute_total_evaluation(self, evaltype=None):
        """
        @summary: compute TotalEvaluation for this object. 
        
        @return: total evaluation
        @rtype: 
        """
        if evaltype:
            evals = Evaluation.by_item_and_evaltype(self, evaltype)
        else:
            evals = Evaluation.by_item(self)
        sum = 0.0
        count = 0
        weight = 0
        for e in evals:
            sum += e.weighted_score
            weight += e.weight
            count += 1
        #print "COMPUTE: sum: %s, weight: %s, count: %s, type: %s" % (sum, weight, count, evaltype)
        if weight == 0:
            return TotalEvaluation.update(0, count, weight, self, self.dimension, evaltype)
        else:
            return TotalEvaluation.update(sum/weight, count, weight, self, self.dimension, evaltype)
    
    def evaluate(self, evaltype):
        """
        @summary: add evaluation by current_user
        """
        e = self.evaluation_by_current_user(evaltype)
        if not e:
            e = Evaluation.add(self, evaltype)
            TotalEvaluation.update_total_evaluation(e.item, e.item.dimension, e, add_eval=True)

    def un_evaluate(self, evaltype, e=None):
        """
        @summary: remove evaluation by current_user
        """
        e = e or self.evaluation_by_current_user(evaltype)
        if e:
            TotalEvaluation.update_total_evaluation(e.item, e.item.dimension, e, add_eval=False)
            e.delete()

    def toggle_evaluation(self, evaltype):
        """
        @summary: add or remove evaluation by current_user, depending on whether one already exists or not
        @return: True if user has evaluated at end of method, False otherwise
        """
        e = self.evaluation_by_current_user(evaltype)
        if e:
            self.un_evaluate(evaltype, e)
            return False
        else:
            self.evaluate(evaltype)
            return True

    def thumb_up(self):
        self.evaluate(EvaluationType.DEFAULT_GOOD())
        self.un_evaluate(EvaluateType.DEFAULT_BAD())
        
    def thumb_down(self):
        self.evaluate(EvaluationType.DEFAULT_BAD())
        self.un_evaluate(EvaluateType.DEFAULT_GOOD())

    def thumb_one(self, evaltype):
        """
        @summary: add or remove evaluation by current_user, depending on whether one already exists or not.
                  remove all other evaluations, too.
        @return: True if user has evaluated at end of method, False otherwise
        """
        for e in self.evaluations_by_current_user():
            if e.type != evaltype:
                self.un_evaluate(e.type, e)
        return self.toggle_evaluation(evaltype)
