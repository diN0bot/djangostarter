

from django import template
import utils

register = template.Library()


def expr_filter(s, a=None, b=None, c=None, d=None):
    scope = { 'a':a,'b':b,'c':c,'d':d  }
    return eval(s, scope)
register.filter("expr", expr_filter)

def map_fields(o, field):
    return [getattr(item, field) for item in o];
register.filter("map_fields", map_fields)


class ExprNode(template.Node):
    def __init__(self, kwargs):
        self.kwargs = kwargs
        
    def render(self, context):
        d = {}
        for frame in reversed(list(context)):
            d.update(frame)
        #d['_'] = _
        for name,expr in self.kwargs:
            try:
                val = eval(expr, d)
                context[name] = val
            except:
                raise
        return ''

def do_expr(parser, token):
    args, kwargs = utils.split_args(token.contents)
    kwargs = utils.parse_arg(kwargs, parser)
    kwargs = [[k,v] for k,v in kwargs.items()]
    return ExprNode(kwargs)
do_expr = register.tag('expr', do_expr)


class WithManyNode(template.Node):
    def __init__(self, kwargs, nodelist):
        self.kwargs = kwargs
        self.nodelist = nodelist
        
    def render(self, context):
        kwargs = dict(self.kwargs)
        kwargs = utils.resolve(kwargs, context)
        #print repr(kwargs)
        context.update(kwargs)
        result = self.nodelist.render(context)
        context.pop()
        return result

def do_withmany(parser, token):
    args, kwargs = utils.split_args(token.contents)
    kwargs = utils.parse_arg(kwargs, parser)
    kwargs = [[k,v] for k,v in kwargs.items()]
    nodelist = parser.parse(('endwithmany',))
    parser.delete_first_token()
    return WithManyNode(kwargs, nodelist)
register.tag('withmany', do_withmany)


class LetNode(template.Node):
    def __init__(self, kwargs):
        self.kwargs = kwargs
        
    def render(self, context):
        kwargs = dict(self.kwargs)
        kwargs = utils.resolve(kwargs, context)
        for key,value in kwargs.items():
            context[key] = value
        return ''

def do_let(parser, token):
    args, kwargs = utils.split_args(token.contents)
    kwargs = utils.parse_arg(kwargs, parser)
    kwargs = [[k,v] for k,v in kwargs.items()]
    return LetNode(kwargs)
register.tag('let', do_let)


class GrabNode(template.Node):
    def __init__(self, varname, nodelist):
        self.varname = varname
        self.nodelist = nodelist
        
    def render(self, context):
        context[self.varname] = self.nodelist.render(context)
        return ''

def do_grab(parser, token):
    args, kwargs = utils.split_args(token.contents)
    varname = args[1]
    nodelist = parser.parse(('endgrab', 'end'))
    parser.delete_first_token()
    return GrabNode(varname, nodelist)
register.tag('grab', do_grab)
register.tag('key', do_grab)

