from django.db import models, connection

from django.contrib.contenttypes.models import ContentType
from django.contrib.contenttypes import generic
from django.dispatch import dispatcher
from django.utils.html import escape
from django.db import connection
#from django.db.backends.mysql.base import Database

from utils import cached_property, mixin_property, mixin_method, mixin

"""
@summary:
The B{tag} module contains the Tag functionality.
Tags are words, or categories, that link many objects of different types.
"""

class TagManager(models.Manager):
    def get_query_set(self):
        return super(TagManager, self).get_query_set().extra(
            
            )
    def with_taggings(self):
        from django.db import connection
        cursor = connection.cursor()
        cursor.execute("""
            SELECT p.id, p.question, p.poll_date, COUNT(*)
            FROM polls_opinionpoll p, polls_response r
            WHERE p.id = r.poll_id
            GROUP BY 1, 2, 3
            ORDER BY 3 DESC""")
        #result_list = []
        #for row in cursor.fetchall():
        #    p = self.model(id=row[0], question=row[1], poll_date=row[2])
        #    p.num_responses = row[3]
        #    result_list.append(p)
        #return result_list
        
        
        
        sql_clause = qs._get_sql_clause()
        ct_type_id = ContentType.objects.get_for_model(self).id
        
        #tagging_sql = Tagging.objects.filter(item_type=ct_type_id)
        join_tagging = "".join(["SELECT DISTINCT item_id, tag_id",
                                " FROM db_tagging",
                                " WHERE item_type_id = %s" % ct_type_id])
        
        join_tagging_tag = ("SELECT %s.id " +
                            qs.model._meta.db_table,
                            sql_clause[1] % tuple(sql_clause[2]))
        
        from_clause = ", ".join(["db_tag AS tag",
                                 "(%s) AS tagging" % tagging_sql,
                                 "(%s) AS item" % item_sql])
        
        where_cond  = " AND ".join(['tagging.item_id = item.id',
                                    'tagging.tag_id = tag.id'])
        
        sql = "".join(["SELECT tag.*, COUNT(*) AS popularity",
                       "  FROM %(from_clause)s",
                       "  WHERE %(where_cond)s",
                       "  GROUP BY tagging.tag_id",
                       "  ORDER BY popularity DESC " +
                       "  LIMIT %(limit)s"]) % {
            'from_clause': from_clause,
            'where_cond' : where_cond,
            'limit': limit }
        
        c = connection.cursor()
        c.execute(sql)
        tags = []
        for row in c.fetchall():
            t = Tag(*row[0:2])
            t.count = row[2]
            tags.append(t)
        return tags

class Tag(models.Model):
    """
    @summary:
    A B{Tag} is a word or short phrase used to describe an object.  An object can have many B{Tags}
    associated with it.
    
    @ivar tag: A string to identify an object.
    @type tag: string
    
    @cvar TAGGABLE_MODELS:
    @type TAGGABLE_MODELS:
    """

    @classmethod
    def Initialize(klass):
        """
        @summary: 
        Mixes TagMixin class into all the classes listed in L{Tag.TAGGABLE_MODELS}
        
        @return: None
        @rtype: NoneType
        """
        mixin(TagMixin, Tag.TAGGABLE_MODELS)
        
        for model_class in Tag.TAGGABLE_MODELS:
            model_class.add_to_class('tagging_set', 
                                     generic.GenericRelation(Tagging,
                                                             object_id_field="item_id",
                                                             content_type_field="item_type"))
            
    
    
    tag = models.SlugField(max_length=255)
    
    @classmethod
    def tags_for(klass, items):
        def binder(item, taggings):
            tags = [t.tag for t in taggings]
            setattr(getattr(item, "taggings"), "_result_cache", taggings)
            setattr(getattr(item, "tags"), "_result_cache", tags)
            
        from utils import merge_polymorphic
        merge_polymorphic(items, binder, Tagging.objects.select_related())
        
    
    @classmethod
    def by_tag(klass, tag):
        """
        @summary: Returns a QuerySet containing all Taggings for specified tag.
        @param tag: A single tag
        @type tag: string, or Tag
        @return: Returns a QuerySet containing all Taggings for the specified tag.
        @rtype: QuerySet
        """
        return Tagging.objects.filter(tag__in=tag)
    
    @classmethod
    def by_item(klass, item):
        """
        @summary: Returns a QuerySet containing all Taggings which refer to this object.
        @rtype: QuerySet
        """
        item_type_id = ContentType.objects.get_for_model(item).id
        return Tag.objects.extra(tables=['db_tagging'], 
                                 where=['db_tag.id = db_tagging.tag_id AND db_tagging.item_type_id = %s AND db_tagging.item_id = %s' % \
                                 #where=["db_tag.id IN (SELECT tag_id FROM db_tagging WHERE item_type_id = %s AND item_id = %s)" % \
                                        (item_type_id, item.id)])
    
    @classmethod
    def by_items_qs(klass, qs):
        sql_clause = qs._get_sql_clause()
        ct_type_id = ContentType.objects.get_for_model(qs.model).id
        tagging_sql = "SELECT item_id, tag_id FROM db_tagging WHERE item_type_id = %s" % ct_type_id
        qs_join_sql = ("SELECT `%s`.id " % qs.model._meta.db_table) + (sql_clause[1] % tuple(sql_clause[2]))
        return Tag.objects.extra(
            tables=['(%s) AS taggings' % tagging_sql,
                    '(%s) AS items' % qs_join_sql],
            where =['taggings.item_id = items.id',
                    'taggings.tag_id = db_tag.id']).distinct()
    
    @classmethod
    def by_items(klass, items):
        get_for_model = ContentType.objects.get_for_model
        ct_type_id = lambda item: get_for_model(item).id
        
        tt_sql = []
        tt_sql.append(" ".join([
                    "CREATE TEMPORARY TABLE Tag__by_items(",
                    "  type_id INT,",
                    "  id INT",
                    ") ENGINE=MEMORY"]))
        tt_sql.append(" ".join(
                    ["INSERT INTO Tag__by_items ",
                     "  (type_id, id) ",
                     "  VALUES ",
                     ",".join([("(%s, %s)" % (ct_type_id(item), item.id)) for item in items[:]])]))
        
        from django.db import connection
        c = connection.cursor()
        for sql in tt_sql:
            c.execute(sql)
        
        tags = Tag.objects.extra(
            tables=['Tag__by_items item',
                    #'db_tag',
                    'db_tagging'],
            where =['item.type_id = db_tagging.item_type_id',
                    'item.id = db_tagging.item_id',
                    'db_tag.id = db_tagging.tag_id'])
        
        c.execute("DROP TABLE Tag__by_items")
        return tags
    
    @classmethod
    def cloud_qs(klass, qs, offset=0, limit=20):
        return []
        sql_clause = qs._get_sql_clause()
        ct_type_id = ContentType.objects.get_for_model(qs.model).id
        
        tagging_sql = Tagging.objects.filter(item_type=ct_type_id)
        tagging_sql = "".join(["SELECT DISTINCT item_id, tag_id",
                               " FROM db_tagging",
                               " WHERE item_type_id = %s" % ct_type_id])
        
        item_sql = "".join(["SELECT `",qs.model._meta.db_table,"`.id ",
                               sql_clause[1] % tuple(sql_clause[2])])
        
        from_clause = ", ".join(["db_tag AS tag",
                                 "(%s) AS tagging" % tagging_sql,
                                 "(%s) AS item" % item_sql])
        
        where_cond  = " AND ".join(['tagging.item_id = item.id',
                                    'tagging.tag_id = tag.id'])
        
        sql = "".join(["SELECT tag.*, COUNT(*) AS popularity",
                       "  FROM %(from_clause)s",
                       "  WHERE %(where_cond)s",
                       "  GROUP BY tagging.tag_id",
                       "  ORDER BY popularity DESC " +
                       "  LIMIT %(limit)s"]) % {
            'from_clause': from_clause,
            'where_cond' : where_cond,
            'limit': limit }
        
        c = connection.cursor()
        c.execute(sql)
        tags = []
        for row in c.fetchall():
            t = Tag(*row[0:2])
            t.count = row[2]
            tags.append(t)
        return tags
            
    @classmethod
    def cloud(kls, where='1=1', limit=20, klass=None):
        """
        @summary:
        
        
        @param where: A string containing arbitrary 'WHERE' conditions for the query
        @type where: string
        @param limit: The maximum number of Tag objects to return.  Defaults to 20.
        @type limit: int
        @param klass: The Model class for which the Tag cloud is desired.  Only Taggings
        on this class (if provided) will be included in the cloud calculation.
        @type klass: Any
        
        @return: Returns a list of Tag objects.  Each returned object also has a
        'count' attribute for use in ordering or displaying the cloud.
        @rtype: list<Tag>
        """
        join_cond = "tagging.tag_id = tag.id"
        if not klass is None:
            item_type_id = ContentType.objects.get_for_model(klass).id
            join_cond += " AND tagging.item_type_id = %s " % item_type_id
        
        sql = ("SELECT tag.*, COUNT(*) as popularity " +
               "FROM db_tag as tag INNER JOIN db_tagging as tagging ON %(join_cond)s " +
               "WHERE %(where_cond)s " +
               "GROUP BY tagging.tag_id ORDER BY popularity DESC " +
               "LIMIT %(limit)s") % {
            'join_cond': join_cond,
            'where_cond':  where,
            'limit': limit }
        c = connection.cursor()
        c.execute(sql)
        tags = []
        for row in c.fetchall():
            t = Tag(*row[0:2])
            t.count = row[2]
            tags.append(t)
        return tags
        
    
    @classmethod
    def make(klass, tag):
        """
        @summary: Finds or creates a Tag with the specified tag.  This method
        first checks for an existing tag before creating one.
        
        @param tag: A short phrase or single word (no spaces, but underscores okay).
        @type tag: string
        
        @return: Instantiated, unsaved Tag object.
        @rtype:  Tag
        """
        t = Tag.objects.filter(tag=tag)[:]
        if len(t) is 0:
            return Tag(tag=tag)
        else:
            return t[0]
    
    @classmethod
    def add_with_item(klass, tag, item):
        """
        @summary: Add a tagging to this object.  This method automatically
        adds the tag to the Tags table if it does not already exist.
        @return: The Tag object
        @rtype: Tag
        """
        t = Tag.add(tag)
        Tagging.add(t, item)
        return t
    
    def __unicode__(self):
        return self.tag
    class Admin:
        pass


class TagMixin(object):
    """
    @summary:
    B{TagMixin} is a mix-in used to provide common methods, attributes,
    and hooks to all the models that can be given L{Tag} labels.  The list
    of these objects can be found at L{tag.Tag}.
    
    At initialization, TagMixin.B{_apply} is applied to all the models
    listed in L{tag.Tag}.
    """
    
    @classmethod
    def by_tag_id(klass, tag_ids):
        """
        @summary: Returns a QuerySet containing all Taggings which refer to 
        an object of this class.
        @rtype: QuerySet
        """
        if not isinstance(tag_ids, list):
            tag_ids = [tag_ids]
        tag_ids = ",".join(["'%s'"%str(t) for t in tag_ids])
        item_type_id = ContentType.objects.get_for_model(klass).id
        db_table = klass._meta.db_table
        
        params = { 'tag_ids': tag_ids,
                   'item_type_id': item_type_id,
                   'db_table': db_table }
        
        select   = {'value':'tagging_count.value'} 
        subquery = ("(SELECT db_tagging.item_id, COUNT(db_tagging.item_id) AS value "+
                      "FROM db_tag, db_tagging "+
                      "WHERE db_tagging.tag_id IN (%(tag_ids)s) "+
                      #"WHERE db_tag.id IN (%(tag_ids)s) "+
                        "AND db_tagging.item_type_id = %(item_type_id)s "+
                      #  "AND db_tagging.tag_id = db_tag.id "+
                      "GROUP BY db_tagging.item_id) AS tagging_count") % params
        #subquery = ("(SELECT db_tagging.item_id, SUM(1) AS value "+
        #              "FROM db_tag, db_tagging "+
        #              "WHERE db_tagging.tag_id IN (%(tag_ids)s) "+
        #              #"WHERE db_tag.id IN (%(tag_ids)s) "+
        #                "AND db_tagging.item_type_id = %(item_type_id)s "+
        #              #  "AND db_tagging.tag_id = db_tag.id "+
        #              "GROUP BY db_tagging.item_id) AS tagging_count") % params
        condition = 'tagging_count.item_id = %(db_table)s.id' % params
        order = '-value'
        print "select: %s" % select
        print "tables: %s" % subquery
        print "condition: %s" % condition
        print "order: %s" % order
        return klass.find().extra(select=select, tables=[subquery],
                                  where=[condition]).order_by(order)
    
    @classmethod
    def by_tag(klass, tags):
        """
        @summary: Returns a QuerySet containing all Taggings which refer to 
        an object of this class.
        @rtype: QuerySet
        """
        esc = connection.connection.escape_string
        
        if not isinstance(tags, list):
            tags = [tags]
        tags = ",".join(["'%s'" % esc(t) for t in tags])
        item_type_id = ContentType.objects.get_for_model(klass).id
        db_table = klass._meta.db_table
        
        params = { 'tags': tags,
                   'item_type_id': item_type_id,
                   'db_table': db_table }
        
        select   = {'value':'tagging_count.value'} 
        subquery = ("(SELECT db_tagging.item_id, COUNT(db_tagging.item_id) AS value "+
                      "FROM db_tag, db_tagging "+
                      "WHERE db_tag.tag IN (%(tags)s) "+
                        "AND db_tagging.item_type_id = %(item_type_id)s "+
                        "AND db_tagging.tag_id = db_tag.id "+
                      "GROUP BY db_tagging.item_id) AS tagging_count") % params
        #subquery = ("(SELECT db_tagging.item_id, SUM(1) AS value "+
        #              "FROM db_tag, db_tagging "+
        #              "WHERE db_tag.tag IN (%(tags)s) "+
        #                "AND db_tagging.item_type_id = %(item_type_id)s "+
        #                "AND db_tagging.tag_id = db_tag.id "+
        #              "GROUP BY db_tagging.item_id) AS tagging_count") % params
        condition = 'tagging_count.item_id = %(db_table)s.id' % params
        order = '-value'
        return klass.find().extra(select=select, tables=[subquery],
                                  where=[condition]).order_by(order)
    
    @classmethod
    def tag_cloud(klass):
        """
        @summary: Returns the Tag.cloud for tags referencing an object of this class.
        Returned Tags have the additional 'count' property'
        @rtype: list<Tag>
        """
        return Tag.cloud(klass=klass)
    
    @cached_property
    def taggings(self):
        """
        """
        return self.tagging_set.filter()
    
    @cached_property
    def tags(self):
        """
        @summary: Returns a QuerySet containing all Tags which refer to this object.
        @rtype:  QuerySet
        """
        return Tag.by_item(self)
    
    def add_tag(self, tag):
        """
        @summary: Adds a Tagging from this object to the specified Tag.
        This method will create the Tag if it does not already exist.
        @rtype: Tag
        """
        return Tag.add_with_item(tag, self)


class Tagging(models.Model):
    """
    @summary:
    A B{Tagging} is a single link between an object and a word, or B{Tag}.  There can
    be many B{Taggings} for any B{Tag} or object.
    
    @ivar tag: A foreign key into the B{Tag} model.
    @type tag: int, or Tag
    @ivar item: The object the Tagging references.
    @type item: Any
    @ivar item_type: The B{ContentType} id of B{item}
    @type item_type: int, or ContentType
    @ivar item_id: The id of B{item} in the appropriate table.
    @type item_id: int
    """
    
    tag = models.ForeignKey(Tag, related_name='tagging_set')
    
    item_type = models.ForeignKey(ContentType)
    item_id = models.PositiveIntegerField()
    item = generic.GenericForeignKey('item_type', 'item_id')
    
    
    @classmethod
    def make(klass, tag, item):
        """
        @summary: Instantiates, but does not save, a new Tagging object.
        
        @param tag:  
        @type tag:   Tag, string, or integer
        @param item: 
        @type item:  Any
        
        @return: 
        @rtype:  
        """
        if not isinstance(tag, Tag):
            tag = Tag.by_tag(tag)
        return Tagging(tag=tag,
                       item_type=ContentType.objects.get_for_model(item), 
                       item_id=item.id)
    
    
    def __unicode__(self):
        return self.tag.tag
    class Admin:
        pass

