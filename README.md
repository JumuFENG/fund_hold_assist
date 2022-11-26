# fund_hold_assist
update real time fund net value, growth rate, and estimate value.

Python 3 and pip 3 required.
modules need:

pip3 install pymysql

pip3 install cryptography

pip3 install Image

pip3 install requests

pip3 install beautifulsoup4

pip3 install selenium

pip3 install tushare

pip3 install lxml

pip3 install pandas

modules for http server:
pip3 install flask
pip3 install gunicorn

create database tesddb and fund_center manually.

create utils/_pwd.py and add db_pwd = "<password for root of mysql>" add summary_dest_dir = "<the destination dir for summary folder>".

* Create Virtual Environment on Mac.
pip3 install virtualenv
which python3 to get path of python3
python3 -m virtualenv -p /usr/bin/python3 vEnv to create vEnv.
source vEnv/bin/active to activate Virtual Environment
deactivate to deactivate Virtual Environment
rm -rf vEnv to delete Virtual Environment
