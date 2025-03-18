* install nginx;
run in docker

Set auto startup
https://blog.csdn.net/u013091013/article/details/53393406

Crontab tasks:
      1 20,50 20-23 * * 1-5  cd /opt/rest_app && python3 daily_update.py >> logs/daily_task.log 2>&1
      2 50 7 * * 1-6  cd /opt/rest_app && python3 daily_update.py >> logs/daily_task.log 2>&1
      3 0 8 * * 1-5 cd /home/public/fund_hold_assist && python3 daily_local.py >> /opt/rest_app/logs/save_budget_task.log 2>&1
      4 00 1 * * 1 rm -f /opt/rest_app/logs/* && systemctl restart supervisord
      5 0 8 * * 1 cd /opt/rest_app && python3 weekly_update.py >> logs/weekly_taks.log 2>&1
      6 0 8 1 * * cd /opt/rest_app && python3 monthly_update.py >> logs/monthly_task.log 2>&1

pip install flask, gunicorn
python flask_startup for testing
gunicorn flask_startup:app -c gunicorn_conf.py for running

auto start gunicorn task.
Linux, supervisord
Mac, launchctl
