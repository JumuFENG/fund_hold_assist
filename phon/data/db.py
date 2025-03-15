# Python 3
# -*- coding:utf-8 -*-

import pymysql
from peewee import Model, SQL
from playhouse.pool import PooledMySQLDatabase
from contextlib import contextmanager
from phon.config.config import Config

def check_database(db_name, **kwargs):
    """检查数据库是否存在，如果不存在则创建"""
    [kwargs.setdefault(k, v) for k,v in Config.db_config().items()]
    kwargs.setdefault('charset', 'utf8mb4')
    kwargs.setdefault('cursorclass', pymysql.cursors.DictCursor)

    connection = pymysql.connect(**kwargs)
    try:
        with connection.cursor() as cursor:
            cursor.execute(f"SHOW DATABASES LIKE '{db_name}'")
            result = cursor.fetchone()
            if not result:
                cursor.execute(f"CREATE DATABASE {db_name} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
                print(f"Database '{db_name}' created.")
            else:
                print(f"Database '{db_name}' already exists.")
    finally:
        connection.close()

databases = {}

def init_database(db_name, **kwargs):
    [kwargs.setdefault(k, v) for k,v in Config.db_config().items()]
    kwargs.setdefault('max_connections', 10)
    kwargs.setdefault('stale_timeout', 300)
    return PooledMySQLDatabase(db_name, **kwargs)


def get_database(db_name, **kwargs):
    host = kwargs.get('host', 'localhost')
    if f'{host}_{db_name}' not in databases:
        databases[f'{host}_{db_name}'] = init_database(db_name, **kwargs)
    return databases[f'{host}_{db_name}']


def check_or_create(model):
    with write_context(model):
        model._meta.database.create_tables([model], safe=True)


# 动态创建模型的函数
def create_model(basemodel, table=None, db=None):
    """
    动态创建模型类。

    :param basemodel: 基础模型类
    :param table: 表名（可选）
    :param db: 数据库（可选）
    :return: 新的模型类
    """
    if db is None:
        if not basemodel._meta.database:
            basemodel._meta.database = get_database(basemodel._meta.db_name)
    if table is None and db is None:
        check_or_create(basemodel)
        return basemodel

    if isinstance(db, str):
        db = get_database(db)
    if table is None:
        if not basemodel._meta.database:
            basemodel._meta.database = db

    table = basemodel._meta.table_name if table is None else table
    db = basemodel._meta.database if db is None else db

    class Meta:
        table_name = table
        database = db
        db_name = db.database

    # 动态创建类
    _model = type(table.capitalize(), (basemodel,), {'Meta': Meta})
    check_or_create(_model)
    return _model


# 上下文管理器
@contextmanager
def read_context(tbl):
    db = tbl._meta.database if isinstance(tbl, Model) or issubclass(tbl, Model) else tbl
    try:
        db.connect()
        yield db
    finally:
        if not db.is_closed():
            db.close()

@contextmanager
def write_context(tbl):
    db = tbl._meta.database if isinstance(tbl, Model) or issubclass(tbl, Model) else tbl
    try:
        db.connect()  # 连接数据库
        with db.atomic():  # 开启事务
            yield db  # 返回 db 对象
    finally:
        if not db.is_closed():  # 确保关闭连接
            db.close()


def copy_table(from_table, to_table, batch_size=100):
    from_db = from_table._meta.database
    to_db = to_table._meta.database

    try:
        with read_context(from_db):
            total_count = from_table.select().count()

        with write_context(to_db):
            to_db.create_tables([to_table], safe=True)

            for i in range(0, total_count, batch_size):
                with read_context(from_db):
                    batch = list(from_table.select().offset(i).limit(batch_size))

                # 获取所有字段名
                all_fields = to_table._meta.fields
                # 获取主键字段名
                primary_keys = to_table._meta.primary_key.field_names if hasattr(to_table._meta.primary_key, 'field_names') else [to_table._meta.primary_key.name]
                # 过滤掉主键字段，只保留非主键字段
                non_primary_fields = {name: field for name, field in all_fields.items() if name not in primary_keys}

                # 批量插入或更新
                data_to_insert = []
                for slave in batch:
                    row_data = {name: getattr(slave, name) for name in all_fields}
                    data_to_insert.append(row_data)

                # 动态构建更新字典
                update_dict = {field: SQL(f'excluded.{name}') for name, field in non_primary_fields.items()}

                to_table.insert_many(data_to_insert).on_conflict(
                    conflict_target=primary_keys,  # 主键字段
                    update=update_dict  # 更新非主键字段
                ).execute()

        print("Verifying data...")
        with read_context(from_db):
            from_count = from_table.select().count()
        with read_context(to_db):
            to_count = to_table.select().count()

        if from_count == to_count:
            print(f"Data copy successful. {to_count} records copied.")
        else:
            print(f"Warning: Record count mismatch. Source: {from_count}, Destination: {to_count}")

    except Exception as e:
        print(f"An error occurred during the copy process: {str(e)}")
        raise


def copy_table_to(from_table, to_db, batch_size=100):
    # 从一个数据库中复制一个表到另外一个数据库中
    if not from_table._meta.database:
        from_table = create_model(from_table)
    to_table = create_model(from_table, None, to_db)
    copy_table(from_table, to_table, batch_size)

