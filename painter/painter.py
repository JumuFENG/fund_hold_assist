# Python 3
# -*- coding:utf-8 -*-

import matplotlib as mpl
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
import matplotlib.animation as animation

class Painter():
    """
    draw basic history info.
    """

    def readHistoryData(self):
        pass

    def draw_figure(self):
        pass

    def on_motion(self, event):
        self.moving_on_figure = True

    def enter_figure(self, event):
        self.cidmotion = plt.gca().get_figure().canvas.mpl_connect('motion_notify_event', self.on_motion)

    def leave_figure(self, event):
        self.moving_on_figure = False
        plt.gca().get_figure().canvas.mpl_disconnect(self.cidmotion)

    def update(self, data):
        plt.gca().clear()
        self.draw_figure()

    def gen_data(self):
        yield self.dates, self.values
        
    def show_graph(self):
        self.readHistoryData()
        mpl.rcParams['font.sans-serif'] = ['SimHei'] #指定默认字体 SimHei为黑体
        self.draw_figure()
        plt.gca().get_figure().canvas.mpl_connect('figure_enter_event', self.enter_figure)
        plt.gca().get_figure().canvas.mpl_connect('figure_leave_event', self.leave_figure)
        ani = animation.FuncAnimation(plt.gca().get_figure(), self.update, self.gen_data, interval=100)
        plt.show()
