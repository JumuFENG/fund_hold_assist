# Python 3
# -*- coding:utf-8 -*-
from ftplib import  FTP
import os

class FtpHelper:
    def __init__(self, host, port, usr, pwd):
        '''ftp服务器主机IP，端口等配置'''
        self.ftp_host = host
        self.ftp_port = port
        self.ftp_user = usr
        self.ftp_passwd = pwd
        self.ftp = FTP()

    # 连接到ftp服务器
    def connect(self):
        print('connecting to ftp server %s on %s' % (self.ftp_host, self.ftp_port))
        self.ftp.connect(self.ftp_host, self.ftp_port)
 
    # 登陆到ftp服务器
    def login(self):
        print('ready to login ftp server')
        self.ftp.login(self.ftp_user, self.ftp_passwd)
        print('login ftp server successfully')
        print(self.ftp.getwelcome())

    # 友好的关闭连接
    def quit(self):
        try:
            self.ftp.quit()
            print('close ftp connection successfully')
        except Exception as e:
            print('%s' % e)

    def is_same_size(self, localfile, remotefile):
        try:
            remotefile_size = self.ftp.size(remotefile)
        except:
            remotefile_size = -1
        try:
            localfile_size = os.path.getsize(localfile)
        except:
            localfile_size = -1
        print('lo:%d  re:%d' %(localfile_size, remotefile_size),)
        if remotefile_size == localfile_size:
            return 1
        else:
            return 0 

    def download_file(self, localfile, remotefile):
        if self.is_same_size(localfile, remotefile):
            print('%s 文件大小相同，无需下载' %localfile)
            return
        else:
            print('>>>>>>>>>>>>下载文件 %s ... ...' %localfile)
        #return
        file_handler = open(localfile, 'wb')
        self.ftp.retrbinary('RETR %s'%(remotefile), file_handler.write)
        file_handler.close()

    def download_dir(self, localdir='./', remotedir='./'):
        try:
            self.ftp.cwd(remotedir)
        except:
            debug_print('目录%s不存在，继续...' %remotedir)
            return
        if not os.path.isdir(localdir):
            os.makedirs(localdir)
        print('切换至目录 %s' %self.ftp.pwd())
        self.file_list = []
        self.ftp.dir(self.get_file_list)
        remotenames = self.file_list
        #print(remotenames)
        #return
        for item in remotenames:
            filetype = item[0]
            filename = item[1]
            local = os.path.join(localdir, filename)
            if filetype == 'd':
                self.download_files(local, filename)
            elif filetype == '-':
                self.download_file(local, filename)
        self.ftp.cwd('..')
        print('返回上层目录 %s' %self.ftp.pwd())

    def upload_file(self, localfile, remotefile):
        if not os.path.isfile(localfile):
            return
        if self.is_same_size(localfile, remotefile):
            print('跳过[相等]: %s' %localfile)
            return
        file_handler = open(localfile, 'rb')
        self.ftp.storbinary('STOR %s' %remotefile, file_handler)
        file_handler.close()
        print('已传送: %s' %localfile)

    def upload_dir(self, localdir='./', remotedir = './'):
        if not os.path.isdir(localdir):
            return
        localnames = os.listdir(localdir)
        try:
            self.ftp.mkd(remotedir)
        except:
            print('目录已存在 %s', remotedir)

        self.ftp.cwd(remotedir)
        for item in localnames:
            src = os.path.join(localdir, item)
            if os.path.isdir(src):
                try:
                    self.ftp.mkd(item)
                except:
                    print('目录已存在 %s' % item)
                self.upload_dir(src, item)
            else:
                self.upload_file(src, item)
        self.ftp.cwd('..')

    def get_file_list(self, line):
        ret_arr = []
        file_arr = self.get_filename(line)
        if file_arr[1] not in ['.', '..']:
            self.file_list.append(file_arr)
            
    def get_filename(self, line):
        pos = line.rfind(':')
        while(line[pos] != ' '):
            pos += 1
        while(line[pos] == ' '):
            pos += 1
        file_arr = [line[0], line[pos:]]
        return file_arr
