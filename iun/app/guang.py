from datetime import datetime

class guang:
    @staticmethod
    def getTodayDate(sep=''):
        return datetime.now().strftime(f"%Y{sep}%m{sep}%d")
    
    @staticmethod
    def calcBuyCount(amount, price):
        amount = float(amount)
        price = float(price)
        count = int(amount / (100 * price))
        if amount > (100 * count + 50) * price:
            # amout > price * 100 * (2 * count + 1) / 2
            count += 1
        return 100 * count

    @staticmethod
    def delay_seconds(daytime):
        '''计算当前时间到daytime的时间间隔'''
        dnow = datetime.now()
        dtarr = daytime.split(':')
        hr = int(dtarr[0])
        minutes = int(dtarr[1])
        secs = 0 if len(dtarr) < 3 else int(dtarr[2])
        target_time = dnow.replace(hour=hr, minute=minutes, second=secs)
        return (target_time - dnow).total_seconds()
