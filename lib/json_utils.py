from django.contrib.contenttypes.models import ContentType
from django.core.serializers.json import DjangoJSONEncoder
from django.db import models
from django.http import Http404, HttpResponseRedirect, HttpResponse
from django.utils import simplejson

def get_item(item_id, item_type):
    if isinstance(item_type, (int, long)):
        item_type = ContentType.objects.get(id=item_type)
    if isinstance(item_type, ContentType):
        item_type = item_type.model_class()
    return item_type.objects.get(id=item_id)

def get_type(item):
    if isinstance(item, (int, long)):
        return ContentType.objects.get(id=item);
    else:
        return ContentType.objects.get_for_model(item)


def get_params(dict, *args, **kwargs):
    """
    @summary: Tries to extract parameters from the provided dict for each keyword.
    If a parameter isn't found, the keyword's value is returned.
    """
    ret = []
    for k in args:
        if isinstance(k, (tuple, list)):
            if k[0] in dict: ret.append(dict[k])
            else: ret.append(k[1])
        else:
            ret.append(dict[k])
    return ret


def default_fields(obj):
    if isinstance(obj, models.Model):
        return [f.attname for f in obj._meta.fields]
    return []
    
def get_field(obj, path):
    if not isinstance(path, (list, tuple)):
        path = [path]
    
    ret = obj
    for p in path:
        if isinstance(ret, models.Model):
            if isinstance(p, str):
                ret = getattr(ret, p)
            else:
                raise RuntimeError("Invalid path: %s" % (".".join(path),))
            
        elif isinstance(ret, models.query.QuerySet):
            if isinstance(p, (int, long)):
                ret = ret[p]
            #elif isinstance(p, (slice)):
            #    ret = list(ret.__iter__(field))
            else:
                raise RuntimeError("Invalid path: %s" % (".".join(path),))
            
        elif isinstance(ret, dict):
            try:
                ret = ret[p]
            except:
                raise RuntimeError("%s %s %s" % (ret, ret.__class__, str(path)))
            
        else:
            raise RuntimeError("Invalid path: %s" % (".".join(path),))
        
    #if isinstance(ret, models.Model):
    #    ret = dict([(f.attname, f.value_from_object(ret)) for f in ret._meta.fields])
    #elif not isinstance(ret, (int, long, str, unicode, dict, list)):
    #    raise RuntimeError("Path leads to non-json object! %s => <%s> %s" % (".".join(path), ret.__class__, ret))

    return ret

def get_data(obj, fields=None):
    """
    @summary:
    Given an object and a structured list of fields, returns a dict, list, int, or str.
    """
    if fields is None:
        return obj
    elif not isinstance(fields, (tuple, list)):
        return get_field(obj, fields)
    else:
        if len(fields) == 0 or fields[0] == '*':
            fields = default_fields(obj) + fields[1:]
        fields = list(fields)
    
    #handle double-array, which denotes an iterable object
    if len(fields) == 1 and isinstance(fields[0], list):
        return [get_data(o, fields[0]) for o in obj]
    
    ret = {}
    for f in fields:
        if not f: #guarantees not empty string or list
            continue
        elif isinstance(f, str):
            ret[f] = get_field(obj, f)
        elif isinstance(f, list) and isinstance(f[0], str):
            name = f[0]
            path = subfields = None
            
            if isinstance(f[1], str): path = f[1].split(".") 
            else: path = [name]
            if isinstance(f[-1], list): subfields = f[-1]
            else: subfields = None
            
            if subfields is None:
                ret[name] = get_field(obj, path)
            else:
                ret[name] = get_data(get_field(obj, path), subfields)
        else:
            raise RuntimeError("Invalid field: %s" % str(f))
    return ret
    
def get_json(obj, fields=None):
    return simplejson.dumps(get_data(obj, fields), cls=DjangoJSONEncoder)

def to_json(obj):
    return simplejson.dumps(obj, cls=DjangoJSONEncoder)

def json_response(data):
    if not isinstance(data, (str, unicode)):
        data = to_json(data)
    return HttpResponse(data, mimetype="text/javascript")
