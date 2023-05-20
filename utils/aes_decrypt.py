# Python 3
# -*- coding:utf-8 -*-
from cryptography.hazmat.primitives import padding
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend
import base64


class AesCBCBase64:
    ''' AES 加解密 Mode: CBC, padding: pkcs7. Base64
    '''
    def __init__(self, k, iv) -> None:
        # type: (str, str) -> None
        self.key = k.encode()
        self.iv = iv.encode()

    def pkcs7_padding(self, data):
        if not isinstance(data, bytes):
            data = data.encode()

        padder = padding.PKCS7(algorithms.AES.block_size).padder()

        padded_data = padder.update(data) + padder.finalize()

        return padded_data

    def encrypt(self, data):
        '''@data: the string to encrypt.
        @return: Base64 encoded encrypt content.
        '''
        # type: (str) -> str
        assert isinstance(data, str), 'Only encrypt for string now!'
        data = data.encode()
        cipher = Cipher(algorithms.AES(self.key),
                        modes.CBC(self.iv),
                        backend=default_backend())
        encryptor = cipher.encryptor()
        padded_data = encryptor.update(self.pkcs7_padding(data))
        return base64.b64encode(padded_data).decode()

    def pkcs7_unpadding(self, padded_data):
        unpadder = padding.PKCS7(algorithms.AES.block_size).unpadder()
        data = unpadder.update(padded_data)

        try:
            uppadded_data = data + unpadder.finalize()
        except ValueError:
            raise Exception('无效的加密信息!')
        else:
            return uppadded_data

    def decrypt(self, data):
        ''' @data: base64 encoded data.
        '''
        # type: (str) -> str
        assert isinstance(data, str), 'only decrypt Base64 coded encrypt content'
        data = base64.b64decode(data)
        cipher = Cipher(algorithms.AES(self.key),
                        modes.CBC(self.iv),
                        backend=default_backend())
        decryptor = cipher.decryptor()
        uppaded_data = self.pkcs7_unpadding(decryptor.update(data))
        return uppaded_data.decode()

