# Python 3
# -*- coding:utf-8 -*-

import os
import base64
from PIL import Image
from struct import unpack
import ddddocr

class GifToFrames():
    """gif ot frames"""
    def __init__(self, gifname, pngname):
        self.gifname = gifname
        self.pngname = pngname
        
    def convert_to_frames(self, suffix = '.bmp'):
        frames = []
        im = Image.open(self.gifname)
        try:
            while True:
                cur = im.tell()
                fname = self.pngname + str(cur) + suffix
                im.save(fname)
                frames.append(fname)
                im.seek(cur + 1)
        except EOFError:
            pass

        return frames

    def convert_to_bmps(self):
        return self.convert_to_frames('.bmp')

    def convert_to_pngs(self):
        return self.convert_to_frames('.png')

    def morningstar_star_num(self, bmpName):
        im = Image.open(bmpName)
        data = im.convert('1').getdata()

        return int(list(data).count(0) / 42)


class OcrCaptcha():
    ocr = None

    @classmethod
    def img_to_text(self, img):
        if self.ocr is None:
            self.ocr = ddddocr.DdddOcr()

        if isinstance(img, str):
            if os.path.isfile(img):
                with open(img, 'rb') as f:
                    img = f.read()
            else:
                img = base64.b64decode(img.encode())
        return self.ocr.classification(img)


class ReadBMPFile():
    def __init__(self, filePath):
        file = open(filePath, "rb") # 读取 bmp 文件的文件头 14 字节 
        self.bfType = unpack("<h", file.read(2))[0] # 0x4d42 对应BM 表示这是Windows支持的位图格式 
        self.bfSize = unpack("<i", file.read(4))[0] # 位图文件大小 
        self.bfReserved1 = unpack("<h", file.read(2))[0] # 保留字段 必须设为 0 
        self.bfReserved2 = unpack("<h", file.read(2))[0] # 保留字段 必须设为 0 
        self.bfOffBits = unpack("<i", file.read(4))[0] # 偏移量    从文件头到位图数据需偏移多少字节（位图信息头、调色板长度等不是固定的，这时就需要这个参数了） # 读取 bmp    文件的位图信息头 40 字节 
        self.biSize = unpack("<i", file.read(4))[0] # 所需要的字节数 
        self.biWidth = unpack("<i", file.read(4))[0] # 图像的宽度 单位 像素 
        self.biHeight = unpack("<i", file.read(4))[0] # 图像的高度 单位 像素 
        self.biPlanes = unpack("<h", file.read(2))[0] # 说明颜色平面数 总设为 1 
        self.biBitCount = unpack("<h", file.read(2))[0] # 说明比特数 
        self.biCompression = unpack("<i", file.read(4))[0] # 图像压缩的数据类型 
        self.biSizeImage = unpack("<i", file.read(4))[0] # 图像大小 
        self.biXPelsPerMeter = unpack("<i", file.read(4))[0]# 水平分辨率 
        self.biYPelsPerMeter = unpack("<i", file.read(4))[0]# 垂直分辨率 
        self.biClrUsed = unpack("<i", file.read(4))[0] # 实际使用的彩色表中的颜色索引数 
        self.biClrImportant = unpack("<i", file.read(4))[0] # 对图像显示有重要影响的颜色索引的数目 
        self.bmp_data = [] 
        #bmp_data_row.append([unpack("<B", file.read(1))[0], unpack("<B", file.read(1))[0], unpack("<B", file.read(1))[0]])
        #file.read(1)
        if self.bfType != 0x4d42:
            print("Not a bmp file.")
            return
        numQuad = 0 
        if self.biBitCount < 16:
            numQuad = (1 << self.biBitCount)
        self.rgbQuadBlue = unpack("<B", file.read(1))[0]
        self.rgbQuadGreen = unpack("<B", file.read(1))[0]
        self.rgbQuadRed = unpack("<B", file.read(1))[0]
        self.rgbQuadReserve = unpack("<B", file.read(1))[0]
        print(numQuad)
        print(self.rgbQuadBlue, self.rgbQuadGreen, self.rgbQuadRed, self.rgbQuadReserve)
