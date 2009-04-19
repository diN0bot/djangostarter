import exceptions, re, os

import user_profile.middleware
import settings

from django.shortcuts import get_object_or_404

"""
@summary:
The B{utils} module provide methods and classes which are not 
specific to any model.

"""
class UserNotAuthenticated(RuntimeError): pass
class UserObjectOrIntegerExpected(RuntimeError): pass

class AlreadyExists(RuntimeError): pass

def mixin(mixin, klasses, last=0):
    if not isinstance(klasses, (list, tuple)):
        klasses = (klasses,)
    for klass in klasses:
        if mixin not in klass.__bases__:
            if last:
                klass.__bases__ = klass.__bases__+(mixin,)
            else:
                klass.__bases__ = (mixin,)+klass.__bases__

def mixin_method(klasses):
    if not isinstance(klasses, (list, tuple)):
        klasses = (klasses,)
    def decorator(func):
        for klass in klasses:
            setattr(klass, func.__name__, func)
    return decorator

def mixin_property(klasses):
    if not isinstance(klasses, (list, tuple)):
        klasses = (klasses,)
    def decorator(func):
        for klass in klasses:
            setattr(klass, func.__name__, property(func, doc=func.__doc__))
    return decorator

if 'user_profile' in settings.APPS:
    def current_user():
        """
        @summary: Retrieves currently logged in user or AnonymousUser from request.
        This wouldn't make sense outside of a webapp. That makes this a webapp starter.
        @return: User or AnonymousUser
        """
        return user_profile.middleware.get_current_user()

#Decorator ideas from http://wiki.python.org/moin/PythonDecoratorLibrary#head-5348d85be3a972ad67398fafb370b5bca39c8341
def clean_decorator(decorator):
    """
    @summary:
    This decorator can be used to turn simple functions
    into well-behaved decorators, so long as the decorators
    are fairly simple. If a decorator expects a function and
    returns a function (no descriptors), and if it doesn't
    modify function attributes or docstring, then it is
    eligible to use this. Simply apply @simple_decorator to
    your decorator and it will automatically preserve the
    docstring and function attributes of functions to which
    it is applied.
    """
    def new_decorator(f):
        g = decorator(f)
        g.__name__ = f.__name__
        g.__doc__ = f.__doc__
        g.__dict__.update(f.__dict__)
        return g
    # Now a few lines needed to make simple_decorator itself
    # be a well-behaved decorator.
    new_decorator.__name__ = decorator.__name__
    new_decorator.__doc__ = decorator.__doc__
    new_decorator.__dict__.update(decorator.__dict__)
    return new_decorator

def merge_many_to_many(items, binder, queryset, single_result=False, 
                       id_path="id"):
    from django.db.models.query import Q, QAnd, QOr
    from operator import itemgetter, attrgetter
    from itertools import repeat, groupby
    
    # Generate the Q objects and the (type_id, id)-ordered item list
    id_path_q = id_path + "__in"
    
    item_ids = map(attrgetter("id"), items)
    q = Q(**{ id_path_q : item_ids })
    item_set = dict(zip(item_ids, items))
    
    results = queryset.filter(q).order_by(id_path + "_id")[:]
    
    id_path_attr = id_path + "_id"
    
    result_set = {}
    item_group = groupby(results, attrgetter(id_path_attr)) #lambda result: result.id)
    for item_id, item_iter in item_group:
        result_set[item_id] = list(item_iter)
        
    #print repr((results))
    #print repr((result_set))
    
    for item_id, item in item_set.items():
        item_results = result_set.get(item_id, [])
        binder(item, item_results)
        
    return


def merge_polymorphic(items, binder, queryset, single_result=False, 
                      base_path="", item_type_path="item_type", item_id_path="item_id"):
    from django.db.models.query import Q, QAnd, QOr
    from django.contrib.contenttypes.models import ContentType
    from operator import itemgetter, attrgetter
    from itertools import repeat, groupby
    
    get_content_type = ContentType.objects.get_for_model
    
    # First, separate the items by type
    klass_items = {}
    for item in items:
        klass_items.setdefault(type(item), []).append(item)
    
    #ct_q = []
    #for model in klass_items.keys():
    #    ct_q.append(QAnd( Q(app_label=model._meta.app_label),
    #                      Q(model=model._meta.module_name) ))
    #ct_q = QOr(*ct_q)
    #ContentType.objects.filter(ct_q)._get_data()
    
    # Second, map each type and item to its id
    #klass_items = [(klass, items) for klass, items in klass_items.items()]
        
    # Third, generate the Q objects and the (type_id, id)-ordered item list
    qs = []
    item_set = {}
    
    item_type_path_q = base_path + item_type_path + "__id"
    item_id_path_q = base_path + item_id_path + "__in"
    
    for model, items in klass_items.items(): #.items():
        type_id = get_content_type(model).id
        item_ids = map(attrgetter("id"), items)
        qs.append( QAnd( Q(**{ item_type_path_q : type_id  }),
                         Q(**{ item_id_path_q   : item_ids }) ))
        item_set[type_id] = dict(zip(item_ids, items))
        
    q = QOr(*qs)
    
    results = queryset.filter(q).order_by(item_type_path+"_id", item_id_path)[:]
    
    result_set = {}
    
    item_type_path_attr = item_type_path + "_id"
    item_id_path_attr = item_id_path
    
    type_group = groupby(results, attrgetter(item_type_path_attr)) 
    #lambda result: getattr(result, item_type_path + "_id".item_type_id)
    for type_id, type_iter in type_group:
        result_set[type_id] = {}
        item_group = groupby(type_iter, attrgetter(item_id_path_attr))
        #lambda result: item_id)
        for item_id, item_iter in item_group:
            result_set[type_id][item_id] = list(item_iter)
        
    for type_id, items in item_set.items():
        type_results = result_set.get(type_id, {})
        for item_id, item in items.items():
            item_results = type_results.get(item_id, [])
                                            #(single_result and (list(),) or (None,))[0])
            binder(item, item_results)
            
    return


import sys

def propget(func):
    locals = sys._getframe(1).f_locals
    name = func.__name__
    prop = locals.get(name)
    if not isinstance(prop, property):
        prop = property(func, doc=func.__doc__)
    else:
        doc = prop.__doc__ or func.__doc__
        prop = property(func, prop.fset, prop.fdel, doc)
    return prop

def propset(func):
    locals = sys._getframe(1).f_locals
    name = func.__name__
    prop = locals.get(name)
    if not isinstance(prop, property):
        prop = property(None, func, doc=func.__doc__)
    else:
        doc = prop.__doc__ or func.__doc__
        prop = property(prop.fget, func, prop.fdel, doc)
    return prop

def propdel(func):
    locals = sys._getframe(1).f_locals
    name = func.__name__
    prop = locals.get(name)
    if not isinstance(prop, property):
        prop = property(None, None, func, doc=func.__doc__)
    else:
        prop = property(prop.fget, prop.fset, func, prop.__doc__)
    return prop


cache_names = {}
def get_new_cache_name():
    import random
    name = "_cached_" + "".join([chr(97 + random.randint(0, 25)) for i in range(5)])
    if name in cache_names:
        return get_new_cache_name()
    else:
        return name
    
def cached_property(func, name=None):
    def deco(func, name):
        def fget(self):
            #print repr((func, name))
            if not hasattr(self, name): #name not in self._hm_cache:
                setattr(self, name, func(self)) #self._hm_cache[name] = func()
            return getattr(self, name)
            #return self._hm_cache[name]
        
        def fset(self, value):
            setattr(self, name, value)
            return getattr(self, name)
            #self._hm_cache[name] = value
            #return value
        
        def fdel(self):
            delattr(self, name)
            #del self._hm_cache[name]
        
        prop = property(fget=fget, fset=fset, fdel=fdel, doc="cached_property")
        return prop
    
    if not name:
        name = get_new_cache_name()
        
    return deco(func, name)
    
class ModelMixin(object):
    """
    @summary:
    B{ModelMixin} is a mix-in used to provide common methods, attributes,
    and hooks across all models.
    
    At initialization, ModelMixin is mixed into all models listed in 
    """
    @classmethod
    def find(klass, ids=None, **kwargs):
        """
        @summary:
        Convenience method: B{find} simply passes arguments through to
        klass.objects.filter()
        """
        if isinstance(ids, (int, long)):
            return klass.objects.filter(id=ids, **kwargs)
        elif isinstance(ids, list):
            return klass.objects.filter(id__in=ids, **kwargs)
        else:
            return klass.objects.filter(**kwargs)

    @classmethod
    def get_or_none(klass, **kwargs):
        """
        @summary:
        Convenience method: B{get_or_none} simply passes arguments through to
        klass.objects.filter()
        """
        f = klass.objects.filter(**kwargs)
        if len(f) == 0:
            return None
        else:
            return f[0]
        
    @classmethod
    def get(klass, id=None, **kwargs):
        """
        Convenience method: B{get} simply passes arguments through to 
        klass.objects.get()
        
        @note: Raises exceptions anytime 'get' would.
        """
        if isinstance(id, (int, long)):
            #return klass.objects.get_object_or_404(id=id, **kwargs)
            return get_object_or_404(klass, id=id, **kwargs)
        elif len(kwargs) > 0:
            return klass.objects.get(**kwargs)
        else:
            raise RuntimeError("No id or conditions given to 'get'!")
    
    @classmethod
    def add(klass, *args, **kwargs):
        """
        @summary:
        This is a general method which simply calls 'make' with the same
        arguments and then saves the returned object.
        """
        o = klass.make(*args, **kwargs)
        o.save()
        #if publish:
        #    o.publish()
        return o


class TextProcessor(object):
    """
    Static class for doing description processing.
    """
    tags = re.compile('<[^>]*>')
    p_endstart_tags = re.compile('</p>\s*<p>')
    p_startonlyhack_tags = re.compile('<p>')
    
    links = re.compile('(https?://\S*)') # \S matches any non-whitespace character; this is equivalent to the class [^ \t\n\r\f\v].
    domain_re = re.compile('https?://([^ /]*)')
    
    do_resave_all = False
    
    @classmethod
    def resave_all(klass, model):
        """
        one-time save all behaviors to remove html formatting.
        @param model: state-enabled model
        """
        if DescriptionProcessor.do_resave_all:
            for b in model.objects.raw().all():
                b.save()
    
    @classmethod
    def remove_html(klass, signal, sender, instance, **kwargs):
        """
        @summary: 
        PRE SAVE
        This method is called every time a model instance is saved (if signal is added).
        Removes html from textfield.
        """
        d = getattr(instance, instance.textprocessor_fieldname()).strip()
        # replace <p>\s*</p> with two carriage returns
        d = TextProcessor.p_endstart_tags.sub('%s%s' % (os.linesep, os.linesep), d)
        # replace <p> with two carriage returns
        # this is for scraped descriptions from websites that don't include </p>
        d = TextProcessor.p_startonlyhack_tags.sub('%s%s' % (os.linesep, os.linesep), d)
        # remove html tags
        d = TextProcessor.tags.sub('', d).strip()
        setattr(instance, instance.textprocessor_fieldname(), d)
        return 
    
    @classmethod
    def discover_citations(klass, signal, sender, instance, created, **kwargs):
        """
        @summary: 
        POST SAVE
        This method is called every time a Behavior (aka review) has been saved.
        Does reverse wiki processing (html->markup), discovers citations
        """
        #if created:
        #    pass
        d = instance.description
        
        # turn links into citations
        for link in DescriptionProcessor.links.findall(d):
            domain = DescriptionProcessor.domain_re.search(d).group()
            # check if domain name is already a source
            http_domain = "http://%s"%domain
            s = Node.get_or_none(label=domain)
            if not s:
                s = Node.add(label=domain, url=http_domain).publish()
            if not s.types:
                s.add_type(NodeType.SOURCE())
            a = s.behaviors.filter(url=link)
            if not a:
                a = Behavior.add(link, Dimension.SOURCE_EVAL(), url=link, node=s).publish()
            else:
                a = a[0] # TODO just one right??
            try:
                Citation.add(a, instance).publish()
            except AlreadyExists:
                pass
        return
