

from django import template
from django.template.loader import get_template

from app.lib.patterns import *

import pprint
pp = pprint.PrettyPrinter(indent=2)

TEMPLATE_TAG_PATTERNS_ = {
    'maybecomma': r'(?:\s*,|,\s*|\s+)',
    'token'   : r'(?:%(string)s|%(float)s|%(int)s|%(variable)s)',
    'token_n' : r'(?:(?P<string>%(string)s)|(?P<float>%(float)s)|(?P<int>%(int)s)|(?P<variable>%(variable)s))',
    'variable': r'(?:\*|[@$&]?[a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z0-9_]+)*)',
    
    'filter_arguments'  : r'(?:%(colon)s(?:%(token)s))',
    'filter_arguments_n': r'(?:%(colon)s(?P<argument>%(token)s))',
    'filter'  : r'(?:(?:%(variable)s)(?:(?:%(colon)s%(token)s)*))',
    'filter_n': r'(?:(?P<function>%(variable)s)(?P<arguments>(?:%(colon)s%(token)s)+)?)',
    'filter_chain_n': r'(?:(?P<token>%(token_n)s)(?P<filters>(?:%(bar)s%(filter)s)+)?)',
    
    #'args_kwargs':
    'key_arg': r'(?:(?:(?P<key>%(variable)s)%(equal)s)?(?P<value>%(filter_chain_n)s|%(token)s)(?:%(maybecomma)s|$))'
    
    }
TEMPLATE_TAG_PATTERNS = dict(BASE_PATTERNS)
TEMPLATE_TAG_PATTERNS.update(TEMPLATE_TAG_PATTERNS_)
TEMPLATE_TAG_PATTERNS = init_patterns(TEMPLATE_TAG_PATTERNS)


filter_args_re = compile('filter_arguments_n', TEMPLATE_TAG_PATTERNS)
filter_re = compile('filter_n', TEMPLATE_TAG_PATTERNS)
key_arg_re = compile('key_arg', TEMPLATE_TAG_PATTERNS)

def parse_filter_chain(filter_chain):
    return [[fc[0],filter_args_re.findall(fc[1])] for fc in filter_re.findall(filter_chain)]
    
def split_args(s):
    from django.utils.encoding import force_unicode
    s = force_unicode(s)
    args = []
    kwargs = {}
    #for m in args_kwargs_re.finditer(s):
    for m in key_arg_re.finditer(s):
        a = m.groupdict()
        if a['key']:
            kwargs[a['key']] = a['token']
        elif a['filters']:
            args.append(a['token']+"".join(a['filters']))
        else:
            args.append(a['token'])
    return args, kwargs



literal_string_re = compile_raw('^%(string)s$', BASE_PATTERNS)# re.compile(r'^(?:\"(?:[^\"\\]*(?:\\.[^\"\\]*)*)\"|\'(?:[^\'\\]*(?:\\.[^\'\\]*)*)\')$')
literal_float_re = compile_raw('^%(float)s$', BASE_PATTERNS) # re.compile(r'^(?:\d+\.\d*|\.\d+)$')
literal_int_re = compile_raw('^%(int)s$', BASE_PATTERNS) # re.compile(r'^(?:\d+)$')

class VariableCouldNotBeParsed(Exception): pass

def parse_arg(arg, parser, parse_fn=None):
    """
    Maps each argument to one of:
     - template.Variable
     - template.FilterExpression
    * returned object has 'resolve(context)' method
    """
    parse_fn = parse_fn or parse_arg
    
    if isinstance(arg, (list, tuple)):
        return map(lambda a: parse_fn(a, parser), arg)
    
    if isinstance(arg, (dict)):
        return dict(map(lambda k: [k, parse_fn(arg[k], parser)], arg.keys()))
    
    if isinstance(arg, (str, unicode)):
        if literal_string_re.match(arg):
            return arg[1:-1]
        if literal_float_re.match(arg):
            return float(arg)
        if literal_int_re.match(arg):
            return int(arg)
        return template.FilterExpression(arg, parser)
    
    """
    Augments utils.parse_arg to support:
     - module.ScopeVariable 
       - for resolving '@var' state variables in proper scope)
     - module.BlockReference 
       - for resolving '&1' or '&var' references
    """
    #if isinstance(arg, (str, unicode)):
    #    if arg.startswith('@'):
    #        return parse_scope_variable(arg[1:])
    #    if arg.startswith('&'):
    #        return parse_scope_reference(arg[1:])
    
    raise VariableCouldNotBeParsed("Unknown variable type: '%s', '%s'" % (v, type(v)))



def resolve(v, scope, resolve_fn=None):
    from django import template
    
    if isinstance(v, template.Variable):
        return v.resolve(scope)
    if isinstance(v, template.FilterExpression):
        return v.resolve(scope)
    
    if isinstance(v, (list, tuple)):
        resolve_fn = resolve_fn or resolve_arg_callback
        return [resolve_fn(a, scope) for a in v]
    
    if isinstance(v, (dict)):
        resolve_fn = resolve_fn or resolve_arg_callback
        return dict(map(lambda k: [k, resolve_fn(v[k], scope)], v.keys()))
    
    if isinstance(v, (template.Variable, template.FilterExpression)):
        return v.resolve(scope)
    
    return v
resolve_arg_callback = lambda a,c: resolve(a, c)



###########    
## UTILS ##
###########
#
#
#PATTERNS = {
#    'maybecomma': r'(?:\s*,|,\s*|\s+)',
#    'comma'   : r'(?:\s*,\s*)',
#    'equal'   : r'(?:\s*=\s*)',
#    'bar'     : r'(?:\s*\|\s*)',
#    'colon'   : r'(?:\s*:\s*)',
#    
#    'string'  : r'(?:\"(?:[^\"\\]*(?:\\.[^\"\\]*)*)\"|\'(?:[^\'\\]*(?:\\.[^\'\\]*)*)\')',
#    'float'   : r'(?:\d+\.\d*|\.\d+)',
#    'int'     : r'(?:\d+)',
#    #'literal' : r'(?:%(string)s|%(float)s|%(int)s)',
#    'variable': r'(?:\*|[@$&]?[a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z0-9_]+)*)',
#    #'array_items':  r'(?:(?:%(token)s)(?:%()s))',
#    #'array_items_p':r'(?:(?:%(token)s)(?))',
#    #'array'   : r'(?:\[\s*(?:%(array_items)s)\s*\])',
#    #'dictpair': r'(?:(?:%(token)s)%(colon)s(?:%(token)s))',
#    #'dictpair_p':r'(?:(?P<key>%(token)s)%(colon)s(?P<value>%(token)s))',
#    #'dictpairs':r'(?:(?:%(dictpair)s)(?:%(comma)s(?:(?:%(dictpair)s%(comma)s)*%(dictpair)s?))?)',
#    #'dictpairs_p':r'(?:(?P<pair>%(dictpair)s)(?:%(comma)s(?P<rest>(?:%(dictpair)s%(comma)s)*%(dictpair)s?))?)',
#    #'dict'    : r'(?:\{\s*(?:%(dictpairs)s)?\s*\})',
#    'token'   : r'(?:%(string)s|%(float)s|%(int)s|%(variable)s)',
#    #'token_p' : r'(?:(%(string)s)|(%(float)s)|(%(int)s)|(%(variable)s))',
#    'token_n' : r'(?:(?P<string>%(string)s)|(?P<float>%(float)s)|(?P<int>%(int)s)|(?P<variable>%(variable)s))',
#    'filter_arguments': r'(?:%(colon)s(?:%(token)s))',
#    'filter_arguments_p': r'(?:%(colon)s(%(token)s))',
#    'filter_arguments_n': r'(?:%(colon)s(?P<argument>%(token)s))',
#    
#    'filter'  : r'(?:(?:%(variable)s)(?:(?:%(colon)s%(token)s)*))',
#    #'filter_p': r'(?:(%(variable)s)((?:%(colon)s%(token)s)+)?)',
#    'filter_n': r'(?:(?P<function>%(variable)s)(?P<arguments>(?:%(colon)s%(token)s)+)?)',
#    #'filter_chain' :  r'(?:%(token)s(?:%(bar)s%(filter)s)*)',
#    #'filter_chain_p': r'(?:(%(token_p)s)((?:%(bar)s%(filter_p)s)*)?)',
#    'filter_chain_n': r'(?:(?P<token>%(token_n)s)(?P<filters>(?:%(bar)s%(filter)s)+)?)',
#    #'pair'    : r'(?:(?P<key>%(variable)s)%(equal)s(?P<value>%(filter_chain)s|%(token)s))',
#    #'pair_p'    : r'(?:(?P<key>%(variable)s)%(equal)s(?P<value>%(filter_chain_p)s|%(token_p)s))',
#    #'arg'     : r'(?:%(filter_chain)s|%(token)s)',
#    #'arg_p'     : r'(?:%(filter_chain_p)s|%(token_p)s)',
#    #'next_arg': r'(?:(?:(?P<pair>%(pair)s)|(?P<arg>%(arg)s))(?:%(maybecomma)s|$))',
#    'key_arg': r'(?:(?:(?P<key>%(variable)s)%(equal)s)?(?P<value>%(filter_chain_n)s|%(token)s)(?:%(maybecomma)s|$))'
#    }
#
#P = PATTERNS
#p = lambda s: re.compile(P[s] % P % P % P % P % P)
#
#filter_args = p('filter_arguments')
#filter = p('filter')
#key_arg_re = p('key_arg')
#
#from django.utils.encoding import force_unicode
#
#"""
#Returns [args, kwargs] without resolving or modifying text
#- args is the list of arguments and keys in their original order
#- kwargs is a dict
#
#"""
#def parse_filter_chain(filter_chain):
#    return [[fc[0],filter_args.findall(fc[1])] for fc in filter.findall(filter_chain)]
#
#def split_args(s):
#    s = force_unicode(s)
#    args = []
#    kwargs = {}
#    for m in key_arg_re.finditer(s):
#        a = m.groupdict()
#        token = a['token']
#        if a['key']:
#            kwargs[a['key']] = token
#        #    args.append(a['key'])
#        elif a['filters']:
#        #    args.append([a['token'], parse_filter_chain(a['filters'])])
#            args.append(a['token']+"".join(parse_filter_chain(a['filters'])))
#        else:
#            args.append(token)
#    return args, kwargs
#
#
#
#literal_string_re = re.compile(r'^(?:\"(?:[^\"\\]*(?:\\.[^\"\\]*)*)\"|\'(?:[^\'\\]*(?:\\.[^\'\\]*)*)\')$')
#literal_float_re = re.compile(r'^(?:\d+\.\d*|\.\d+)$')
#literal_int_re = re.compile(r'^(?:\d+)$')
#
#class VariableCouldNotBeParsed(Exception): pass
#
#def parse_arg(arg, parser, parse_fn=None):
#    """
#    Maps each argument to one of:
#     - template.Variable
#     - template.FilterExpression
#    * returned object has 'resolve(context)' method
#    """
#    parse_fn = parse_fn or parse_arg
#    
#    if isinstance(arg, (list, tuple)):
#        return map(lambda a: parse_fn(a, parser), arg)
#    
#    if isinstance(arg, (dict)):
#        return dict(map(lambda k: [k, parse_fn(arg[k], parser)], arg.keys()))
#    
#    if isinstance(arg, (str, unicode)):
#        if literal_string_re.match(arg):
#            return arg[1:-1]
#        if literal_float_re.match(arg):
#            return float(arg)
#        if literal_int_re.match(arg):
#            return int(arg)
#        return template.FilterExpression(arg, parser)
#    
#    """
#    Augments utils.parse_arg to support:
#     - module.ScopeVariable 
#       - for resolving '@var' state variables in proper scope)
#     - module.BlockReference 
#       - for resolving '&1' or '&var' references
#    """
#    #if isinstance(arg, (str, unicode)):
#    #    if arg.startswith('@'):
#    #        return parse_scope_variable(arg[1:])
#    #    if arg.startswith('&'):
#    #        return parse_scope_reference(arg[1:])
#    
#    raise VariableCouldNotBeParsed("Unknown variable type: '%s', '%s'" % (v, type(v)))
