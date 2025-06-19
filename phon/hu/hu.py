from datetime import datetime, timedelta

class DateConverter():
    @staticmethod
    def days_since_2000(date):
        if ' ' in date:
            date = date.split(' ')[0]
        d = datetime.strptime("2000-01-01", "%Y-%m-%d")
        if isinstance(date, str):
            dt = datetime.strptime(date, "%Y-%m-%d")
            return (dt - d).days
        return (date - d).days

    @staticmethod
    def date_by_delta(days):
        d = datetime.strptime("2000-01-01", "%Y-%m-%d") + timedelta(days=days)
        return d.strftime("%Y-%m-%d")

    @staticmethod
    def is_same_period(d1, d2, period='d'):
        if not d1 or not d2:
            return False

        if period == 'd':
            return d1 == d2
        if period == 'm':
            return d1[:7] == d2[:7]
        elif period == 'w':
            date1 = datetime.strptime(d1, '%Y-%m-%d').date()
            date2 = datetime.strptime(d2, '%Y-%m-%d').date()
            monday1 = date1 - timedelta(days=date1.weekday())
            monday2 = date2 - timedelta(days=date2.weekday())
            return monday1 == monday2
