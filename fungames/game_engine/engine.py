


import twitter as twitter_api
#from fungames.models import Game

class Engine(object):
    def __init__(self, game):
        self.game = game
        
    def get_tweets(self):
        api = twitter_api.Api('funoggle', 'suite15sweet')
        print api.GetReplies()
        

if __name__ == '__main__':
    Engine('funoggle').get_tweets()
