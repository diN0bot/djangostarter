#!/usr/bin/python

def find_file_in_ancestors(filename):
    """
    For each parent directory, check if 'filename' exists.  If found, return
    the path; otherwise raise RuntimeError.
    """
    import os
    path = os.path.realpath(os.path.curdir)
    while not filename in os.listdir(path):
        #if filename in os.listdir(path):
        #    return path
        newpath = os.path.split(path)[0]
        if path == newpath:
            raise RuntimeError("No file '%s' found in ancestor directories." % filename)
        path = newpath
    return path
    

def start_django():
    import sys
    #Now the nearest ancestor directory with a 'settings.py' file
    settings_dir = find_file_in_ancestors("settings.py")
    sys.path.append(settings_dir)
    
    from django.core.management import setup_environ
    import settings
    setup_environ(settings)
    

#Record these for posterity
#FILE_DIR = os.path.dirname(os.path.realpath(__file__))
#ORIG_DIR = os.path.realpath(os.curdir)
#PROJ_DIR = find_file_in_ancestors("settings.py")

#start_django()
