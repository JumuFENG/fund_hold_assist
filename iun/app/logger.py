import os, sys
import logging


class LazyLogger:
    def __init__(self):
        self._logger = None
        
    def _init_logger(self):
        if self._logger is None:
            lg_path = os.path.join(os.path.dirname(__file__), '../logs/iun.log')
            logging.basicConfig(
                level=logging.INFO,
                format='[%(levelname)s] %(asctime)s-%(name)s: %(message)s',
                handlers=[logging.FileHandler(lg_path), logging.StreamHandler(sys.stdout)]
            )
            self._logger = logging.getLogger('iun')
    
    def __getattr__(self, name):
        self._init_logger()
        return getattr(self._logger, name)

logger = LazyLogger()
