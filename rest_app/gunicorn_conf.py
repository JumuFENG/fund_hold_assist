# -*- coding: utf-8 -*-
# 为了更好的管理gunicorn, 通常会写个config文件，在项目目录下创建gunicorn_conf.py文件，内容如下
import os
import multiprocessing

# 获取当前该配置文件的绝对路径。gunicorn的配置文件是python文件,所以可以直接写python代码

path_of_current_file = os.path.abspath(__file__)

path_of_current_dir = os.path.split(path_of_current_file)[0]

chdir = path_of_current_dir

#workers = multiprocessing.cpu_count() * 2 + 1  # 可以理解为进程数，会自动分配到你机器上的多CPU，完成简单并行化

workers = 1  # 我这里不用多进程

worker_class = 'sync'  # 默认的worker的类型，如何选择见：[http://docs](http://docs).[gunicorn.org/en/stable/design.html#choosing-a-worker-type](http://gunicorn.org/en/stable/design.html#choosing-a-worker-type)

bind = '0.0.0.0:5000'  # 服务使用的端口

pidfile = '%s/gunicorn.pid' % path_of_current_dir  # 存放Gunicorn进程pid的位置，便于跟踪

accesslog = '%s/logs/gunicorn_access.log' % path_of_current_dir  # 存放访问日志的位置，注意首先需要存在logs文件夹，Gunicorn才可自动创建log文件

errorlog = '%s/logs/gunicorn_error.log' % path_of_current_dir  # 存放错误日志的位置，可与访问日志相同

reload = True  # 如果应用的代码有变动，work将会自动重启，适用于开发阶段

daemon = False   # 是否后台运行

debug = False

timeout = 5   # server端的请求超时秒数

loglevel = 'error'

