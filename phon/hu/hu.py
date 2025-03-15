from datetime import datetime, timedelta

class DateConverter():
    @classmethod
    def days_since_2000(self, date):
        if ' ' in date:
            date = date.split(' ')[0]
        d = datetime.strptime("2000-01-01", "%Y-%m-%d")
        if isinstance(date, str):
            dt = datetime.strptime(date, "%Y-%m-%d")
            return (dt - d).days
        return (date - d).days

    @classmethod
    def date_by_delta(self, days):
        d = datetime.strptime("2000-01-01", "%Y-%m-%d") + timedelta(days=days)
        return d.strftime("%Y-%m-%d")
